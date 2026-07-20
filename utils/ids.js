// utils/ids.js — human-friendly IDs with collision retry against the current
// snapshot. Uniqueness is snapshot-scoped: two concurrent serverless instances
// can still race, which is why the roadmap recommends a unique Mongo index on
// orders.id as an ops-level backstop.

function generateOrderId(orders) {
  const taken = new Set((orders || []).map(o => o.id));
  // Keep the familiar ORD-XXXX display format while it has headroom
  for (let i = 0; i < 10; i++) {
    const id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!taken.has(id)) return id;
  }
  // Catalog is crowded — widen to five digits
  for (let i = 0; i < 10; i++) {
    const id = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    if (!taken.has(id)) return id;
  }
  let fallback = `ORD-${Date.now().toString().slice(-8)}`;
  while (taken.has(fallback)) fallback += Math.floor(Math.random() * 10);
  return fallback;
}

function generateProductId(categorySlug, products) {
  const taken = new Set((products || []).map(p => p.id));
  const stamp = Date.now().toString();
  const id = `prod-${categorySlug}-${stamp.slice(-4)}`;
  if (!taken.has(id)) return id;
  for (let i = 0; i < 10; i++) {
    const candidate = `${id}${Math.floor(Math.random() * 10)}`;
    if (!taken.has(candidate)) return candidate;
  }
  let fallback = `prod-${categorySlug}-${stamp}`;
  while (taken.has(fallback)) fallback += Math.floor(Math.random() * 10);
  return fallback;
}

module.exports = { generateOrderId, generateProductId };
