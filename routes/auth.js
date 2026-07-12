// routes/auth.js
const express = require("express");
const router = express.Router();
const { getDb, saveDb } = require("../db");

// User Registration (Signup)
router.post("/register", async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Missing required fields (name, email, phone)." });
  }

  const db = getDb();
  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    return res.status(400).json({ error: "Email is already registered. Please log in." });
  }

  const newUser = {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: "",
    avatar: "avatar_women",
    password: "password123" // Default password for simplicity in mock
  };

  db.users.push(newUser);
  
  // Add audit log
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "User Signup",
    details: `Customer ${newUser.name} (${newUser.email}) registered a new account.`
  });

  await saveDb(db);

  res.status(201).json({
    message: "Registration successful",
    user: {
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      address: newUser.address,
      avatar: newUser.avatar
    }
  });
});

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const db = getDb();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  // Auto-generate profile if it does not exist to support painless sandbox testing
  if (!user) {
    user = {
      name: "Raihan Chowdhury",
      email: email.trim().toLowerCase(),
      phone: "01712345678",
      address: "House 14, Road 5, Uttara Sector 4, Dhaka",
      avatar: "avatar_men",
      password: password || "password123"
    };
    db.users.push(user);
    
    db.logs.push({
      timestamp: new Date().toISOString(),
      action: "Auto User Registration",
      details: `Sandbox auto-created customer profile for ${user.name} (${user.email}).`
    });

    await saveDb(db);
  }

  res.status(200).json({
    message: "Login successful",
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar
    }
  });
});

// Update User Profile
router.post("/profile", async (req, res) => {
  const { email, name, phone, address, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ error: "User email is required to update profile." });
  }

  const db = getDb();
  const userIndex = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  // Update properties if provided
  if (name) db.users[userIndex].name = name.trim();
  if (phone) db.users[userIndex].phone = phone.trim();
  if (address !== undefined) db.users[userIndex].address = address.trim();
  if (avatar) db.users[userIndex].avatar = avatar;

  // Add log
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Profile Update",
    details: `Customer ${db.users[userIndex].name} (${email}) updated profile details.`
  });

  await saveDb(db);

  res.status(200).json({
    message: "Profile updated successfully",
    user: {
      name: db.users[userIndex].name,
      email: db.users[userIndex].email,
      phone: db.users[userIndex].phone,
      address: db.users[userIndex].address,
      avatar: db.users[userIndex].avatar
    }
  });
});

// Admin Authentication Login (Dashboard)
router.post("/admin/login", async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  if (password === "sajolbd" || password === "abubd") {
    const db = getDb();
    const name = password === "sajolbd" ? "Sajol" : "Abu Kawsar";
    const email = password === "sajolbd" ? "sajol@fashionlegacy.live" : "abu@fashionlegacy.live";

    const admin = {
      name,
      email,
      role: "Lead Administrator",
      avatar: password === "sajolbd" ? "avatar_men" : "avatar_women",
      lastLogin: new Date().toISOString()
    };

    // Log admin authentication event
    db.logs.push({
      timestamp: new Date().toISOString(),
      action: "Admin Portal Authentication",
      details: `Admin session unlocked successfully by ${name} (${email}).`
    });

    await saveDb(db);

    return res.status(200).json({
      success: true,
      message: "Admin authenticated successfully",
      admin
    });
  }

  res.status(401).json({ success: false, error: "Incorrect password. Access denied." });
});

module.exports = router;
