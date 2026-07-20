// Runs (per worker) before any test file imports the app.
// Forces the local-JSON backend into an isolated temp dir so tests never touch
// MongoDB Atlas or the repo's data/db.json.
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.NODE_ENV = "test";
// dotenv never overrides an already-set variable — pre-setting these keeps any
// values from a developer's real .env out of the test run.
process.env.MONGODB_URI = "";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fashion-legacy-test-"));
