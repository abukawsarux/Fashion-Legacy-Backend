// db.js
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

// Default initial products (matching website and dashboard default categories and currency conversion logic)
const DEFAULT_PRODUCTS = [
  {
    id: "prod-hot-1",
    nameEn: "Chic Woolen Knitted Cardigan",
    nameBn: "চটকদার উলের বোনা কার্ডিগান",
    descriptionEn: "Wrap yourself in cozy luxury. Expertly knitted from extra-fine merino wool blend.",
    descriptionBn: "আরাম ও বিলাসিতার চমৎকার সংমিশ্রণ। অতিরিক্ত মিহি মেরিনো উলের মিশ্রণে তৈরি।",
    category: "cat_hot",
    costUSD: 28.50,
    priceUSD: 59.99,
    discountPercent: 50,
    images: ["/images/products/cardigan_1.png"],
    sizes: ["S", "M", "L"],
    colors: [
      { nameEn: "Creamy Beige", nameBn: "ক্রিম বেইজ", hex: "#F5F5DC" },
      { nameEn: "Dusty Rose", nameBn: "হালকা গোলাপী", hex: "#D8BFD8" }
    ],
    rating: 4.8,
    reviewsCount: 110,
    stock: 45
  },
  {
    id: "prod-hot-2",
    nameEn: "Casual Linen Shirt Long Sleeve",
    nameBn: "ক্যাজুয়াল লিনেন শার্ট ফুল হাতা",
    descriptionEn: "Stay fresh and fashionable in warmer weather. Loose, casual drape with spread collar.",
    descriptionBn: "গরমের আবহাওয়ায় থাকুন সতেজ ও স্টাইলিশ। ঢিলেঢালা আরামদায়ক ফিট।",
    category: "cat_hot",
    costUSD: 16.00,
    priceUSD: 39.99,
    discountPercent: 45,
    images: ["/images/products/linen_shirt_1.png"],
    sizes: ["M", "L", "XL"],
    colors: [
      { nameEn: "Ocean Blue", nameBn: "সাগর নীল", hex: "#4682B4" },
      { nameEn: "Desert Khaki", nameBn: "মরু খাকি", hex: "#F0E68C" }
    ],
    rating: 4.5,
    reviewsCount: 72,
    stock: 80
  },
  {
    id: "prod-women-1",
    nameEn: "Vintage Floral Summer Maxi Dress",
    nameBn: "ভিন্টেজ ফ্লোরাল সামার ম্যাক্সি ড্রেস",
    descriptionEn: "Experience supreme comfort and breezy elegance in our floral maxi dress.",
    descriptionBn: "আমাদের ভিন্টেজ ফ্লোরাল ম্যাক্সি ড্রেসে পাবেন অসাধারণ আরাম এবং স্নিগ্ধতা।",
    category: "cat_women",
    costUSD: 20.00,
    priceUSD: 49.99,
    discountPercent: 30,
    images: ["/images/products/maxi_dress_1.png"],
    sizes: ["S", "M", "L"],
    colors: [
      { nameEn: "Peach Puff", nameBn: "পিচ", hex: "#FFDAB9" },
      { nameEn: "Emerald", nameBn: "পান্না সবুজ", hex: "#50C878" }
    ],
    rating: 4.8,
    reviewsCount: 124,
    stock: 35
  },
  {
    id: "prod-men-1",
    nameEn: "Premium Urban Denim Jacket",
    nameBn: "প্রিমিয়াম আরবান ডেনিম জ্যাকেট",
    descriptionEn: "A timeless wardrobe staple. Crafted from premium organic cotton denim.",
    descriptionBn: "সব ঋতুর জন্য মানানসই ও চমৎকার পোশাক। প্রিমিয়াম কটন ডেনিম কাপড়ে তৈরি।",
    category: "cat_men",
    costUSD: 25.00,
    priceUSD: 59.99,
    discountPercent: 25,
    images: ["/images/products/denim_jacket_1.png"],
    sizes: ["M", "L", "XL"],
    colors: [
      { nameEn: "Classic Blue", nameBn: "ক্ল্যাসিক নীল", hex: "#3B5998" },
      { nameEn: "Charcoal Black", nameBn: "কয়লা কালো", hex: "#2B2B2B" }
    ],
    rating: 4.7,
    reviewsCount: 98,
    stock: 28
  },
  {
    id: "prod-shoes-1",
    nameEn: "Ultra-Lightweight Athletic Sneakers",
    nameBn: "আল্ট্রা-লাইটওয়েট অ্যাথলেটিক স্নিকার্স",
    descriptionEn: "Engineered for maximum speed and endurance. responsive foam cushions.",
    descriptionBn: "দৌড়ানো ও হাঁটার সময় সর্বোচ্চ গতি ও স্থায়িত্বের জন্য ডিজাইনকৃত।",
    category: "cat_shoes",
    costUSD: 35.00,
    priceUSD: 79.99,
    discountPercent: 40,
    images: ["/images/products/shoes_sneakers_1.png"],
    sizes: ["40", "41", "42", "43"],
    colors: [
      { nameEn: "Crimson Gold", nameBn: "লাল সোনালী", hex: "#B22234" },
      { nameEn: "Stealth Black", nameBn: "কালো", hex: "#111111" }
    ],
    rating: 4.9,
    reviewsCount: 156,
    stock: 50
  },
  {
    id: "prod-watch-1",
    nameEn: "Aero-Luxury Chronograph Watch",
    nameBn: "অ্যারো-লাক্সারি ক্রোনোগ্রাফ ঘড়ি",
    descriptionEn: "Make a powerful statement of style and precision. sapphire crystal glass.",
    descriptionBn: "আপনার ব্যক্তিত্ব ও সময়ানুবর্তিতার বহিঃপ্রকাশ। স্যাফায়ার ক্রিস্টাল গ্লাস।",
    category: "cat_watches",
    costUSD: 65.00,
    priceUSD: 149.99,
    discountPercent: 35,
    images: ["/images/luxury_watch_1.png"],
    sizes: ["One Size"],
    colors: [
      { nameEn: "Sapphire Gold", nameBn: "স্যাফায়ার গোল্ড", hex: "#D4AF37" },
      { nameEn: "Classic Silver", nameBn: "ক্ল্যাসিক সিলভার", hex: "#C0C0C0" }
    ],
    rating: 4.6,
    reviewsCount: 84,
    stock: 15
  },
  {
    id: "prod-kids-1",
    nameEn: "Kids Playtime Cotton Set",
    nameBn: "কিডস প্লে-টাইম কটন সেট",
    descriptionEn: "Cute and playful clothing set for kids, made from 100% organic cotton.",
    descriptionBn: "শিশুদের জন্য সুন্দর ও আরামদায়ক সুতি কাপড়ের সেট, যা ১০০% অর্গানিক কটন দ্বারা তৈরি।",
    category: "cat_kids",
    costUSD: 11.50,
    priceUSD: 29.99,
    discountPercent: 30,
    images: ["/images/kids_clothing_set_1.png"],
    sizes: ["2-3Y", "3-4Y", "4-5Y"],
    colors: [
      { nameEn: "Sunshine Yellow", nameBn: "রোদেলা হলুদ", hex: "#FFD700" },
      { nameEn: "Sky Blue", nameBn: "আকাশী নীল", hex: "#87CEEB" }
    ],
    rating: 4.7,
    reviewsCount: 52,
    stock: 60
  }
];

const DEFAULT_ORDERS = [
  {
    id: "ORD-2891",
    customerName: "Rifat Hasan",
    customerEmail: "rifat@gmail.com",
    customerAddress: "Dhanmondi, Dhaka, Bangladesh",
    items: [
      {
        productId: "prod-hot-1",
        nameEn: "Chic Woolen Knitted Cardigan",
        nameBn: "চটকদার উলের বোনা কার্ডিগান",
        priceUSD: 59.99,
        quantity: 1,
        size: "M",
        colorEn: "Creamy Beige"
      }
    ],
    totalUSD: 59.99,
    costUSD: 28.50,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "Pending"
  },
  {
    id: "ORD-2890",
    customerName: "Anika Rahman",
    customerEmail: "anika@yahoo.com",
    customerAddress: "Gulshan-2, Dhaka, Bangladesh",
    items: [
      {
        productId: "prod-women-1",
        nameEn: "Vintage Floral Summer Maxi Dress",
        nameBn: "ভিন্টেজ ফ্লোরাল সামার ম্যাক্সি ড্রেস",
        priceUSD: 49.99,
        quantity: 2,
        size: "S",
        colorEn: "Peach Puff"
      }
    ],
    totalUSD: 99.98,
    costUSD: 40.00,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    status: "Shipped"
  },
  {
    id: "ORD-2889",
    customerName: "Tahsan Chowdhury",
    customerEmail: "tahsan@outlook.com",
    customerAddress: "Nasirabad, Chittagong, Bangladesh",
    items: [
      {
        productId: "prod-shoes-1",
        nameEn: "Ultra-Lightweight Athletic Sneakers",
        nameBn: "আল্ট্রা-লাইটওয়েট অ্যাথলেটিক স্নিকার্স",
        priceUSD: 79.99,
        quantity: 1,
        size: "42",
        colorEn: "Stealth Black"
      },
      {
        productId: "prod-hot-2",
        nameEn: "Casual Linen Shirt Long Sleeve",
        nameBn: "ক্যাজুয়াল লিনেন শার্ট ফুল হাতা",
        priceUSD: 39.99,
        quantity: 1,
        size: "L",
        colorEn: "Ocean Blue"
      }
    ],
    totalUSD: 119.98,
    costUSD: 51.00,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: "Delivered"
  }
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

const DEFAULT_DB_STATE = {
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
    return JSON.parse(data);
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
