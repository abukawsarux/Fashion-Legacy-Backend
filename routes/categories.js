// routes/categories.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { getDb, saveDb } = require("../db");

// Helper to save base64 image
const saveBase64Image = (base64Str) => {
  if (!base64Str) return null;
  // In Vercel or production serverless environments, store base64 in database
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    let extension = "png";
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") extension = "jpg";
    else if (mimeType === "image/webp") extension = "webp";
    else if (mimeType === "image/gif") extension = "gif";
    const uploadDir = path.join(__dirname, "../public/uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `category-${Date.now()}.${extension}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn("Failed to write category image:", err);
    return base64Str;
  }
};

// Get all categories
router.get("/", async (req, res) => {
  const db = await getDb();
  res.status(200).json(db.categories || []);
});

// Create a category
router.post("/", async (req, res) => {
  const { nameEn, nameBn, image } = req.body;
  if (!nameEn || !nameBn) {
    return res.status(400).json({ error: "Missing required fields (nameEn, nameBn)." });
  }

  const db = await getDb();

  let generatedId = "cat_" + nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  if (generatedId === "cat_") generatedId = "cat_" + Date.now().toString().slice(-6);

  const exists = db.categories.some(c => c.id === generatedId);
  const finalId = exists ? `${generatedId}_${Date.now().toString().slice(-4)}` : generatedId;

  let imageUrl = "/images/categories/all.png";
  if (image) {
    if (image.startsWith("data:")) {
      const savedPath = saveBase64Image(image);
      if (savedPath) imageUrl = savedPath;
    } else {
      imageUrl = image;
    }
  }

  const newCategory = { id: finalId, nameEn: nameEn.trim(), nameBn: nameBn.trim(), image: imageUrl };
  db.categories.push(newCategory);
  db.logs.push({ timestamp: new Date().toISOString(), action: "Category Created", details: `Admin added category "${newCategory.nameEn}" (ID: ${newCategory.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save category to database." });

  res.status(201).json({ message: "Category created successfully", category: newCategory });
});

// Update category
router.put("/:id", async (req, res) => {
  const db = await getDb();
  const catIndex = db.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: "Category not found." });

  const category = db.categories[catIndex];
  const { nameEn, nameBn, image } = req.body;
  if (nameEn !== undefined) category.nameEn = nameEn.trim();
  if (nameBn !== undefined) category.nameBn = nameBn.trim();
  if (image !== undefined) {
    if (image.startsWith("data:")) {
      const savedPath = saveBase64Image(image);
      if (savedPath) category.image = savedPath;
    } else {
      category.image = image;
    }
  }
  db.categories[catIndex] = category;
  db.logs.push({ timestamp: new Date().toISOString(), action: "Category Updated", details: `Admin updated category "${category.nameEn}" (ID: ${category.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save category to database." });

  res.status(200).json({ message: "Category updated successfully", category });
});

// Delete category
router.delete("/:id", async (req, res) => {
  const db = await getDb();
  const catIndex = db.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: "Category not found." });

  const deletedCat = db.categories[catIndex];
  db.categories.splice(catIndex, 1);
  db.logs.push({ timestamp: new Date().toISOString(), action: "Category Deleted", details: `Admin deleted category "${deletedCat.nameEn}" (ID: ${deletedCat.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save changes to database." });

  res.status(200).json({ message: "Category deleted successfully", id: req.params.id });
});

module.exports = router;
