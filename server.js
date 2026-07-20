// server.js
// config must load first: it reads .env and validates the environment before
// db.js (which reads env at module load) is required.
require("./config");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const { getDb, saveDb, connectMongo, getDbStatus } = require("./db");
const { asyncHandler, notFoundHandler, errorHandler } = require("./middleware/error");
const { globalLimiter, authLimiter, simulateLimiter } = require("./middleware/rateLimit");
const { validateFlashSale } = require("./utils/validate");

const app = express();
const PORT = process.env.PORT || 5000;

// Vercel sits behind a reverse proxy — needed so req.ip (rate limiting) sees
// the real client address instead of the proxy's.
app.set("trust proxy", 1);

// Enable CORS for local development and production domains from env variables
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://fashionlegacy.live",
  "https://dashboard.fashionlegacy.live",
  process.env.WEBSITE_URL,
  process.env.DASHBOARD_URL
].filter(Boolean);

const isLocalOrigin = (origin) => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") || hostname.startsWith("172.17.") || hostname.startsWith("172.18.") || hostname.startsWith("172.19.") || hostname.startsWith("172.20.") || hostname.startsWith("172.21.") || hostname.startsWith("172.22.") || hostname.startsWith("172.23.") || hostname.startsWith("172.24.") || hostname.startsWith("172.25.") || hostname.startsWith("172.26.") || hostname.startsWith("172.27.") || hostname.startsWith("172.28.") || hostname.startsWith("172.29.") || hostname.startsWith("172.30.") || hostname.startsWith("172.31.")
    );
  } catch (e) {
    return false;
  }
};

// Security headers. CSP is noise for a JSON API; CORP must stay cross-origin
// or the two frontends could no longer load /uploads images.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    // In local development, allow all origins
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    // LAN origins are opt-in in production: set ALLOW_LAN_ORIGINS=true to test
    // the deployed API from a phone/another device on your network.
    if (process.env.ALLOW_LAN_ORIGINS === "true" && isLocalOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy blocks requests from origin: ${origin}`), false);
  },
  credentials: true
}));

// Serve static uploaded files (before the rate limiter — a product grid can
// legitimately pull dozens of images at once)
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(globalLimiter);

// Parse incoming request bodies as JSON. Only the image-carrying routes need
// the huge 15mb limit (base64 uploads); everything else gets a sane default.
const jsonSmall = express.json({ limit: "200kb" });
const jsonLarge = express.json({ limit: "15mb" });
app.use((req, res, next) => {
  const needsLargeBody =
    (req.method === "POST" || req.method === "PUT") &&
    (req.path.startsWith("/api/products") || req.path.startsWith("/api/categories"));
  return (needsLargeBody ? jsonLarge : jsonSmall)(req, res, next);
});
app.use(express.urlencoded({ limit: "200kb", extended: true }));

// Log HTTP requests (compact machine-parseable format in production, quiet in tests)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "short" : "dev"));
}

// Ensure MongoDB is connected on every request (essential for Vercel serverless cold starts)
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error("MongoDB middleware connection error:", err.message);
    if (process.env.STRICT_DB === "true") {
      return res.status(503).json({ error: "Database unavailable." });
    }
    // Deliberate: fall through to the local JSON fallback (ephemeral on Vercel)
    next();
  }
});

// Mount routers
const authRouter = require("./routes/auth");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const analyticsRouter = require("./routes/analytics");
const categoriesRouter = require("./routes/categories");

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/analytics/simulate", simulateLimiter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/categories", categoriesRouter);

// Flash Sale Countdown API endpoints
app.get("/api/flash-sale", asyncHandler(async (req, res) => {
  const db = await getDb();
  res.status(200).json({ flashSaleEnd: db.flashSaleEnd || new Date(Date.now() + 86400000).toISOString() });
}));

app.post("/api/flash-sale", asyncHandler(async (req, res) => {
  const { flashSaleEnd } = req.body;
  if (!flashSaleEnd) {
    return res.status(400).json({ error: "Missing flashSaleEnd timestamp." });
  }
  const validationError = validateFlashSale(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const db = await getDb();
  db.flashSaleEnd = flashSaleEnd;
  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save flash sale to database." });
  res.status(200).json({ message: "Flash sale countdown updated successfully", flashSaleEnd });
}));

// Health check root route — reports the storage backend actually in use
// (Mongo can be configured yet down), plus whether it is configured at all.
app.get("/", (req, res) => {
  const dbStatus = getDbStatus();
  res.status(200).json({
    status: "healthy",
    message: "Fashion Legacy Express.js Backend is running.",
    database: dbStatus.useMongo ? "MongoDB Atlas (Live)" : "Local JSON Fallback (Temporary - Will Reset)",
    mongoConfigured: dbStatus.mongoConfigured,
    timestamp: new Date().toISOString()
  });
});

// Unknown routes → JSON 404; every error → JSON via the global handler (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server listening (for local execution; tests import the app without listening)
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  connectMongo()
    .catch(err => {
      console.error(`===============================================`);
      console.error(`WARNING: MongoDB Atlas connection failed.`);
      console.error(`Error: ${err.message}`);
      console.error(`Falling back to Local JSON Database.`);
      console.error(`===============================================`);
    })
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`===============================================`);
        console.log(`Fashion Legacy Backend API Server running!`);
        console.log(`Listening on address: http://localhost:${PORT}`);
        console.log(`===============================================`);
      });
    });
}

// Export app for Vercel serverless execution
module.exports = app;
