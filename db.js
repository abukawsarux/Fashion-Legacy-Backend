// db.js
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

// Default initial products (matching website and dashboard default categories and currency conversion logic)
const DEFAULT_PRODUCTS = [];

const DEFAULT_ORDERS = [];

const DEFAULT_TRAFFIC = [
  { date: "30 Jun", visitors: 420, pageViews: 1250, conversions: 12 },
  { date: "01 Jul", visitors: 510, pageViews: 1530, conversions: 15 },
  { date: "02 Jul", visitors: 480, pageViews: 1390, conversions: 11 },
  { date: "03 Jul", visitors: 620, pageViews: 1860, conversions: 22 },
  { date: "04 Jul", visitors: 730, pageViews: 2190, conversions: 28 },
  { date: "05 Jul", visitors: 690, pageViews: 2010, conversions: 24 },
  { date: "06 Jul", visitors: 850, pageViews: 2600, conversions: 31 }
];

const DEFAULT_USERS = [
  {
    name: "Raihan Chowdhury",
    email: "raihan@fashionlegacy.live",
    phone: "01712345678",
    address: "House 14, Road 5, Uttara Sector 4, Dhaka",
    avatar: "avatar_men",
    password: "password123" // Plain text password for simplicity in mock
  }
];

const DEFAULT_LOGS = [
  {
    timestamp: new Date().toISOString(),
    action: "System Initialization",
    details: "Backend server database seeded with default mock records."
  }
];

const DEFAULT_CATEGORIES = [
  { id: "cat_hot", nameEn: "Hot Sale", nameBn: "হট সেল", image: "/images/categories/hot.png" },
  { id: "cat_women", nameEn: "Women's Fashion", nameBn: "মহিলাদের ফ্যাশন", image: "/images/categories/women.png" },
  { id: "cat_men", nameEn: "Men's Fashion", nameBn: "পুরুষদের ফ্যাশন", image: "/images/categories/men.png" },
  { id: "cat_shoes", nameEn: "Shoes", nameBn: "জুতো", image: "/images/categories/shoes.png" },
  { id: "cat_watches", nameEn: "Watches & Acc.", nameBn: "ঘড়ি ও অ্যাক্সেসরিজ", image: "/images/categories/watches.png" },
  { id: "cat_kids", nameEn: "Kids & Toys", nameBn: "বাচ্চাদের খেলনা ও পোশাক", image: "/images/categories/kids.png" }
];

const DEFAULT_DB_STATE = {
  categories: DEFAULT_CATEGORIES,
  products: DEFAULT_PRODUCTS,
  orders: DEFAULT_ORDERS,
  traffic: DEFAULT_TRAFFIC,
  users: DEFAULT_USERS,
  logs: DEFAULT_LOGS
};

// Check and initialize
function initDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB_STATE, null, 2), "utf8");
    console.log("Database seeded successfully in:", dbPath);
  }
}

// Read database
function getDb() {
  initDb();
  try {
    const data = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(data);
    
    let updated = false;

    // 1. Sync Categories default data
    if (!parsed.categories) {
      parsed.categories = [];
    }
    DEFAULT_CATEGORIES.forEach(defaultCat => {
      const existingCatIndex = parsed.categories.findIndex(c => c.id === defaultCat.id);
      if (existingCatIndex === -1) {
        parsed.categories.push(defaultCat);
        updated = true;
      } else {
        const existing = parsed.categories[existingCatIndex];
        if (existing.nameEn !== defaultCat.nameEn || existing.nameBn !== defaultCat.nameBn || existing.image !== defaultCat.image) {
          parsed.categories[existingCatIndex] = { ...existing, ...defaultCat };
          updated = true;
        }
      }
    });

    // 2. Sync Products default data
    if (!parsed.products) {
      parsed.products = [];
    }
    DEFAULT_PRODUCTS.forEach(defaultProd => {
      const existingProdIndex = parsed.products.findIndex(p => p.id === defaultProd.id);
      if (existingProdIndex === -1) {
        parsed.products.push(defaultProd);
        updated = true;
      } else {
        const existing = parsed.products[existingProdIndex];
        let hasDiff = false;
        const fieldsToSync = ["nameEn", "nameBn", "descriptionEn", "descriptionBn", "category", "costUSD", "priceUSD", "discountPercent"];
        fieldsToSync.forEach(field => {
          if (existing[field] !== defaultProd[field]) {
            existing[field] = defaultProd[field];
            hasDiff = true;
          }
        });
        
        // Sync arrays/objects
        if (JSON.stringify(existing.images) !== JSON.stringify(defaultProd.images)) {
          existing.images = defaultProd.images;
          hasDiff = true;
        }
        if (JSON.stringify(existing.sizes) !== JSON.stringify(defaultProd.sizes)) {
          existing.sizes = defaultProd.sizes;
          hasDiff = true;
        }
        if (JSON.stringify(existing.colors) !== JSON.stringify(defaultProd.colors)) {
          existing.colors = defaultProd.colors;
          hasDiff = true;
        }

        if (hasDiff) {
          parsed.products[existingProdIndex] = existing;
          updated = true;
        }
      }
    });

    // 3. Sync Users default data
    if (!parsed.users) {
      parsed.users = [];
    }
    DEFAULT_USERS.forEach(defaultUser => {
      const existingUserIndex = parsed.users.findIndex(u => u.email === defaultUser.email);
      if (existingUserIndex === -1) {
        parsed.users.push(defaultUser);
        updated = true;
      } else {
        const existing = parsed.users[existingUserIndex];
        let hasDiff = false;
        const userFields = ["name", "phone", "address", "avatar", "password"];
        userFields.forEach(field => {
          if (existing[field] !== defaultUser[field]) {
            existing[field] = defaultUser[field];
            hasDiff = true;
          }
        });
        if (hasDiff) {
          parsed.users[existingUserIndex] = existing;
          updated = true;
        }
      }
    });

    if (updated) {
      saveDb(parsed);
    }
    return parsed;
  } catch (error) {
    console.error("Failed to read database file, returning default state", error);
    return DEFAULT_DB_STATE;
  }
}

// Atomic save database to prevent corrupt files
function saveDb(data) {
  initDb();
  try {
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempPath, dbPath);
    return true;
  } catch (error) {
    console.error("Failed to save database file atomically", error);
    return false;
  }
}

module.exports = {
  getDb,
  saveDb
};
