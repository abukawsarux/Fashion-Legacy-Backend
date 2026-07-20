// routes/products.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");
const { asyncHandler } = require("../middleware/error");
const { stripNulls, validateProductPayload } = require("../utils/validate");
const { generateProductId } = require("../utils/ids");
const { saveBase64Image } = require("../utils/images");

// Get all products
router.get("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  res.status(200).json(db.products);
}));

// Get a single product
router.get("/:id", asyncHandler(async (req, res) => {
  const db = await getDb();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.status(200).json(product);
}));

// Create a new product
router.post("/", asyncHandler(async (req, res) => {
  stripNulls(req.body);
  const { nameEn, nameBn, descriptionEn, descriptionBn, category, costUSD, priceUSD, discountPercent, images, sizes, colors, stock } = req.body;

  if (!nameEn || !nameBn || !category || (Array.isArray(category) && category.length === 0) || costUSD === undefined || priceUSD === undefined || stock === undefined) {
    return res.status(400).json({ error: "Missing required fields (nameEn, nameBn, category, costUSD, priceUSD, stock)." });
  }
  const validationError = validateProductPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const db = await getDb();
  const primaryCat = Array.isArray(category) ? category[0] : category;
  const newProduct = {
    id: generateProductId(primaryCat.split("_")[1] || "gen", db.products),
    nameEn: nameEn.trim(),
    nameBn: nameBn.trim(),
    descriptionEn: (descriptionEn || "").trim(),
    descriptionBn: (descriptionBn || "").trim(),
    category,
    costUSD: parseFloat(costUSD),
    priceUSD: parseFloat(priceUSD),
    discountPercent: parseInt(discountPercent) || 0,
    images: images && images.length > 0 ? images : ["/images/logo.png"],
    sizes: sizes || ["M"],
    colors: colors || [],
    rating: 5.0,
    reviewsCount: 0,
    stock: parseInt(stock) || 0
  };

  db.products.unshift(newProduct);
  db.logs.push({ timestamp: new Date().toISOString(), action: "Product Created", details: `Admin added product "${newProduct.nameEn}" under category "${Array.isArray(category) ? category.join(", ") : category}" with stock ${stock}.` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save product to database." });

  res.status(201).json({ message: "Product created successfully", product: newProduct });
}));

// Update a product
router.put("/:id", asyncHandler(async (req, res) => {
  const db = await getDb();
  const productIndex = db.products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) return res.status(404).json({ error: "Product not found." });

  const updates = stripNulls(req.body);
  const validationError = validateProductPayload(updates);
  if (validationError) return res.status(400).json({ error: validationError });

  const product = db.products[productIndex];
  if (updates.nameEn !== undefined) product.nameEn = updates.nameEn.trim();
  if (updates.nameBn !== undefined) product.nameBn = updates.nameBn.trim();
  if (updates.descriptionEn !== undefined) product.descriptionEn = updates.descriptionEn.trim();
  if (updates.descriptionBn !== undefined) product.descriptionBn = updates.descriptionBn.trim();
  if (updates.category !== undefined) product.category = updates.category;
  if (updates.costUSD !== undefined) product.costUSD = parseFloat(updates.costUSD);
  if (updates.priceUSD !== undefined) product.priceUSD = parseFloat(updates.priceUSD);
  if (updates.discountPercent !== undefined) product.discountPercent = parseInt(updates.discountPercent) || 0;
  if (updates.images !== undefined) product.images = updates.images;
  if (updates.sizes !== undefined) product.sizes = updates.sizes;
  if (updates.colors !== undefined) product.colors = updates.colors;
  if (updates.stock !== undefined) product.stock = parseInt(updates.stock) || 0;

  db.products[productIndex] = product;
  db.logs.push({ timestamp: new Date().toISOString(), action: "Product Updated", details: `Admin updated product "${product.nameEn}" (ID: ${product.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save product to database." });

  res.status(200).json({ message: "Product updated successfully", product });
}));

// Delete a product
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = await getDb();
  const productIndex = db.products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) return res.status(404).json({ error: "Product not found." });

  const deletedProduct = db.products[productIndex];
  db.products.splice(productIndex, 1);
  db.logs.push({ timestamp: new Date().toISOString(), action: "Product Deleted", details: `Admin deleted product "${deletedProduct.nameEn}" (ID: ${deletedProduct.id}).` });

  const saved = await saveDb(db);
  if (!saved) return res.status(500).json({ error: "Failed to save changes to database." });

  res.status(200).json({ message: "Product deleted successfully", id: req.params.id });
}));

// Upload an image file (Base64). In Vercel/production the base64 string is
// returned as-is (stored in the DB — disk is ephemeral); locally it is written
// to public/uploads and a /uploads path is returned. See utils/images.js.
router.post("/upload", (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image content provided." });
  if (typeof image !== "string") return res.status(400).json({ error: "Invalid base64 image format." });

  const imageUrl = saveBase64Image(image, "product");
  if (imageUrl === null) return res.status(400).json({ error: "Invalid base64 image format." });
  res.status(200).json({ imageUrl });
});

module.exports = router;
