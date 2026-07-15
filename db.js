// db.js — Serverless-safe MongoDB storage using separate collections
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

let mongoClient = null;
let mongoDb = null;
let useMongo = false;

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER || process.env.NODE_ENV === "production";
const dataDir = isVercel ? "/tmp" : path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

// ─── Default seed data ───────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { id: "cat_hot",     nameEn: "Hot Sale",        nameBn: "হট সেল",                    image: "/images/categories/hot.png" },
  { id: "cat_women",   nameEn: "Women's Fashion",  nameBn: "মহিলাদের ফ্যাশন",           image: "/images/categories/women.png" },
  { id: "cat_men",     nameEn: "Men's Fashion",    nameBn: "পুরুষদের ফ্যাশন",           image: "/images/categories/men.png" },
  { id: "cat_shoes",   nameEn: "Shoes",            nameBn: "জুতো",                      image: "/images/categories/shoes.png" },
  { id: "cat_watches", nameEn: "Watches & Acc.",   nameBn: "ঘড়ি ও অ্যাক্সেসরিজ",      image: "/images/categories/watches.png" },
  { id: "cat_kids",    nameEn: "Kids & Toys",      nameBn: "বাচ্চাদের খেলনা ও পোশাক",  image: "/images/categories/kids.png" }
];

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
    password: "12345678"
  }
];

const DEFAULT_DB_STATE = {
  categories: DEFAULT_CATEGORIES,
  products: [],
  orders: [],
  traffic: DEFAULT_TRAFFIC,
  users: DEFAULT_USERS,
  logs: [{ timestamp: new Date().toISOString(), action: "System Initialization", details: "Backend seeded." }],
  flashSaleEnd: null,
  settings: {}
};

// ─── MongoDB connection ───────────────────────────────────────────────────────

async function connectMongo() {
  // Already connected
  if (useMongo && mongoClient && mongoDb) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI — using local JSON file.");
    useMongo = false;
    return;
  }

  try {
    console.log("Connecting to MongoDB Atlas...");
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db("fashion_legacy_db");
    useMongo = true;
    console.log("Connected to MongoDB Atlas successfully!");

    // Seed each collection if empty (first-time only, never overwrites)
    await seedCollectionIfEmpty("categories", DEFAULT_CATEGORIES);
    await seedCollectionIfEmpty("traffic", DEFAULT_TRAFFIC);
    await seedCollectionIfEmpty("users", DEFAULT_USERS);
    // products, orders, logs start empty — only user adds them

    const catCount = await mongoDb.collection("categories").countDocuments();
    const prodCount = await mongoDb.collection("products").countDocuments();
    console.log(`DB ready: ${catCount} categories, ${prodCount} products.`);
  } catch (err) {
    console.error("Critical: MongoDB connection failed:", err);
    useMongo = false;
    throw err;
  }
}

async function seedCollectionIfEmpty(name, defaults) {
  const col = mongoDb.collection(name);
  const count = await col.countDocuments();
  if (count === 0) {
    await col.insertMany(defaults.map(d => ({ ...d })));
    console.log(`Seeded '${name}' with ${defaults.length} default records.`);
  }
}

// Cache variables to prevent redundant MongoDB Atlas queries on parallel/rapid API requests
const cache = {
  categories: { data: null, timestamp: 0 },
  products: { data: null, timestamp: 0 },
  orders: { data: null, timestamp: 0 },
  traffic: { data: null, timestamp: 0 },
  users: { data: null, timestamp: 0 },
  logs: { data: null, timestamp: 0 },
  meta: { data: null, timestamp: 0 }
};
const CACHE_TTL_MS = 10000; // Cache database collections independently for 10 seconds
let lastKnownDb = null;

// ─── getDb — assembles a plain object from live MongoDB collections ──────────

async function getDb() {
  if (!useMongo || !mongoDb) {
    return getDbLocal();
  }
  
  const now = Date.now();
  
  const collections = [
    { name: "categories", query: () => mongoDb.collection("categories").find({}, { projection: { _id: 0 } }).toArray() },
    { name: "products", query: () => mongoDb.collection("products").find({}, { projection: { _id: 0 } }).toArray() },
    { name: "orders", query: () => mongoDb.collection("orders").find({}, { projection: { _id: 0 } }).toArray() },
    { name: "traffic", query: () => mongoDb.collection("traffic").find({}, { projection: { _id: 0 } }).toArray() },
    { name: "users", query: () => mongoDb.collection("users").find({}, { projection: { _id: 0 } }).toArray() },
    { name: "logs", query: () => mongoDb.collection("logs").find({}, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(100).toArray() }
  ];

  try {
    const results = await Promise.all(collections.map(async col => {
      if (cache[col.name] && cache[col.name].data !== null && (now - cache[col.name].timestamp < CACHE_TTL_MS)) {
        return cache[col.name].data;
      }
      const data = await col.query();
      cache[col.name] = { data, timestamp: now };
      return data;
    }));

    let meta;
    if (cache.meta && cache.meta.data !== null && (now - cache.meta.timestamp < CACHE_TTL_MS)) {
      meta = cache.meta.data;
    } else {
      meta = await mongoDb.collection("meta").findOne({ _id: "settings" });
      cache.meta = { data: meta, timestamp: now };
    }

    const dbState = {
      categories: results[0],
      products: results[1],
      orders: results[2],
      traffic: results[3],
      users: results[4],
      logs: results[5],
      flashSaleEnd: meta ? meta.flashSaleEnd : null,
      settings: meta ? meta.settings : {}
    };

    lastKnownDb = dbState;
    return dbState;
  } catch (err) {
    console.error("getDb error:", err);
    
    // Invalidate caches on query error so next request tries again
    for (const key in cache) {
      cache[key] = { data: null, timestamp: 0 };
    }

    if (lastKnownDb) {
      console.warn("getDb: Falling back to last known in-memory database state.");
      return lastKnownDb;
    }
    
    return getDbLocal();
  }
}

// ─── saveDb — writes changed data back to the correct MongoDB collection ─────
// `data` is the full state object (as returned by getDb).
// We diff against existing collections and apply targeted updates.

async function saveDb(data) {
  const now = Date.now();
  
  // Immediately update/write-through to the cache so subsequent reads see the update
  if (data.categories !== undefined) cache.categories = { data: data.categories, timestamp: now };
  if (data.products !== undefined) cache.products = { data: data.products, timestamp: now };
  if (data.orders !== undefined) cache.orders = { data: data.orders, timestamp: now };
  if (data.traffic !== undefined) cache.traffic = { data: data.traffic, timestamp: now };
  if (data.users !== undefined) cache.users = { data: data.users, timestamp: now };
  if (data.logs !== undefined) cache.logs = { data: data.logs, timestamp: now };
  if (data.flashSaleEnd !== undefined || data.settings !== undefined) {
    cache.meta = {
      data: {
        _id: "settings",
        flashSaleEnd: data.flashSaleEnd || null,
        settings: data.settings || {}
      },
      timestamp: now
    };
  }

  // Update lastKnownDb state
  lastKnownDb = {
    categories: cache.categories.data || [],
    products: cache.products.data || [],
    orders: cache.orders.data || [],
    traffic: cache.traffic.data || [],
    users: cache.users.data || [],
    logs: cache.logs.data || [],
    flashSaleEnd: cache.meta.data ? cache.meta.data.flashSaleEnd : null,
    settings: cache.meta.data ? cache.meta.data.settings : {}
  };

  if (!useMongo || !mongoDb) {
    return saveDbLocal(data);
  }
  try {
    const ops = [];

    // categories — replace entire collection contents atomically and safely
    if (data.categories !== undefined) {
      ops.push(replaceCollectionSafe("categories", data.categories, "id"));
    }
    // products — replace entire collection contents atomically and safely
    if (data.products !== undefined) {
      ops.push(replaceCollectionSafe("products", data.products, "id"));
    }
    // orders
    if (data.orders !== undefined) {
      ops.push(replaceCollectionSafe("orders", data.orders, "id"));
    }
    // traffic
    if (data.traffic !== undefined) {
      ops.push(replaceCollectionSafe("traffic", data.traffic, "date"));
    }
    // users
    if (data.users !== undefined) {
      ops.push(replaceCollectionSafe("users", data.users, "email"));
    }
    // logs — just push new ones (don't rewrite all)
    if (data.logs && data.logs.length > 0) {
      const latestLog = data.logs[data.logs.length - 1];
      ops.push(mongoDb.collection("logs").insertOne({ ...latestLog }));
    }
    // meta (flashSaleEnd, settings)
    ops.push(mongoDb.collection("meta").updateOne(
      { _id: "settings" },
      { $set: { flashSaleEnd: data.flashSaleEnd || null, settings: data.settings || {} } },
      { upsert: true }
    ));

    await Promise.all(ops);
    console.log("saveDb: all collections updated successfully.");
    return true;
  } catch (err) {
    console.error("saveDb error:", err);
    return false;
  }
}

async function replaceCollectionSafe(name, items, keyField = "id") {
  const col = mongoDb.collection(name);
  if (!items || items.length === 0) {
    await col.deleteMany({});
    return;
  }

  // 1. Upsert all new/updated items
  const upsertOps = items.map(item => col.updateOne(
    { [keyField]: item[keyField] },
    { $set: item },
    { upsert: true }
  ));
  await Promise.all(upsertOps);

  // 2. Delete any items not in the new list
  const activeKeys = items.map(item => item[keyField]);
  await col.deleteMany({ [keyField]: { $nin: activeKeys } });
}

// ─── Local JSON fallback (development only) ───────────────────────────────────

function initDb() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      const bundledDbPath = path.join(__dirname, "data/db.json");
      if (isVercel && fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, dbPath);
      } else {
        fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB_STATE, null, 2), "utf8");
      }
    }
  } catch (err) {
    console.error("initDb error:", err);
  }
}

function getDbLocal() {
  initDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (err) {
    return JSON.parse(JSON.stringify(DEFAULT_DB_STATE));
  }
}

function saveDbLocal(data) {
  try {
    initDb();
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempPath, dbPath);
    return true;
  } catch (err) {
    console.error("saveDbLocal error:", err);
    return false;
  }
}

module.exports = { connectMongo, getDb, saveDb };
