# Fashion Legacy Backend

Express.js REST API serving the Fashion Legacy e-commerce **storefront** and its
**admin dashboard** from a single API. Runs as a normal Node process locally and
as a Vercel serverless function in production.

## Quickstart

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI (optional locally)
npm run dev            # nodemon on http://localhost:5000
```

- `npm start` — plain `node server.js`
- `npm test` — contract smoke tests (vitest + supertest); runs against the
  local-JSON backend in an isolated temp dir, never touches MongoDB
- Endpoint catalog: see [`docs/api-feature.md`](docs/api-feature.md)

## Environment variables

| Key | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string. **Unset → the app falls back to a local JSON file** (`data/db.json` locally, ephemeral `/tmp` on Vercel — production must always set this). |
| `PORT` | Local port (default `5000`). |
| `WEBSITE_URL`, `DASHBOARD_URL` | Extra CORS allowlist origins for the two frontends. |
| `ALLOW_LAN_ORIGINS` | `"true"` re-enables private-LAN origins through production CORS (blocked by default). |
| `STRICT_DB` | `"true"` → DB-connect failures return `503` instead of silently proceeding to the JSON fallback; also fail-fast at boot if production lacks `MONGODB_URI`. |
| `DATA_DIR` | Overrides the JSON-fallback data directory (used by the test suite). |

Environment is validated at startup by `config.js` (loud warning when production
runs without `MONGODB_URI`).

## Storage model

All persistence goes through `db.js` (`connectMongo` / `getDb` / `saveDb`):
`getDb()` returns one denormalized snapshot object assembled from separate
MongoDB collections (10s per-collection cache, `structuredClone`d per request);
routes mutate the snapshot and hand it back to `saveDb()`, which upserts each
collection and commits the cache only after the write succeeds. When
`MONGODB_URI` is unset the same interface is backed by a local JSON file.

## Deployment (Vercel)

`server.js` only calls `app.listen()` when `NODE_ENV` is neither `production`
nor `test`; in production it exports the Express `app` for Vercel to invoke —
keep that guard intact. Because serverless disk is ephemeral, uploaded images
are stored as base64 **in the database** in production (see `utils/images.js`).

## Security status (read before going live)

- **Rotate the MongoDB Atlas credentials**: a `.env` file existed in early git
  history and its contents (including the connection string) remain recoverable
  from that history even though the file is untracked today.
- Recommended Atlas ops backstop: a **unique index on `orders.id`**.
- Auth is still demo-grade by design (plaintext passwords, hardcoded admin
  passwords, no tokens): do not expose admin features publicly until the real
  auth phase (bcrypt + JWT + route guards) lands. Interim mitigation: rate
  limiting on `/api/auth/*`.
