// routes/orders.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");

// Get all orders (for dashboard)
router.get("/", (req, res) => {
  const db = getDb();
  res.status(200).json(db.orders);
});

// Get user orders by email
router.get("/user/:email", (req, res) => {
  const db = getDb();
  const email = req.params.email.toLowerCase();
  const userOrders = db.orders.filter(o => o.customerEmail.toLowerCase() === email);
  res.status(200).json(userOrders);
});

// Place order (checkout)
router.post("/", (req, res) => {
  const { customerName, customerEmail, customerAddress, items, paymentMethod, shippingArea } = req.body;

  if (!customerName || !customerEmail || !customerAddress || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required checkout fields." });
  }

  const db = getDb();

  // 1. Calculate prices and COGS on server side, check and decrement product stock levels
  let totalUSD = 0;
  let totalCostUSD = 0;

  const orderItems = items.map(item => {
    const dbProduct = db.products.find(p => p.id === item.productId);
    
    // Fallback default pricing if product is somehow deleted
    const costPrice = dbProduct ? dbProduct.costUSD : (item.priceUSD * 0.5);
    const sellPrice = dbProduct ? dbProduct.priceUSD : item.priceUSD;

    // Decrement stock if product exists
    if (dbProduct) {
      dbProduct.stock = Math.max(0, dbProduct.stock - item.quantity);
    }

    const itemTotalUSD = sellPrice * item.quantity;
    const itemTotalCostUSD = costPrice * item.quantity;

    totalUSD += itemTotalUSD;
    totalCostUSD += itemTotalCostUSD;

    return {
      productId: item.productId,
      nameEn: item.nameEn,
      nameBn: item.nameBn || item.nameEn,
      priceUSD: sellPrice,
      quantity: item.quantity,
      size: item.size || "M",
      colorEn: item.colorEn || "Default"
    };
  });

  // Calculate dynamic shipping cost ($0.67 USD for inside Dhaka, $1.25 USD for outside)
  const shippingCostUSD = shippingArea === "inside" ? 80 / 120 : 150 / 120;
  totalUSD += shippingCostUSD;
  totalCostUSD += shippingCostUSD; // shipping counts as both cost and revenue spread (net neutral)

  const newOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim().toLowerCase(),
    customerAddress: customerAddress.trim(),
    items: orderItems,
    totalUSD: Number(totalUSD.toFixed(2)),
    costUSD: Number(totalCostUSD.toFixed(2)),
    createdAt: new Date().toISOString(),
    status: "Pending",
    paymentMethod: paymentMethod || "Cash on Delivery"
  };

  db.orders.unshift(newOrder); // Prepend so it shows up first in lists

  // 2. Increment conversions for today's analytics traffic
  const today = new Date();
  const dateStr = today.toLocaleString("en-US", { day: "2-digit", month: "short" }); // e.g. "06 Jul"
  let todayTraffic = db.traffic.find(t => t.date.toLowerCase() === dateStr.toLowerCase());

  if (!todayTraffic) {
    // If date has rolled over, push a new traffic record
    todayTraffic = {
      date: dateStr,
      visitors: Math.floor(Math.random() * 5) + 1,
      pageViews: Math.floor(Math.random() * 15) + 5,
      conversions: 0
    };
    db.traffic.push(todayTraffic);
    // Keep list length within 7 days
    if (db.traffic.length > 7) {
      db.traffic.shift();
    }
  }
  todayTraffic.conversions += 1;
  todayTraffic.visitors += Math.floor(Math.random() * 3) + 1;
  todayTraffic.pageViews += Math.floor(Math.random() * 10) + 5;

  // Add system action log
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Order Placed",
    details: `Customer ${newOrder.customerName} placed order ${newOrder.id} for ৳${newOrder.totalUSD.toFixed(2)}.`
  });

  saveDb(db);

  res.status(201).json({
    message: "Order placed successfully",
    order: newOrder
  });
});

// Update order status (Pending -> Shipped -> Delivered)
router.put("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status || !["Pending", "Shipped", "Delivered"].includes(status)) {
    return res.status(400).json({ error: "Invalid status state. Must be 'Pending', 'Shipped', or 'Delivered'." });
  }

  const db = getDb();
  const orderIndex = db.orders.findIndex(o => o.id === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found." });
  }

  const oldStatus = db.orders[orderIndex].status;
  db.orders[orderIndex].status = status;

  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Order Status Updated",
    details: `Order ${req.params.id} state updated from ${oldStatus} to ${status}.`
  });

  saveDb(db);

  res.status(200).json({
    message: "Order status updated successfully",
    order: db.orders[orderIndex]
  });
});

module.exports = router;
