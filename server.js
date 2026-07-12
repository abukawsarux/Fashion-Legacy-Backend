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

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS policy blocks requests from origin: ${origin}`), false);
    }
    return callback(null, true);
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
    console.error("MongoDB middleware connection error:", err);
    if (process.env.MONGODB_URI) {
      res.status(500).json({ error: "Failed to connect to the database. Please try again." });
    } else {
      next(); // fallback to local JSON database if not configured for Mongo
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
  connectMongo().then(() => {
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
