# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Express.js REST API backend for the Fashion Legacy e-commerce website (storefront)
and its admin dashboard. Serves both frontends from a single API. Deployed as a
Vercel serverless function; runs as a normal Node process locally.

## Commands

- `npm run dev` — local development with `nodemon` (auto-restart; ignores `data/` so DB writes don't trigger reloads)
- `npm start` — plain `node server.js`
- No test suite, linter, or build step exists. Do not invent commands for them.

There is no per-test command because there are no tests.

## Environment

Config comes from `.env` (loaded via `dotenv`). Keys:

- `MONGODB_URI` — when set, the app uses MongoDB Atlas. When **absent**, it silently falls back to a local JSON file (`data/db.json`). This fallback is the single most important behavioral switch in the codebase.
- `PORT` (default 5000), `WEBSITE_URL`, `DASHBOARD_URL` (added to the CORS allowlist).

## Architecture

### Storage abstraction (`db.js`) — read this first

All persistence goes through three functions: `connectMongo()`, `getDb()`, `saveDb(data)`.
Routes never touch MongoDB directly — they call `getDb()`, mutate the returned plain
object, then call `saveDb(db)`.

Critical mental model: **`getDb()` returns a single denormalized snapshot object**
(`{ categories, products, orders, traffic, users, logs, flashSaleEnd, settings }`)
assembled from separate MongoDB collections. `saveDb()` takes that whole object back
and diffs it into the collections. This means route handlers treat the database like
one big in-memory JSON blob even though it is really per-collection storage.

- **Two backends behind one interface:** MongoDB (collections `categories`, `products`, `orders`, `traffic`, `users`, `logs`, `meta`) OR a local `data/db.json` file. `useMongo` decides which at runtime based on `MONGODB_URI`. On Vercel the local file lives in `/tmp` (ephemeral, resets between cold starts).
- **Caching:** `getDb()` caches each collection independently for `CACHE_TTL_MS` (10s). `saveDb()` write-throughs the cache immediately so subsequent reads see fresh data. On a Mongo query error, caches are invalidated and it falls back to `lastKnownDb` (last successful snapshot) and then to the local JSON file.
- **`saveDb` semantics per collection:** `categories`/`products`/`orders`/`traffic`/`users` are fully replaced via `replaceCollectionSafe()` (upsert every item by a key field, then delete anything not in the new list — non-destructive so parallel dashboard reads don't flicker). Key fields differ: `id` for most, `date` for traffic, `email` for users. `logs` are **append-only** (only the last log entry is inserted, never rewritten). `flashSaleEnd`/`settings` live in the `meta` collection under `_id: "settings"`.
- Seeding happens once on first connect via `seedCollectionIfEmpty()` — it never overwrites existing data.

### Request flow (`server.js`)

- A global middleware calls `connectMongo()` on **every request** (required because Vercel serverless cold-starts drop the connection). If Mongo is configured and fails, it returns 500; if not configured, it proceeds to the JSON fallback.
- CORS: static allowlist (`fashionlegacy.live`, dashboard, localhost:3000–3002, plus `WEBSITE_URL`/`DASHBOARD_URL`) **plus** a dynamic `isLocalOrigin()` check that permits any localhost/private-LAN origin.
- Body limit is **15mb** — deliberately large because images are uploaded as base64 in the JSON body.
- The server only calls `app.listen()` when `NODE_ENV !== "production"`. In production it exports the `app` for Vercel to invoke. Keep this guard intact.

### Routes (`routes/*.js`, mounted under `/api/*`)

`auth`, `products`, `orders`, `analytics`, `categories`. Flash-sale endpoints live inline in `server.js`. All follow the same `getDb → mutate → saveDb` pattern and push an entry to `db.logs` on every mutation (these logs power the dashboard's activity feed and analytics).

- **`analytics.js`** is read-heavy: `/stats` computes KPIs (sales, cost, profit, conversion rate) and per-category breakdowns on the fly from orders/products/traffic. `/simulate` fabricates a mock order for demos.
- **`orders.js`** decrements product stock on checkout and bumps the current day's `traffic` row (traffic is kept to a rolling 7 entries).
- Products and categories may have a **multi-category** `category` field (array or string) — analytics and product-creation code handle both shapes; preserve that when editing.

### Image uploads — production vs local split

This pattern repeats in `products.js` (`/upload`) and `categories.js` (`saveBase64Image`).
In Vercel/production the base64 data URI is stored **directly in the database** (disk is
ephemeral). Locally, base64 is decoded and written to `public/uploads/` and a
`/uploads/...` path is returned instead. Any new image-handling code must honor this
`process.env.VERCEL || NODE_ENV === "production"` branch.

## Conventions & gotchas

- Bilingual content everywhere: fields come in `nameEn`/`nameBn`, `descriptionEn`/`descriptionBn` pairs (Bn = Bangla).
- Prices are stored in USD (`costUSD`, `priceUSD`); shipping is a hardcoded BDT→USD conversion (`80/120`, `150/120`). Log/UI strings sometimes show `৳` (Taka).
- Auth is intentionally minimal and **not secure**: passwords are plaintext, admin login is two hardcoded passwords in `auth.js`, and `login`/`register` auto-create users. This is a demo/prototype backend — don't assume real auth exists, but don't "fix" it into a different contract without being asked.
- IDs are generated from timestamps/category slugs (e.g. `prod-women-1234`, `ORD-4821`), not Mongo `_id` (which is stripped from all reads via `projection: { _id: 0 }`).
- `type: "commonjs"` — use `require`, not `import`.
