// routes/products.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");

// Get all products
router.get("/", (req, res) => {
  const db = getDb();
  res.status(200).json(db.products);
});

// Get a single product
router.get("/:id", (req, res) => {
  const db = getDb();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }
  res.status(200).json(product);
});

// Create a new product
router.post("/", (req, res) => {
  const { nameEn, nameBn, descriptionEn, descriptionBn, category, costUSD, priceUSD, discountPercent, images, sizes, colors, stock } = req.body;
  
  if (!nameEn || !nameBn || !category || costUSD === undefined || priceUSD === undefined || stock === undefined) {
    return res.status(400).json({ error: "Missing required fields (nameEn, nameBn, category, costUSD, priceUSD, stock)." });
  }

  const db = getDb();
  const newProduct = {
    id: `prod-${category.split("_")[1] || "gen"}-${Date.now().toString().slice(-4)}`,
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

  db.products.unshift(newProduct); // Prepend to show up first in CRUD list
  
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Product Created",
    details: `Admin added product "${newProduct.nameEn}" under category "${category}" with stock ${stock}.`
  });

  saveDb(db);

  res.status(201).json({
    message: "Product created successfully",
    product: newProduct
  });
});

// Update a product
router.put("/:id", (req, res) => {
  const db = getDb();
  const productIndex = db.products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) {
    return res.status(404).json({ error: "Product not found." });
  }

  const product = db.products[productIndex];
  const updates = req.body;

  // Apply updates selectively
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

  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Product Updated",
    details: `Admin updated product attributes for "${product.nameEn}" (ID: ${product.id}).`
  });

  saveDb(db);

  res.status(200).json({
    message: "Product updated successfully",
    product
  });
});

// Delete a product
router.delete("/:id", (req, res) => {
  const db = getDb();
  const productIndex = db.products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) {
    return res.status(404).json({ error: "Product not found." });
  }

  const deletedProduct = db.products[productIndex];
  db.products.splice(productIndex, 1);

  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Product Deleted",
    details: `Admin deleted product "${deletedProduct.nameEn}" (ID: ${deletedProduct.id}).`
  });

  saveDb(db);

  res.status(200).json({
    message: "Product deleted successfully",
    id: req.params.id
  });
});

module.exports = router;
