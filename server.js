// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const { getDb } = require("./db");

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

// Database Auto-Initialization
getDb();

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

// Health check root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    message: "Fashion Legacy Express.js Backend is running.",
    timestamp: new Date().toISOString()
  });
});

// Start Server listening
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Fashion Legacy Backend API Server running!`);
  console.log(`Listening on address: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
