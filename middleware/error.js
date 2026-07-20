// middleware/error.js — async safety net for Express 4.
// Express 4 does not catch rejected promises from async handlers; without this
// wrapper a thrown error leaves the request hanging with no response at all.

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// JSON 404 for unknown routes (mounted after all routers).
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

// Global error handler (mounted last). Keeps the frontends' `{error}` contract
// and never leaks internal error details on 500 — those go to the server log.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.message && err.message.startsWith("CORS policy blocks")) {
    return res.status(403).json({ error: err.message });
  }
  // body-parser error types
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: "Internal server error." });
}

module.exports = { asyncHandler, notFoundHandler, errorHandler };
