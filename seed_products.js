// seed_products.js
require("dotenv").config();
const { connectMongo, getDb, saveDb } = require("./db");
const fs = require("fs");
const path = require("path");

// Read data/products.ts content or extract PRODUCTS array
const websiteProductsFile = path.join(__dirname, "../Fashion Legacy - Website/data/products.ts");
const content = fs.readFileSync(websiteProductsFile, "utf8");

// Extract JSON string after export const PRODUCTS: Product[] = 
const jsonMatch = content.match(/export const PRODUCTS: Product\[\] = (\[[\s\S]*\]);/);

if (!jsonMatch) {
  console.error("Could not parse PRODUCTS from products.ts!");
  process.exit(1);
}

try {
  const products = JSON.parse(jsonMatch[1]);
  console.log(`Extracted ${products.length} products from products.ts`);

  // Add stock to products for backend compatibility
  const productsWithStock = products.map(p => ({
    ...p,
    costUSD: p.costUSD || Math.round((p.priceUSD * 0.5) * 100) / 100,
    stock: p.stock !== undefined ? p.stock : 50
  }));

  async function runSeed() {
    console.log("Connecting to MongoDB / Database...");
    await connectMongo();
    
    const db = await getDb();
    db.products = productsWithStock;

    console.log("Saving products to Database...");
    const success = await saveDb(db);

    if (success) {
      console.log(`SUCCESSFULLY SEEDED ${productsWithStock.length} PRODUCTS INTO DATABASE!`);
    } else {
      console.error("FAILED TO SAVE PRODUCTS TO DATABASE.");
    }
    process.exit(0);
  }

  runSeed().catch(err => {
    console.error("Error during seeding:", err);
    process.exit(1);
  });

} catch (err) {
  console.error("JSON parse error:", err);
  process.exit(1);
}
