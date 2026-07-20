// Contract smoke tests — these lock the API's observable behavior for the two
// frontends (storefront + dashboard). They run against the local-JSON backend
// in an isolated temp dir (see tests/setup.js) and never open a port.
const request = require("supertest");
const app = require("../server");

describe("health", () => {
  it("GET / reports healthy with the local JSON fallback", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.database).toContain("Local JSON");
  });
});

describe("categories", () => {
  it("GET /api/categories returns the seeded list", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("products", () => {
  let productId;

  it("GET /api/products starts as an empty array", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/products creates a product", async () => {
    const res = await request(app).post("/api/products").send({
      nameEn: "Test Shirt",
      nameBn: "টেস্ট শার্ট",
      category: ["cat_men"],
      costUSD: 5,
      priceUSD: 12.5,
      stock: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Product created successfully");
    expect(res.body.product.id).toMatch(/^prod-/);
    productId = res.body.product.id;
  });

  it("GET /api/products/:id returns the created product", async () => {
    const res = await request(app).get(`/api/products/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.nameEn).toBe("Test Shirt");
    expect(res.body.stock).toBe(10);
  });

  it("PUT /api/products/:id updates fields", async () => {
    const res = await request(app).put(`/api/products/${productId}`).send({ priceUSD: 15 });
    expect(res.status).toBe(200);
    expect(res.body.product.priceUSD).toBe(15);
  });

  it("GET /api/products/:id 404s for an unknown id", async () => {
    const res = await request(app).get("/api/products/does-not-exist");
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
  });
});

describe("orders", () => {
  let orderId;
  let productId;

  beforeAll(async () => {
    const res = await request(app).post("/api/products").send({
      nameEn: "Order Target",
      nameBn: "অর্ডার টার্গেট",
      category: "cat_women",
      costUSD: 4,
      priceUSD: 10,
      stock: 8,
    });
    productId = res.body.product.id;
  });

  it("POST /api/orders places an order and decrements stock", async () => {
    const res = await request(app).post("/api/orders").send({
      customerName: "Test Customer",
      customerEmail: "customer@example.com",
      customerAddress: "House 1, Dhaka",
      shippingArea: "inside",
      items: [{ productId, nameEn: "Order Target", quantity: 2, priceUSD: 10 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.order.id).toMatch(/^ORD-\d{4,}$/);
    expect(res.body.order.totalUSD).toBeCloseTo(2 * 10 + 80 / 120, 2);
    expect(res.body.order.status).toBe("Pending");
    orderId = res.body.order.id;

    const prod = await request(app).get(`/api/products/${productId}`);
    expect(prod.body.stock).toBe(6);
  });

  it("GET /api/orders lists the order", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(200);
    expect(res.body.some((o) => o.id === orderId)).toBe(true);
  });

  it("GET /api/orders/user/:email filters by email", async () => {
    const res = await request(app).get("/api/orders/user/customer@example.com");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((o) => o.customerEmail === "customer@example.com")).toBe(true);
  });

  it("PUT /api/orders/:id/status updates status and rejects unknown values", async () => {
    const ok = await request(app).put(`/api/orders/${orderId}/status`).send({ status: "Shipped" });
    expect(ok.status).toBe(200);
    expect(ok.body.order.status).toBe("Shipped");

    const bad = await request(app).put(`/api/orders/${orderId}/status`).send({ status: "Cancelled" });
    expect(bad.status).toBe(400);
    expect(typeof bad.body.error).toBe("string");
  });
});

describe("auth", () => {
  it("POST /api/auth/register returns the safe user shape; duplicate 400s", async () => {
    const payload = { name: "New User", email: "new.user@example.com", phone: "01700000000" };
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual(["address", "avatar", "email", "name", "phone"]);

    const dup = await request(app).post("/api/auth/register").send(payload);
    expect(dup.status).toBe(400);
  });

  it("POST /api/auth/login succeeds by email alone (auto-create contract)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "auto@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("auto@example.com");
  });

  it("POST /api/auth/admin/login rejects a wrong password", async () => {
    const res = await request(app).post("/api/auth/admin/login").send({ password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe("analytics", () => {
  it("GET /api/analytics/stats returns numeric KPIs", async () => {
    const res = await request(app).get("/api/analytics/stats");
    expect(res.status).toBe(200);
    expect(typeof res.body.kpis.totalSales).toBe("number");
    expect(Number.isFinite(res.body.kpis.totalSales)).toBe(true);
    expect(Array.isArray(res.body.recentLogs)).toBe(true);
  });
});

describe("flash sale", () => {
  it("POST + GET /api/flash-sale round-trips the timestamp", async () => {
    const ts = new Date(Date.now() + 3600_000).toISOString();
    const post = await request(app).post("/api/flash-sale").send({ flashSaleEnd: ts });
    expect(post.status).toBe(200);
    expect(post.body.flashSaleEnd).toBe(ts);

    const get = await request(app).get("/api/flash-sale");
    expect(get.status).toBe(200);
    expect(get.body.flashSaleEnd).toBe(ts);
  });
});

describe("hardening (tightenings from the safe-fix phase)", () => {
  it("rejects non-numeric prices on product create (NaN pollution)", async () => {
    const res = await request(app).post("/api/products").send({
      nameEn: "Bad Price", nameBn: "বাদ", category: "cat_men", costUSD: "abc", priceUSD: 10, stock: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("costUSD");
  });

  it("rejects wrong-typed fields on product update instead of hanging", async () => {
    const created = await request(app).post("/api/products").send({
      nameEn: "Type Target", nameBn: "টাইপ", category: "cat_men", costUSD: 1, priceUSD: 2, stock: 1,
    });
    const res = await request(app)
      .put(`/api/products/${created.body.product.id}`)
      .send({ nameEn: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("nameEn");
  });

  it("rejects negative quantities (stock-inflation exploit)", async () => {
    const created = await request(app).post("/api/products").send({
      nameEn: "Qty Target", nameBn: "কিউ", category: "cat_men", costUSD: 1, priceUSD: 2, stock: 5,
    });
    const res = await request(app).post("/api/orders").send({
      customerName: "X", customerEmail: "x@example.com", customerAddress: "Y",
      items: [{ productId: created.body.product.id, quantity: -2 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("quantity");
  });

  it("rejects unknown products in the cart (client-priced-order exploit)", async () => {
    const res = await request(app).post("/api/orders").send({
      customerName: "X", customerEmail: "x@example.com", customerAddress: "Y",
      items: [{ productId: "prod-ghost-0000", quantity: 1, priceUSD: 0.01 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Unknown product");
  });

  it("rejects an unparseable flash-sale timestamp", async () => {
    const res = await request(app).post("/api/flash-sale").send({ flashSaleEnd: "not-a-date" });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/does/not/exist");
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
  });

  it("returns JSON 400 for malformed JSON bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid JSON");
  });

  it("returns 413 for oversized non-image bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "big@example.com", password: "x".repeat(300 * 1024) });
    expect(res.status).toBe(413);
    expect(typeof res.body.error).toBe("string");
  });

  it("keeps recentLogs newest-first", async () => {
    const res = await request(app).get("/api/analytics/stats");
    const logs = res.body.recentLogs;
    expect(logs.length).toBeGreaterThan(1);
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i - 1].timestamp >= logs[i].timestamp).toBe(true);
    }
  });
});
