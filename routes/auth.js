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

  const db = await getDb();
  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) return res.status(400).json({ error: "Email is already registered. Please log in." });

  const newUser = { name: name.trim(), email: email.trim(), phone: phone.trim(), address: "", avatar: "avatar_women", password: "password123" };
  db.users.push(newUser);
  db.logs.push({ timestamp: new Date().toISOString(), action: "User Signup", details: `Customer ${newUser.name} (${newUser.email}) registered.` });

  await saveDb(db);
  res.status(201).json({ message: "Registration successful", user: { name: newUser.name, email: newUser.email, phone: newUser.phone, address: newUser.address, avatar: newUser.avatar } });
});

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const db = await getDb();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    user = { name: "Raihan Chowdhury", email: email.trim().toLowerCase(), phone: "01712345678", address: "House 14, Road 5, Uttara Sector 4, Dhaka", avatar: "avatar_men", password: password || "password123" };
    db.users.push(user);
    db.logs.push({ timestamp: new Date().toISOString(), action: "Auto User Registration", details: `Auto-created profile for ${user.email}.` });
    await saveDb(db);
  }

  res.status(200).json({ message: "Login successful", user: { name: user.name, email: user.email, phone: user.phone, address: user.address, avatar: user.avatar } });
});

// Update User Profile
router.post("/profile", async (req, res) => {
  const { email, name, phone, address, avatar } = req.body;
  if (!email) return res.status(400).json({ error: "User email is required to update profile." });

  const db = await getDb();
  const userIndex = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (userIndex === -1) return res.status(404).json({ error: "User not found." });

  if (name) db.users[userIndex].name = name.trim();
  if (phone) db.users[userIndex].phone = phone.trim();
  if (address !== undefined) db.users[userIndex].address = address.trim();
  if (avatar) db.users[userIndex].avatar = avatar;

  db.logs.push({ timestamp: new Date().toISOString(), action: "Profile Update", details: `Customer ${db.users[userIndex].name} (${email}) updated profile.` });
  await saveDb(db);

  res.status(200).json({ message: "Profile updated successfully", user: { name: db.users[userIndex].name, email: db.users[userIndex].email, phone: db.users[userIndex].phone, address: db.users[userIndex].address, avatar: db.users[userIndex].avatar } });
});

// Initial Default Admins List
const DEFAULT_ADMIN_USERS = [
  {
    id: "adm-1",
    name: "Raihan Chowdhury",
    email: "raihan@fashionlegacy.live",
    phone: "01712345678",
    role: "Lead Administrator",
    avatar: "avatar_men",
    status: "Active",
    lastLogin: "2026-08-31T08:00:00.000Z"
  },
  {
    id: "adm-2",
    name: "Shamim Ahsan (Sajol)",
    email: "sajol@fashionlegacy.live",
    phone: "01779024048",
    role: "Lead Administrator",
    avatar: "avatar_men",
    status: "Active",
    lastLogin: "2026-08-31T07:45:00.000Z"
  },
  {
    id: "adm-3",
    name: "Abu Kawsar",
    email: "abu@fashionlegacy.live",
    phone: "01812345678",
    role: "Store Manager",
    avatar: "avatar_men",
    status: "Active",
    lastLogin: "2026-08-30T14:20:00.000Z"
  },
  {
    id: "adm-4",
    name: "Nusrat Jahan",
    email: "nusrat@fashionlegacy.live",
    phone: "01912345678",
    role: "Inventory Manager",
    avatar: "avatar_women",
    status: "Active",
    lastLogin: "2026-08-29T11:10:00.000Z"
  }
];

// Admin Authentication Login (Dashboard)
router.post("/admin/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required." });

  if (password === "sajolbd" || password === "abubd" || password === "admin123") {
    const db = await getDb();
    const name = password === "sajolbd" ? "Sajol" : password === "abubd" ? "Abu Kawsar" : "Raihan Chowdhury";
    const email = password === "sajolbd" ? "sajol@fashionlegacy.live" : password === "abubd" ? "abu@fashionlegacy.live" : "raihan@fashionlegacy.live";
    const admin = { name, email, role: "Lead Administrator", avatar: "avatar_men", lastLogin: new Date().toISOString() };
    db.logs.push({ timestamp: new Date().toISOString(), action: "Admin Portal Authentication", details: `Admin session unlocked by ${name} (${email}).` });
    await saveDb(db);
    return res.status(200).json({ success: true, message: "Admin authenticated successfully", admin });
  }

  res.status(401).json({ success: false, error: "Incorrect password. Access denied." });
});

// GET /api/auth/admin/users — List all admin users
router.get("/admin/users", async (req, res) => {
  const db = await getDb();
  if (!db.adminUsers || db.adminUsers.length === 0) {
    db.adminUsers = DEFAULT_ADMIN_USERS;
    await saveDb(db);
  }
  res.status(200).json(db.adminUsers);
});

// POST /api/auth/admin/users — Add a new admin user
router.post("/admin/users", async (req, res) => {
  const { name, email, phone, role, password, avatar } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }

  const db = await getDb();
  if (!db.adminUsers) db.adminUsers = [...DEFAULT_ADMIN_USERS];

  const existing = db.adminUsers.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "An admin user with this email already exists." });
  }

  const newAdmin = {
    id: `adm-${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : "01700000000",
    role: role || "Store Manager",
    password: password || "admin123",
    avatar: avatar || "avatar_men",
    status: "Active",
    lastLogin: new Date().toISOString()
  };

  db.adminUsers.push(newAdmin);
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Admin User Created",
    details: `Added new admin: ${newAdmin.name} (${newAdmin.email}) as ${newAdmin.role}`
  });

  await saveDb(db);
  res.status(201).json({ message: "Admin user created successfully", admin: newAdmin });
});

// PUT /api/auth/admin/users/:id — Update admin user
router.put("/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, role, status, avatar } = req.body;

  const db = await getDb();
  if (!db.adminUsers) db.adminUsers = [...DEFAULT_ADMIN_USERS];

  const index = db.adminUsers.findIndex(a => a.id === id || a.email.toLowerCase() === id.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: "Admin user not found." });
  }

  if (name) db.adminUsers[index].name = name.trim();
  if (phone) db.adminUsers[index].phone = phone.trim();
  if (role) db.adminUsers[index].role = role;
  if (status) db.adminUsers[index].status = status;
  if (avatar) db.adminUsers[index].avatar = avatar;

  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Admin User Updated",
    details: `Updated admin profile for ${db.adminUsers[index].name}`
  });

  await saveDb(db);
  res.status(200).json({ message: "Admin user updated", admin: db.adminUsers[index] });
});

// DELETE /api/auth/admin/users/:id — Delete admin user
router.delete("/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (!db.adminUsers) db.adminUsers = [...DEFAULT_ADMIN_USERS];

  const index = db.adminUsers.findIndex(a => a.id === id || a.email.toLowerCase() === id.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: "Admin user not found." });
  }

  const deleted = db.adminUsers.splice(index, 1)[0];
  db.logs.push({
    timestamp: new Date().toISOString(),
    action: "Admin User Removed",
    details: `Removed admin access for ${deleted.name} (${deleted.email})`
  });

  await saveDb(db);
  res.status(200).json({ message: "Admin user removed successfully" });
});

module.exports = router;
