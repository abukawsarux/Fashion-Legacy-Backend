// utils/images.js — shared base64-image persistence for products & categories.
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");

// Returns:
//  - the stored image URL (`/uploads/<file>`) in local development;
//  - the base64 string unchanged on Vercel/production (ephemeral disk —
//    images live in the database there);
//  - the raw input again if the disk write fails (legacy fallback behavior);
//  - null when the input is not a valid base64 data URI.
function saveBase64Image(base64Str, prefix) {
  if (!base64Str) return null;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    let extension = "png";
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") extension = "jpg";
    else if (mimeType === "image/webp") extension = "webp";
    else if (mimeType === "image/gif") extension = "gif";
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${prefix}-${Date.now()}.${extension}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn(`Failed to write ${prefix} image to disk:`, err);
    return base64Str;
  }
}

module.exports = { saveBase64Image };
