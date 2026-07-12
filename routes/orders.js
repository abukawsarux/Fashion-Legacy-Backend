// routes/orders.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");

// Get all orders (for dashboard)
router.get("/", async (req, res) => {
  const db = await getDb();
  res.status(200).json(db.orders);
});

// Get user orders by email
router.get("/user/:email", async (req, res) => {
  const db = await getDb();
  const email = req.params.email.toLowerCase();
  const userOrders = db.orders.filter(o => o.customerEmail.toLowerCase() === email);
  res.status(200).json(userOrders);
});

// Place order (checkout)
router.post("/", async (req, res) => {
  const { customerName, customerEmail, customerAddress, items, paymentMethod, shippingArea } = req.body;
  if (!customerName || !customerEmail || !customerAddress || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required checkout fields." });
  }

  const db = await getDb();
  let totalUSD = 0;
  let totalCostUSD = 0;

  const orderItems = items.map(item => {
    const dbProduct = db.products.find(p => p.id === item.productId);
    const costPrice = dbProduct ? dbProduct.costUSD : (item.priceUSD * 0.5);
    const sellPrice = dbProduct ? dbProduct.priceUSD : item.priceUSD;
    if (dbProduct) dbProduct.stock = Math.max(0, dbProduct.stock - item.quantity);
    totalUSD += sellPrice * item.quantity;
    totalCostUSD += costPrice * item.quantity;
    return { productId: item.productId, nameEn: item.nameEn, nameBn: item.nameBn || item.nameEn, priceUSD: sellPrice, quantity: item.quantity, size: item.size || "M", colorEn: item.colorEn || "Default" };
  });

  const shippingCostUSD = shippingArea === "inside" ? 80 / 120 : 150 / 120;
  totalUSD += shippingCostUSD;
  totalCostUSD += shippingCostUSD;

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

  db.orders.unshift(newOrder);

  const today = new Date();
  const dateStr = today.toLocaleString("en-US", { day: "2-digit", month: "short" });
  let todayTraffic = db.traffic.find(t => t.date.toLowerCase() === dateStr.toLowerCase());
  if (!todayTraffic) {
    todayTraffic = { date: dateStr, visitors: Math.floor(Math.random() * 5) + 1, pageViews: Math.floor(Math.random() * 15) + 5, conversions: 0 };
    db.traffic.push(todayTraffic);
    if (db.traffic.length > 7) db.traffic.shift();
  }
  todayTraffic.conversions += 1;
  todayTraffic.visitors += Math.floor(Math.random() * 3) + 1;
  todayTraffic.pageViews += Math.floor(Math.random() * 10) + 5;

  db.logs.push({ timestamp: new Date().toISOString(), action: "Order Placed", details: `Customer ${newOrder.customerName} placed order ${newOrder.id} for ৳${newOrder.totalUSD.toFixed(2)}.` });

  await saveDb(db);
  res.status(201).json({ message: "Order placed successfully", order: newOrder });
});

// Update order status
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status || !["Pending", "Shipped", "Delivered"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be 'Pending', 'Shipped', or 'Delivered'." });
  }

  const db = await getDb();
  const orderIndex = db.orders.findIndex(o => o.id === req.params.id);
  if (orderIndex === -1) return res.status(404).json({ error: "Order not found." });

  const oldStatus = db.orders[orderIndex].status;
  db.orders[orderIndex].status = status;
  db.logs.push({ timestamp: new Date().toISOString(), action: "Order Status Updated", details: `Order ${req.params.id} updated from ${oldStatus} to ${status}.` });

  await saveDb(db);
  res.status(200).json({ message: "Order status updated successfully", order: db.orders[orderIndex] });
});

module.exports = router;
