// routes/analytics.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");

// Get overall dashboard stats
router.get("/stats", (req, res) => {
  const db = getDb();
  
  const orders = db.orders;
  const products = db.products;
  const traffic = db.traffic;
  const logs = db.logs;

  // 1. Core financial stats
  const totalSales = orders.reduce((sum, o) => sum + o.totalUSD, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.costUSD, 0);
  const netProfit = totalSales - totalCost;
  const avgOrderValue = orders.length > 0 ? (totalSales / orders.length) : 0;

  // 2. Traffic rate conversion benchmark
  const totalVisitors = traffic.reduce((sum, t) => sum + t.visitors, 0);
  const totalConversions = traffic.reduce((sum, t) => sum + t.conversions, 0);
  const conversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0;

  // 3. Category performance distribution metrics
  const categorySales = {};
  const categoryProfit = {};

  // Setup default categories
  const categories = ["cat_hot", "cat_women", "cat_men", "cat_shoes", "cat_watches", "cat_kids"];
  categories.forEach(c => {
    categorySales[c] = 0;
    categoryProfit[c] = 0;
  });

  orders.forEach(order => {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const categories = Array.isArray(prod?.category) ? prod.category : (prod?.category ? [prod.category] : ["other"]);

      const costPrice = prod ? prod.costUSD : (item.priceUSD * 0.5);
      const sellPrice = item.priceUSD;

      const salesVal = sellPrice * item.quantity;
      const profitVal = salesVal - (costPrice * item.quantity);

      categories.forEach(category => {
        if (categorySales[category] !== undefined) {
          categorySales[category] += salesVal;
          categoryProfit[category] += profitVal;
        } else {
          categorySales[category] = salesVal;
          categoryProfit[category] = profitVal;
        }
      });
    });
  });

  // 4. Return logs list sorted by recency
  const sortedLogs = [...logs].reverse().slice(0, 15);

  res.status(200).json({
    kpis: {
      totalSales: Number(totalSales.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      totalVisitors
    },
    categorySales,
    categoryProfit,
    traffic,
    recentLogs: sortedLogs
  });
});

// Trigger a mock storefront purchase simulation
router.post("/simulate", (req, res) => {
  const db = getDb();
  if (db.products.length === 0) {
    return res.status(400).json({ error: "Cannot simulate purchase. Product catalog is empty." });
  }

  // Pick a random product
  const randomProduct = db.products[Math.floor(Math.random() * db.products.length)];
  const names = ["Sabbir Ahmed", "Nusrat Jahan", "Kamrul Islam", "Fariha Sultana", "Jamil Hossain", "Sadia Afrin"];
  const cities = ["Uttara, Dhaka", "Mirpur-10, Dhaka", "Sylhet Sadar, Sylhet", "Khulna City, Khulna", "Rajshahi Town, Rajshahi"];
  
  const randomName = names[Math.floor(Math.random() * names.length)];
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  const quantity = Math.floor(Math.random() * 2) + 1;
  const randomSize = randomProduct.sizes[Math.floor(Math.random() * randomProduct.sizes.length)] || "M";
  const randomColor = randomProduct.colors[Math.floor(Math.random() * randomProduct.colors.length)] || { nameEn: "Default" };

  const itemTotal = Number((randomProduct.priceUSD * quantity).toFixed(2));
  const costTotal = Number((randomProduct.costUSD * quantity).toFixed(2));

  // Create simulated purchase order
  const newOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: randomName,
    customerEmail: `${randomName.toLowerCase().replace(/\s/g, "")}@mock.com`,
    customerAddress: `${randomCity}, Bangladesh`,
    items: [
      {
        productId: randomProduct.id,
        nameEn: randomProduct.nameEn,
        nameBn: randomProduct.nameBn,
        priceUSD: randomProduct.priceUSD,
        quantity,
        size: randomSize,
        colorEn: randomColor.nameEn
      }
    ],
    totalUSD: itemTotal,
    costUSD: costTotal,
    createdAt: new Date().toISOString(),
    status: "Pending",
    paymentMethod: "Cash on Delivery"
  };

  // Decrement catalog stock
  randomProduct.stock = Math.max(0, randomProduct.stock - quantity);

  // Prepend simulated order
  db.orders.unshift(newOrder);

  // Add conversion metrics to today's traffic
  const today = new Date();
  const dateStr = today.toLocaleString("en-US", { day: "2-digit", month: "short" }); // e.g. "06 Jul"
  let todayTraffic = db.traffic.find(t => t.date.toLowerCase() === dateStr.toLowerCase());

  if (!todayTraffic) {
    todayTraffic = {
      date: dateStr,
      visitors: Math.floor(Math.random() * 5) + 1,
      pageViews: Math.floor(Math.random() * 15) + 5,
      conversions: 0
    };
    db.traffic.push(todayTraffic);
    if (db.traffic.length > 7) {
      db.traffic.shift();
    }
  }
  todayTraffic.conversions += 1;
  todayTraffic.visitors += Math.floor(Math.random() * 3) + 1;
  todayTraffic.pageViews += Math.floor(Math.random() * 10) + 5;

  // Add log
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Simulation Triggered",
    details: `Customer simulation: ${randomName} purchased ${quantity}x "${randomProduct.nameEn}".`
  });

  saveDb(db);

  res.status(201).json({
    message: "Purchase simulated successfully",
    order: newOrder
  });
});

module.exports = router;
