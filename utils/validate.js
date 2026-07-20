// utils/validate.js — dependency-free request validation.
// Checkers return an error string or null; per-endpoint validators return the
// FIRST error found so routes can respond with the frozen `{error}` shape.
// Routes keep their original presence checks (identical messages) and call
// these validators afterwards for type/range tightening.

// Strict numeric parse: accepts finite numbers and numeric strings, rejects
// NaN, Infinity, "", booleans, objects. Returns the number or null.
function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// Treat null as "not provided": strips null-valued keys in place so the
// routes' `x !== undefined` guards and `(x || fallback)` patterns stay safe.
function stripNulls(body) {
  if (!body || typeof body !== "object") return body;
  for (const key of Object.keys(body)) {
    if (body[key] === null) delete body[key];
  }
  return body;
}

function checkString(v, field, { required = false, max = 200 } = {}) {
  if (v === undefined || v === null || v === "") return required ? `${field} is required.` : null;
  if (typeof v !== "string") return `${field} must be a string.`;
  if (v.length > max) return `${field} must be at most ${max} characters.`;
  return null;
}

function checkNumber(v, field, { required = false, min, max, integer = false } = {}) {
  if (v === undefined || v === null) return required ? `${field} is required.` : null;
  const n = toNumber(v);
  if (n === null) return `${field} must be a number.`;
  if (integer && !Number.isInteger(n)) return `${field} must be an integer.`;
  if (min !== undefined && n < min) return `${field} must be at least ${min}.`;
  if (max !== undefined && n > max) return `${field} must be at most ${max}.`;
  return null;
}

function checkArray(v, field, { maxLength = 50 } = {}) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return `${field} must be an array.`;
  if (v.length > maxLength) return `${field} must have at most ${maxLength} items.`;
  return null;
}

// `category` may be a single slug or an array of slugs (multi-category products).
function checkCategoryField(category) {
  if (category === undefined || category === null) return null;
  if (typeof category === "string") return null;
  if (Array.isArray(category)) {
    if (category.length > 10) return "category must have at most 10 items.";
    for (const c of category) {
      if (typeof c !== "string") return "category items must be strings.";
    }
    return null;
  }
  return "category must be a string or an array of strings.";
}

// Shared by product create (presence already checked) and update (all optional).
function validateProductPayload(body) {
  const err =
    checkString(body.nameEn, "nameEn", { max: 200 }) ||
    checkString(body.nameBn, "nameBn", { max: 200 }) ||
    checkString(body.descriptionEn, "descriptionEn", { max: 5000 }) ||
    checkString(body.descriptionBn, "descriptionBn", { max: 5000 }) ||
    checkCategoryField(body.category) ||
    checkNumber(body.costUSD, "costUSD", { min: 0 }) ||
    checkNumber(body.priceUSD, "priceUSD", { min: 0 }) ||
    checkNumber(body.discountPercent, "discountPercent", { min: 0, max: 100 }) ||
    checkNumber(body.stock, "stock", { integer: true, min: 0 }) ||
    checkArray(body.images, "images", { maxLength: 10 }) ||
    checkArray(body.sizes, "sizes", { maxLength: 20 }) ||
    checkArray(body.colors, "colors", { maxLength: 20 });
  if (err) return err;
  if (Array.isArray(body.images)) {
    for (let i = 0; i < body.images.length; i++) {
      if (typeof body.images[i] !== "string") return `images[${i}] must be a string.`;
    }
  }
  return null;
}

function validateOrderCreate(body) {
  const err =
    checkString(body.customerName, "customerName", { max: 200 }) ||
    checkString(body.customerEmail, "customerEmail", { max: 320 }) ||
    checkString(body.customerAddress, "customerAddress", { max: 1000 }) ||
    checkString(body.paymentMethod, "paymentMethod", { max: 100 }) ||
    checkString(body.shippingArea, "shippingArea", { max: 50 }) ||
    checkArray(body.items, "items", { maxLength: 50 });
  if (err) return err;
  if (!Array.isArray(body.items)) return "items must be an array.";
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    if (typeof item !== "object" || item === null || Array.isArray(item)) return `items[${i}] must be an object.`;
    const itemErr =
      checkString(item.productId, "productId", { required: true, max: 100 }) ||
      checkNumber(item.quantity, "quantity", { required: true, integer: true, min: 1, max: 100 }) ||
      checkString(item.nameEn, "nameEn", { max: 200 }) ||
      checkString(item.nameBn, "nameBn", { max: 200 }) ||
      checkString(item.size, "size", { max: 50 }) ||
      checkString(item.colorEn, "colorEn", { max: 100 }) ||
      checkNumber(item.priceUSD, "priceUSD", { min: 0 });
    if (itemErr) return `items[${i}]: ${itemErr}`;
  }
  return null;
}

// Shared by category create (presence already checked) and update.
// `image` may be a base64 data URI, so no meaningful length cap.
function validateCategoryPayload(body) {
  return (
    checkString(body.nameEn, "nameEn", { max: 200 }) ||
    checkString(body.nameBn, "nameBn", { max: 200 }) ||
    checkString(body.image, "image", { max: 20000000 })
  );
}

function validateRegister(body) {
  return (
    checkString(body.name, "name", { max: 200 }) ||
    checkString(body.email, "email", { max: 320 }) ||
    checkString(body.phone, "phone", { max: 50 })
  );
}

function validateLogin(body) {
  return (
    checkString(body.email, "email", { max: 320 }) ||
    checkString(body.password, "password", { max: 200 })
  );
}

function validateProfile(body) {
  return (
    checkString(body.email, "email", { max: 320 }) ||
    checkString(body.name, "name", { max: 200 }) ||
    checkString(body.phone, "phone", { max: 50 }) ||
    checkString(body.address, "address", { max: 1000 }) ||
    checkString(body.avatar, "avatar", { max: 100 })
  );
}

function validateFlashSale(body) {
  const err = checkString(body.flashSaleEnd, "flashSaleEnd", { max: 100 });
  if (err) return err;
  if (body.flashSaleEnd && !Number.isFinite(Date.parse(body.flashSaleEnd))) {
    return "flashSaleEnd must be a valid date string (ISO 8601).";
  }
  return null;
}

module.exports = {
  stripNulls,
  validateProductPayload,
  validateOrderCreate,
  validateCategoryPayload,
  validateRegister,
  validateLogin,
  validateProfile,
  validateFlashSale
};
