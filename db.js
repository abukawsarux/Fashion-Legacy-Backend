// db.js
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

let mongoClient = null;
let mongoDb = null;
let useMongo = false;
let cachedDbState = null;

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER || process.env.NODE_ENV === "production";
const dataDir = isVercel ? "/tmp" : path.join(__dirname, "data");
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
    name: "Shamim Ahsan",
    email: "shamiim@fashionlegacy.live",
    phone: "01779024048",
    address: "House 14, Road 5, Uttara Sector 4, Dhaka",
    avatar: "avatar_men",
    password: "12345678" // Plain text password for simplicity in mock
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
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
      const bundledDbPath = path.join(__dirname, "data/db.json");
      if (isVercel && fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, dbPath);
        console.log("Database initialized by copying bundled db.json to /tmp");
      } else {
        fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB_STATE, null, 2), "utf8");
        console.log("Database seeded successfully in:", dbPath);
      }
    }
  } catch (error) {
    console.error("Failed to initialize database", error);
  }
}

// Connect to MongoDB Atlas (for live Vercel deployments)
async function connectMongo() {
  if (useMongo && mongoClient && mongoDb) {
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI found, using local JSON database file.");
    return;
  }
  
  try {
    console.log("Connecting to MongoDB Atlas...");
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db("fashion_legacy_db");
    useMongo = true;
    console.log("Connected to MongoDB Atlas successfully!");
    
    // Load initial state
    const col = mongoDb.collection("state");
    const doc = await col.findOne({ _id: "current_state" });
    if (doc) {
      delete doc._id;
      cachedDbState = doc;
      console.log("Loaded database state from MongoDB.");
    } else {
      // Seed initial state
      await col.insertOne({ _id: "current_state", ...DEFAULT_DB_STATE });
      cachedDbState = JSON.parse(JSON.stringify(DEFAULT_DB_STATE));
      console.log("Seeded initial database state to MongoDB.");
    }

    // Run dynamic sync check on cachedDbState (to ensure new defaults are added/synced)
    let updated = false;

    if (!cachedDbState.categories) cachedDbState.categories = [];
    DEFAULT_CATEGORIES.forEach(defaultCat => {
      const existingCatIndex = cachedDbState.categories.findIndex(c => c.id === defaultCat.id);
      if (existingCatIndex === -1) {
        cachedDbState.categories.push(defaultCat);
        updated = true;
      } else {
        const existing = cachedDbState.categories[existingCatIndex];
        if (existing.nameEn !== defaultCat.nameEn || existing.nameBn !== defaultCat.nameBn || existing.image !== defaultCat.image) {
          cachedDbState.categories[existingCatIndex] = { ...existing, ...defaultCat };
          updated = true;
        }
      }
    });

    if (!cachedDbState.products) cachedDbState.products = [];
    DEFAULT_PRODUCTS.forEach(defaultProd => {
      const existingProdIndex = cachedDbState.products.findIndex(p => p.id === defaultProd.id);
      if (existingProdIndex === -1) {
        cachedDbState.products.push(defaultProd);
        updated = true;
      } else {
        const existing = cachedDbState.products[existingProdIndex];
        let hasDiff = false;
        const fieldsToSync = ["nameEn", "nameBn", "descriptionEn", "descriptionBn", "category", "costUSD", "priceUSD", "discountPercent"];
        fieldsToSync.forEach(field => {
          if (existing[field] !== defaultProd[field]) {
            existing[field] = defaultProd[field];
            hasDiff = true;
          }
        });
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
          cachedDbState.products[existingProdIndex] = existing;
          updated = true;
        }
      }
    });

    if (!cachedDbState.users) cachedDbState.users = [];
    DEFAULT_USERS.forEach(defaultUser => {
      const existingUserIndex = cachedDbState.users.findIndex(u => u.email === defaultUser.email);
      if (existingUserIndex === -1) {
        cachedDbState.users.push(defaultUser);
        updated = true;
      } else {
        const existing = cachedDbState.users[existingUserIndex];
        let hasDiff = false;
        const userFields = ["name", "phone", "address", "avatar", "password"];
        userFields.forEach(field => {
          if (existing[field] !== defaultUser[field]) {
            existing[field] = defaultUser[field];
            hasDiff = true;
          }
        });
        if (hasDiff) {
          cachedDbState.users[existingUserIndex] = existing;
          updated = true;
        }
      }
    });

    if (updated) {
      await col.replaceOne({ _id: "current_state" }, { ...cachedDbState }, { upsert: true });
      console.log("Persisted updated default seed changes to MongoDB.");
    }
  } catch (err) {
    console.error("Failed to connect to MongoDB, falling back to local file:", err);
    useMongo = false;
  }
}

// Read database
function getDb() {
  if (useMongo && cachedDbState) {
    return cachedDbState;
  }

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
  if (useMongo && mongoDb) {
    cachedDbState = data;
    const col = mongoDb.collection("state");
    col.replaceOne({ _id: "current_state" }, { ...data }, { upsert: true })
      .then(() => {
        console.log("Database state successfully persisted to MongoDB.");
      })
      .catch(err => {
        console.error("Failed to persist database state to MongoDB:", err);
      });
    return true;
  }

  try {
    initDb();
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
  connectMongo,
  getDb,
  saveDb
};
