# Fashion Legacy Backend — API Features

এই ডকুমেন্টে ব্যাকএন্ডের সব API সহজ ভাষায় বর্ণনা করা হয়েছে। This document describes every API of the backend in a simple, friendly way.

**Base URL (local):** `http://localhost:5000`

সব API-এর path শুরু হয় `/api/` দিয়ে (শুধু health check বাদে)। Response সবসময় JSON।

---

## 📑 এক নজরে সব API (Quick Overview)

| # | Method | Endpoint | কাজ (What it does) | কে ব্যবহার করে |
|---|--------|----------|--------------------|----------------|
| 1 | GET | `/` | সার্ভার ঠিকমতো চলছে কিনা চেক করা (Health check) | সবাই |
| 2 | POST | `/api/auth/register` | নতুন কাস্টমার সাইনআপ | Website |
| 3 | POST | `/api/auth/login` | কাস্টমার লগইন | Website |
| 4 | POST | `/api/auth/profile` | কাস্টমারের প্রোফাইল আপডেট | Website |
| 5 | POST | `/api/auth/admin/login` | অ্যাডমিন লগইন (Dashboard) | Dashboard |
| 6 | GET | `/api/products` | সব প্রোডাক্টের লিস্ট | Website + Dashboard |
| 7 | GET | `/api/products/:id` | একটা নির্দিষ্ট প্রোডাক্টের ডিটেইলস | Website |
| 8 | POST | `/api/products` | নতুন প্রোডাক্ট যোগ করা | Dashboard |
| 9 | PUT | `/api/products/:id` | প্রোডাক্ট এডিট করা | Dashboard |
| 10 | DELETE | `/api/products/:id` | প্রোডাক্ট ডিলিট করা | Dashboard |
| 11 | POST | `/api/products/upload` | প্রোডাক্টের ছবি আপলোড (base64) | Dashboard |
| 12 | GET | `/api/orders` | সব অর্ডারের লিস্ট | Dashboard |
| 13 | GET | `/api/orders/user/:email` | একজন কাস্টমারের সব অর্ডার | Website |
| 14 | POST | `/api/orders` | অর্ডার প্লেস করা (Checkout) | Website |
| 15 | PUT | `/api/orders/:id/status` | অর্ডারের স্ট্যাটাস বদলানো | Dashboard |
| 16 | GET | `/api/categories` | সব ক্যাটাগরির লিস্ট | Website + Dashboard |
| 17 | POST | `/api/categories` | নতুন ক্যাটাগরি যোগ করা | Dashboard |
| 18 | PUT | `/api/categories/:id` | ক্যাটাগরি এডিট করা | Dashboard |
| 19 | DELETE | `/api/categories/:id` | ক্যাটাগরি ডিলিট করা | Dashboard |
| 20 | GET | `/api/analytics/stats` | ড্যাশবোর্ডের সব রিপোর্ট/KPI | Dashboard |
| 21 | POST | `/api/analytics/simulate` | ডেমোর জন্য নকল অর্ডার তৈরি | Dashboard (Demo) |
| 22 | GET | `/api/flash-sale` | ফ্ল্যাশ সেল কাউন্টডাউনের সময় জানা | Website |
| 23 | POST | `/api/flash-sale` | ফ্ল্যাশ সেলের শেষ সময় সেট করা | Dashboard |

---

## 🏥 1. Health Check

### `GET /`
সার্ভার চালু আছে কিনা এবং কোন ডাটাবেস ব্যবহার হচ্ছে (MongoDB Atlas নাকি Local JSON) তা জানায়।

**Response example:**
```json
{
  "status": "healthy",
  "message": "Fashion Legacy Express.js Backend is running.",
  "database": "MongoDB Atlas (Live)",
  "timestamp": "2026-07-20T10:00:00.000Z"
}
```

---

## 🔐 2. Auth API (`/api/auth`)

কাস্টমার ও অ্যাডমিনের লগইন-সাইনআপ এখান থেকে হয়।

> ⚠️ **Note:** এটা ডেমো/প্রোটোটাইপ ব্যাকএন্ড — এখানে আসল সিকিউরিটি নেই (কোনো token/JWT নেই, পাসওয়ার্ড plaintext)।

### `POST /api/auth/register` — কাস্টমার সাইনআপ
নতুন কাস্টমার অ্যাকাউন্ট তৈরি করে। ইমেইল আগে থেকে থাকলে error দেয়।

**Request body:**
```json
{ "name": "Rahim Uddin", "email": "rahim@example.com", "phone": "01712345678" }
```
**Success (201):** নতুন user object সহ `"Registration successful"` মেসেজ।

### `POST /api/auth/login` — কাস্টমার লগইন
ইমেইল দিয়ে লগইন। মজার ব্যাপার: **ইউজার না থাকলে অটোমেটিক নতুন প্রোফাইল তৈরি হয়ে যায়** (ডেমোর সুবিধার জন্য), তাই লগইন কখনো fail করে না।

**Request body:**
```json
{ "email": "rahim@example.com", "password": "password123" }
```
**Success (200):** user object (name, email, phone, address, avatar)।

### `POST /api/auth/profile` — প্রোফাইল আপডেট
কাস্টমারের নাম, ফোন, ঠিকানা, অ্যাভাটার আপডেট করে। ইমেইল দিয়ে ইউজার খুঁজে নেয় (ইমেইল বদলানো যায় না)।

**Request body:**
```json
{ "email": "rahim@example.com", "name": "Rahim", "phone": "01812345678", "address": "Dhanmondi, Dhaka", "avatar": "avatar_men" }
```

### `POST /api/auth/admin/login` — অ্যাডমিন লগইন
শুধু পাসওয়ার্ড দিয়ে ড্যাশবোর্ডে ঢোকা যায়। দুইটা hardcoded পাসওয়ার্ড আছে (দুইজন অ্যাডমিনের জন্য)। ভুল পাসওয়ার্ডে **401** error।

**Request body:**
```json
{ "password": "•••••" }
```
**Success (200):** admin object (name, email, role, avatar, lastLogin)।

---

## 👕 3. Products API (`/api/products`)

প্রোডাক্ট দেখা, যোগ করা, এডিট, ডিলিট — সবকিছু এখানে।

### `GET /api/products` — সব প্রোডাক্ট
পুরো প্রোডাক্ট ক্যাটালগ একসাথে দেয়। Website-এর হোমপেজ ও Dashboard-এর প্রোডাক্ট লিস্ট এটা ব্যবহার করে।

### `GET /api/products/:id` — একটা প্রোডাক্ট
নির্দিষ্ট প্রোডাক্টের ফুল ডিটেইলস (প্রোডাক্ট ডিটেইল পেজের জন্য)। না পেলে **404**।

### `POST /api/products` — নতুন প্রোডাক্ট
অ্যাডমিন নতুন প্রোডাক্ট যোগ করে। ID অটো-জেনারেট হয় (যেমন `prod-women-4821`)।

**Request body (required fields):**
```json
{
  "nameEn": "Summer Dress",
  "nameBn": "সামার ড্রেস",
  "category": ["cat_women", "cat_hot"],
  "costUSD": 10,
  "priceUSD": 18,
  "stock": 50,
  "discountPercent": 10,
  "images": ["/uploads/product-123.jpg"],
  "sizes": ["M", "L"],
  "colors": [{ "nameEn": "Red", "nameBn": "লাল", "hex": "#ff0000" }]
}
```
- `category` একটা string বা array — দুটোই চলে (multi-category সাপোর্ট)।
- নাম দুই ভাষায় দিতে হয় (`nameEn` / `nameBn`)।

### `PUT /api/products/:id` — প্রোডাক্ট আপডেট
যে ফিল্ডগুলো পাঠাবেন শুধু সেগুলোই বদলাবে (partial update)। বাকি সব আগের মতোই থাকবে।

### `DELETE /api/products/:id` — প্রোডাক্ট ডিলিট
প্রোডাক্ট মুছে ফেলে। না পেলে **404**।

### `POST /api/products/upload` — ছবি আপলোড
Base64 ফরম্যাটে ছবি পাঠালে সেটা সেভ করে একটা image URL ফেরত দেয়।

**Request body:**
```json
{ "image": "data:image/jpeg;base64,/9j/4AAQ..." }
```
**কীভাবে কাজ করে:**
- **Local development:** ছবি `public/uploads/` ফোল্ডারে ফাইল হিসেবে সেভ হয়, `/uploads/product-xxx.jpg` path ফেরত দেয়।
- **Production (Vercel):** ডিস্ক ephemeral, তাই base64 string-টাই ফেরত দেয় (ডাটাবেসে সরাসরি সেভ হয়)।

---

## 📦 4. Orders API (`/api/orders`)

অর্ডার প্লেস করা এবং অর্ডার ম্যানেজমেন্ট।

### `GET /api/orders` — সব অর্ডার
সব অর্ডারের লিস্ট (নতুনগুলো আগে)। Dashboard-এর অর্ডার পেজ এটা ব্যবহার করে।

### `GET /api/orders/user/:email` — কাস্টমারের অর্ডার
নির্দিষ্ট ইমেইলের কাস্টমারের সব অর্ডার। Website-এর "My Orders" পেজের জন্য।

### `POST /api/orders` — অর্ডার প্লেস (Checkout)
এটা সবচেয়ে গুরুত্বপূর্ণ API। অর্ডার প্লেস করলে অটোমেটিক এই কাজগুলো হয়:
1. ✅ নতুন অর্ডার তৈরি হয় (ID যেমন `ORD-4821`, status `Pending`)
2. 📉 প্রতিটা প্রোডাক্টের **stock কমে যায়**
3. 💰 টোটাল দাম + শিপিং খরচ হিসাব হয় (ঢাকার ভেতরে ৳80, বাইরে ৳150 — USD-তে কনভার্ট করে)
4. 📈 আজকের **traffic/conversion** কাউন্ট বাড়ে (analytics-এর জন্য)
5. 📝 Activity log-এ এন্ট্রি যায়

**Request body:**
```json
{
  "customerName": "Rahim Uddin",
  "customerEmail": "rahim@example.com",
  "customerAddress": "Uttara, Dhaka",
  "items": [
    { "productId": "prod-women-4821", "nameEn": "Summer Dress", "priceUSD": 18, "quantity": 2, "size": "M", "colorEn": "Red" }
  ],
  "paymentMethod": "Cash on Delivery",
  "shippingArea": "inside"
}
```
- `shippingArea`: `"inside"` = ঢাকার ভেতরে (৳80), অন্য কিছু = ঢাকার বাইরে (৳150)।

### `PUT /api/orders/:id/status` — অর্ডার স্ট্যাটাস আপডেট
অ্যাডমিন অর্ডারের স্ট্যাটাস বদলায়। শুধু তিনটা ভ্যালু চলে: `Pending` → `Shipped` → `Delivered`।

**Request body:**
```json
{ "status": "Shipped" }
```

---

## 🗂️ 5. Categories API (`/api/categories`)

প্রোডাক্ট ক্যাটাগরি ম্যানেজমেন্ট (Women, Men, Shoes, Watches, Kids ইত্যাদি)।

### `GET /api/categories` — সব ক্যাটাগরি
সব ক্যাটাগরির লিস্ট (id, nameEn, nameBn, image)।

### `POST /api/categories` — নতুন ক্যাটাগরি
ইংরেজি নাম থেকে ID অটো-জেনারেট হয় (যেমন "Winter Wear" → `cat_winter_wear`)। ছবি base64 দিলে সেটাও সেভ হয় (products-এর upload-এর মতোই local/production লজিক)।

**Request body:**
```json
{ "nameEn": "Winter Wear", "nameBn": "শীতের পোশাক", "image": "data:image/png;base64,..." }
```

### `PUT /api/categories/:id` — ক্যাটাগরি আপডেট
নাম বা ছবি বদলানো যায় (partial update)।

### `DELETE /api/categories/:id` — ক্যাটাগরি ডিলিট
ক্যাটাগরি মুছে ফেলে। (এই ক্যাটাগরির প্রোডাক্টগুলো ডিলিট হয় না।)

---

## 📊 6. Analytics API (`/api/analytics`)

ড্যাশবোর্ডের রিপোর্ট ও পরিসংখ্যান।

### `GET /api/analytics/stats` — ড্যাশবোর্ড রিপোর্ট
এক কলেই ড্যাশবোর্ডের সব ডেটা পাওয়া যায়। প্রতিবার রিকোয়েস্টে লাইভ হিসাব হয়:

| ডেটা | ব্যাখ্যা |
|------|---------|
| `kpis.totalSales` | মোট বিক্রি (USD) |
| `kpis.totalCost` | মোট খরচ (USD) |
| `kpis.netProfit` | নিট লাভ (বিক্রি − খরচ) |
| `kpis.avgOrderValue` | গড় অর্ডার ভ্যালু |
| `kpis.conversionRate` | ভিজিটর থেকে কত % অর্ডার করেছে |
| `kpis.totalVisitors` | মোট ভিজিটর |
| `categorySales` | কোন ক্যাটাগরিতে কত বিক্রি |
| `categoryProfit` | কোন ক্যাটাগরিতে কত লাভ |
| `traffic` | শেষ ৭ দিনের ভিজিটর/পেজভিউ/কনভার্সন |
| `recentLogs` | সর্বশেষ ১৫টা activity (দাশবোর্ডের activity feed) |

### `POST /api/analytics/simulate` — ডেমো অর্ডার সিমুলেশন
ডেমো দেখানোর জন্য একটা **নকল অর্ডার** তৈরি করে — র‍্যান্ডম কাস্টমার নাম, র‍্যান্ডম প্রোডাক্ট, র‍্যান্ডম শহর। আসল checkout-এর মতোই stock কমায় ও traffic বাড়ায়। কোনো body লাগে না।

---

## ⚡ 7. Flash Sale API (`/api/flash-sale`)

Website-এর ফ্ল্যাশ সেল কাউন্টডাউন টাইমার।

### `GET /api/flash-sale` — কাউন্টডাউন সময় জানা
ফ্ল্যাশ সেল কখন শেষ হবে সেই timestamp দেয়। সেট করা না থাকলে ডিফল্ট: এখন থেকে ২৪ ঘণ্টা পরে।

**Response:**
```json
{ "flashSaleEnd": "2026-07-21T10:00:00.000Z" }
```

### `POST /api/flash-sale` — কাউন্টডাউন সেট করা
অ্যাডমিন নতুন শেষ-সময় সেট করে।

**Request body:**
```json
{ "flashSaleEnd": "2026-07-25T23:59:59.000Z" }
```

---

## 📌 কমন জিনিস (Common Patterns)

সব API-তে যে জিনিসগুলো কমন:

- **Response format:** সবসময় JSON। Error হলে `{ "error": "..." }` আকারে মেসেজ আসে।
- **Status codes:** `200` সফল, `201` নতুন কিছু তৈরি, `400` ভুল/অসম্পূর্ণ ইনপুট, `401` ভুল পাসওয়ার্ড, `404` খুঁজে পাওয়া যায়নি, `500` সার্ভার/ডাটাবেস সমস্যা।
- **Bilingual fields:** নাম/বর্ণনা দুই ভাষায় — `nameEn`/`nameBn`, `descriptionEn`/`descriptionBn`।
- **Activity logs:** প্রতিটা create/update/delete অ্যাকশনে অটোমেটিক log এন্ট্রি হয়, যেটা Dashboard-এর activity feed-এ দেখা যায়।
- **Currency:** দাম সবসময় USD-তে স্টোর হয় (`priceUSD`, `costUSD`); UI-তে টাকা (৳) দেখানো হয়।
- **Database:** `.env`-এ `MONGODB_URI` থাকলে MongoDB Atlas, না থাকলে local `data/db.json` ফাইল ব্যবহার হয়।
