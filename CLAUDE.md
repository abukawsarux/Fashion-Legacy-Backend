# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Express.js REST API backend for the Fashion Legacy e-commerce website (storefront)
and its admin dashboard. Serves both frontends from a single API. Deployed as a
Vercel serverless function; runs as a normal Node process locally.

## Commands

- `npm run dev` — local development with `nodemon` (auto-restart; ignores `data/` so DB writes don't trigger reloads)
- `npm start` — plain `node server.js`
- `npm test` — contract smoke tests (`vitest` + `supertest`, `tests/contract.test.js`) against the local-JSON backend in an isolated temp dir (`DATA_DIR`); no port is opened, MongoDB is never touched. Keep these green — they lock the frontends' API contract.
- No linter or build step exists. Do not invent commands for them.

## Environment

Config comes from `.env`, loaded and validated by `config.js` (required first by
`server.js`; in `NODE_ENV=test` dotenv is skipped so tests control their own env).
Keys:

- `MONGODB_URI` — when set, the app uses MongoDB Atlas. When **absent**, it falls back to a local JSON file (`data/db.json`). This fallback is the single most important behavioral switch in the codebase. Production without it logs a loud startup warning (writes would land in ephemeral `/tmp`).
- `PORT` (default 5000), `WEBSITE_URL`, `DASHBOARD_URL` (added to the CORS allowlist).
- `ALLOW_LAN_ORIGINS=true` — re-enables private-LAN origins through production CORS (blocked by default).
- `STRICT_DB=true` — DB-connect failures return `503` instead of proceeding to the JSON fallback; also fail-fast at boot if production lacks `MONGODB_URI`.
- `DATA_DIR` — overrides the JSON-fallback directory (used by the test suite).

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
- **Caching:** `getDb()` caches each collection independently for `CACHE_TTL_MS` (10s) and returns a **`structuredClone` copy**, so handlers mutate private snapshots — never the cache itself. `saveDb()` commits the new state to the cache (`commitToCache`) **only after** the write succeeds; a failed write leaves the cache pristine. On a Mongo query error, caches are invalidated and it falls back to `lastKnownDb` (last successful snapshot) and then to the local JSON file. `logs` are normalized to **oldest-first** at the `getDb()` boundary on both backends (routes `push()` the newest entry onto the end).
- **`saveDb` semantics per collection:** `categories`/`products`/`orders`/`traffic`/`users` are fully replaced via `replaceCollectionSafe()` (upsert every item by a key field, then delete anything not in the new list — non-destructive so parallel dashboard reads don't flicker). Key fields differ: `id` for most, `date` for traffic, `email` for users. `logs` are **append-only** (only the last log entry is inserted, never rewritten). `flashSaleEnd`/`settings` live in the `meta` collection under `_id: "settings"`.
- Seeding happens once on first connect via `seedCollectionIfEmpty()` — it never overwrites existing data.

### Request flow (`server.js`)

- `config.js` is required first: it loads `.env` and validates the environment before `db.js` (which reads env at module load) is pulled in.
- A global middleware calls `connectMongo()` on **every request** (required because Vercel serverless cold-starts drop the connection). On failure it **proceeds to the JSON fallback** (deliberate), unless `STRICT_DB=true` — then it returns `503 {error}`.
- CORS: static allowlist (`fashionlegacy.live`, dashboard, localhost:3000–3002, plus `WEBSITE_URL`/`DASHBOARD_URL`). Non-production allows all origins (deliberate dev bypass). Private-LAN origins (`isLocalOrigin()`) are allowed in production only when `ALLOW_LAN_ORIGINS=true`.
- Security middleware: `helmet` (CSP off; `crossOriginResourcePolicy: "cross-origin"` is load-bearing — the frontends load `/uploads` images cross-origin) and rate limiters from `middleware/rateLimit.js` (global 300/5min, `/api/auth` 30/15min, `/simulate` 10/5min; in-memory, per-instance).
- Body limits are split: **15mb** only for POST/PUT under `/api/products*` and `/api/categories*` (base64 images travel in the JSON body); **200kb** everywhere else. Oversized → `413 {error}`.
- Every handler is wrapped in `asyncHandler` from `middleware/error.js`, and a JSON 404 + global error handler are mounted last. Express 4 does not catch async rejections on its own — keep new routes wrapped.
- The server only calls `app.listen()` when `NODE_ENV` is neither `"production"` nor `"test"`. In production it exports the `app` for Vercel to invoke. Keep this guard intact.

### Routes (`routes/*.js`, mounted under `/api/*`)

`auth`, `products`, `orders`, `analytics`, `categories`. Flash-sale endpoints live inline in `server.js`. All follow the same `getDb → mutate → saveDb` pattern, **check the `saveDb` result** (`false` → `500 {error}`; sole exception: `admin/login` is best-effort since only a telemetry log is at stake), and push an entry to `db.logs` on every mutation (these logs power the dashboard's activity feed and analytics). Request bodies are validated via `utils/validate.js` (dependency-free): routes keep their legacy presence checks (exact messages preserved), then call a validator for type/range tightening; every 400 body is `{error: "<message>"}`. IDs come from `utils/ids.js` (human formats kept, collision retry against the current snapshot).

- **`analytics.js`** is read-heavy: `/stats` computes KPIs (sales, cost, profit, conversion rate) and per-category breakdowns on the fly from orders/products/traffic. `/simulate` fabricates a mock order for demos.
- **`orders.js`** decrements product stock on checkout and bumps the current day's `traffic` row (traffic is kept to a rolling 7 entries). Every cart line must reference an existing product (unknown `productId` → 400) and `quantity` must be an integer 1–100 — prices always come from the DB, never the client. Shipping constants live in `config.js`.
- Products and categories may have a **multi-category** `category` field (array or string) — analytics and product-creation code handle both shapes; preserve that when editing.

### Image uploads — production vs local split

The shared helper is `utils/images.js` (`saveBase64Image(base64, prefix)`), used by
`products.js` (`/upload`) and `categories.js`. In Vercel/production the base64 data
URI is stored **directly in the database** (disk is ephemeral). Locally, base64 is
decoded and written to `public/uploads/` and a `/uploads/...` path is returned
instead. Any new image-handling code must honor this
`process.env.VERCEL || NODE_ENV === "production"` branch.

## Conventions & gotchas

- Bilingual content everywhere: fields come in `nameEn`/`nameBn`, `descriptionEn`/`descriptionBn` pairs (Bn = Bangla).
- Prices are stored in USD (`costUSD`, `priceUSD`); shipping is a BDT→USD conversion via `config.js` constants (`SHIPPING_INSIDE_BDT`, `SHIPPING_OUTSIDE_BDT`, `BDT_PER_USD`). Log/UI strings sometimes show `৳` (Taka).
- Auth is intentionally minimal and **not secure**: passwords are plaintext, admin login is two hardcoded passwords in `auth.js`, and `login`/`register` auto-create users. This is a demo/prototype backend — don't assume real auth exists, but don't "fix" it into a different contract without being asked.
- IDs keep human formats (`prod-women-1234`, `ORD-4821`) and are generated via `utils/ids.js` with collision retry against the current snapshot; cross-instance uniqueness still relies on the recommended Atlas unique index on `orders.id`. Mongo `_id` is never used (stripped from all reads via `projection: { _id: 0 }`).
- `type: "commonjs"` — use `require`, not `import`.
