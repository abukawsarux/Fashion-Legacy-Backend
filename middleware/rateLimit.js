// middleware/rateLimit.js — abuse throttling.
// NOTE: the default in-memory store is per-process, so on serverless each warm
// instance counts independently — treat these limits as approximate (a shared
// Redis store is the roadmap fix). Requires `app.set("trust proxy", 1)` so
// req.ip is the real client IP behind Vercel's proxy.
const rateLimit = require("express-rate-limit");

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  // 429 body keeps the frontends' `{error}` contract
  message: { error: "Too many requests, please try again later." }
};

// Generous app-wide ceiling — a busy dashboard session is dozens of requests/min
const globalLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 300, ...shared });

// Login/register/profile — the only brute-force surface until real auth lands
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, ...shared });

// Demo endpoint that fabricates orders and decrements real stock — keep it slow
const simulateLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 10, ...shared });

module.exports = { globalLimiter, authLimiter, simulateLimiter };
