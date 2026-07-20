// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const { getDb, saveDb, connectMongo } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || isLocalOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy blocks requests from origin: ${origin}`), false);
  },
  credentials: true
}));

// Parse incoming request bodies as JSON with custom size limit for base64 uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Serve static uploaded files
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Log HTTP requests in development console
app.use(morgan("dev"));

// Ensure MongoDB is connected on every request (essential for Vercel serverless cold starts)
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error("MongoDB middleware connection error:", err.message);
    if (process.env.NODE_ENV === "production" && process.env.MONGODB_URI) {
      res.status(500).json({ error: "Failed to connect to the database. Please try again." });
    } else {
      // In local development, fallback to local JSON database if MongoDB fails
      next();
    }
  }
});

// Mount routers
const authRouter = require("./routes/auth");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const analyticsRouter = require("./routes/analytics");
const categoriesRouter = require("./routes/categories");

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/categories", categoriesRouter);

// Flash Sale Countdown API endpoints
app.get("/api/flash-sale", async (req, res) => {
  const db = await getDb();
  res.status(200).json({ flashSaleEnd: db.flashSaleEnd || new Date(Date.now() + 86400000).toISOString() });
});

app.post("/api/flash-sale", async (req, res) => {
  const { flashSaleEnd } = req.body;
  if (!flashSaleEnd) {
    return res.status(400).json({ error: "Missing flashSaleEnd timestamp." });
  }
  const db = await getDb();
  db.flashSaleEnd = flashSaleEnd;
  await saveDb(db);
  res.status(200).json({ message: "Flash sale countdown updated successfully", flashSaleEnd });
});

// Health check root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    message: "Fashion Legacy Express.js Backend is running.",
    database: process.env.MONGODB_URI ? "MongoDB Atlas (Live)" : "Local JSON Fallback (Temporary - Will Reset)",
    timestamp: new Date().toISOString()
  });
});

// Start Server listening (for local execution)
if (process.env.NODE_ENV !== "production") {
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
