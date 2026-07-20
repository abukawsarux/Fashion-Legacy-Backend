// routes/categories.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");
const { asyncHandler } = require("../middleware/error");
const { stripNulls, validateCategoryPayload } = require("../utils/validate");
const { saveBase64Image } = require("../utils/images");

// Get all categories
router.get("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  res.status(200).json(db.categories || []);
}));

// Create a category
router.post("/", asyncHandler(async (req, res) => {
  stripNulls(req.body);
  const { nameEn, nameBn, image } = req.body;
  if (!nameEn || !nameBn) {
    return res.status(400).json({ error: "Missing required fields (nameEn, nameBn)." });
  }
  const validationError = validateCategoryPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const db = await getDb();

  let generatedId = "cat_" + nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  if (generatedId === "cat_") generatedId = "cat_" + Date.now().toString().slice(-6);

  const exists = db.categories.some(c => c.id === generatedId);
  const finalId = exists ? `${generatedId}_${Date.now().toString().slice(-4)}` : generatedId;

  let imageUrl = "/images/categories/all.png";
  if (image) {
    if (image.startsWith("data:")) {
      const savedPath = saveBase64Image(image, "category");
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
}));

// Update category
router.put("/:id", asyncHandler(async (req, res) => {
  const db = await getDb();
  const catIndex = db.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: "Category not found." });

  stripNulls(req.body);
  const validationError = validateCategoryPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const category = db.categories[catIndex];
  const { nameEn, nameBn, image } = req.body;
  if (nameEn !== undefined) category.nameEn = nameEn.trim();
  if (nameBn !== undefined) category.nameBn = nameBn.trim();
  if (image !== undefined) {
    if (image.startsWith("data:")) {
      const savedPath = saveBase64Image(image, "category");
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
}));

// Delete category
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = await getDb();
  const catIndex = db.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: "Category not found." });

  const deletedCat = db.categories[catIndex];
  db.categories.splice(catIndex, 1);
  db.logs.push({ timestamp: new Date().toISOString(), action: "Category Deleted", details: `Admin deleted category "${deletedCat.nameEn}" (ID: ${deletedCat.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save changes to database." });

  res.status(200).json({ message: "Category deleted successfully", id: req.params.id });
}));

module.exports = router;
