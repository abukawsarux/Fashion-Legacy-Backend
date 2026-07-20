// config.js — loaded before anything else (server.js requires it first).
// Validates the environment at startup and centralizes shared constants.

// Tests control their environment themselves — never let a developer's real
// .env leak into a test run.
if (process.env.NODE_ENV !== "test") {
  require("dotenv").config();
}

const KNOWN_ENVS = ["production", "development", "test"];

function validateEnv() {
  const { NODE_ENV, MONGODB_URI, PORT, WEBSITE_URL, DASHBOARD_URL, STRICT_DB } = process.env;

  if (NODE_ENV && !KNOWN_ENVS.includes(NODE_ENV)) {
    console.warn(`config: unexpected NODE_ENV "${NODE_ENV}" (expected production/development/test).`);
  }
  if (MONGODB_URI && !/^mongodb(\+srv)?:\/\//.test(MONGODB_URI)) {
    console.warn("config: MONGODB_URI does not look like a mongodb:// or mongodb+srv:// URI.");
  }
  if (NODE_ENV === "production" && !MONGODB_URI) {
    const msg =
      "PRODUCTION IS RUNNING WITHOUT MONGODB_URI — the app will fall back to " +
      "ephemeral /tmp JSON storage and EVERY WRITE WILL BE LOST on the next " +
      "cold start. Set MONGODB_URI (or STRICT_DB=true to fail fast instead).";
    if (STRICT_DB === "true") throw new Error(`config: ${msg}`);
    console.error(`${"=".repeat(70)}\nWARNING: ${msg}\n${"=".repeat(70)}`);
  }
  if (PORT && !Number.isFinite(Number(PORT))) {
    console.warn(`config: PORT "${PORT}" is not a number.`);
  }
  for (const [name, value] of [["WEBSITE_URL", WEBSITE_URL], ["DASHBOARD_URL", DASHBOARD_URL]]) {
    if (value) {
      try {
        new URL(value);
      } catch (e) {
        console.warn(`config: ${name} "${value}" is not a valid URL — it will never match a CORS origin.`);
      }
    }
  }
}

validateEnv();

// Shipping is charged in BDT and converted to the USD amounts stored on orders.
const constants = {
  SHIPPING_INSIDE_BDT: 80,   // inside Dhaka
  SHIPPING_OUTSIDE_BDT: 150, // outside Dhaka
  BDT_PER_USD: 120
};

module.exports = { constants };
