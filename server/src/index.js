import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initializeDatabase } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const production = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "";
const adminCookieName = "iips_admin";
const adminSessionSeconds = 8 * 60 * 60;
const clientDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));

app.disable("x-powered-by");
app.set("trust proxy", production ? 1 : false);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "32kb" }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many login attempts. Try again in 15 minutes." } });
const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many order attempts. Please wait a few minutes." } });
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many submissions. Please wait a few minutes." } });

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const cleanText = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const asBool = (value) => value === true || value === 1 || value === "true";
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value) => /^[+()\-\s\d]{7,30}$/.test(value);
const adminCookieOptions = () => ({
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
  maxAge: adminSessionSeconds * 1000
});

function getAdminToken(req) {
  const parsed = cookie.parse(req.headers.cookie || "");
  return parsed[adminCookieName] || "";
}

function requireAdmin(req, res, next) {
  if (!sessionSecret) return res.status(503).json({ error: "Admin sign-in is not configured on this deployment." });
  const token = getAdminToken(req);
  if (!token) return res.status(401).json({ error: "Please sign in as an administrator." });
  try {
    const payload = jwt.verify(token, sessionSecret, { issuer: "iips-restaurant", audience: "iips-admin" });
    req.admin = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.clearCookie(adminCookieName, { httpOnly: true, secure: production, sameSite: "lax", path: "/" });
    return res.status(401).json({ error: "Your admin session expired. Please sign in again." });
  }
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  try {
    // Check real application tables, not just whether PostgreSQL accepts SELECT 1.
    const { rows } = await pool.query(`
      SELECT to_regclass('public.menu_items') AS menu_table,
             to_regclass('public.orders') AS orders_table,
             to_regclass('public.admins') AS admins_table
    `);
    const ready = Boolean(rows[0]?.menu_table && rows[0]?.orders_table && rows[0]?.admins_table);
    if (!ready) return res.status(503).json({ ok: false, service: "iips-restaurant", database: "schema_not_ready" });
    res.json({ ok: true, service: "iips-restaurant", database: "connected" });
  } catch {
    res.status(503).json({ ok: false, service: "iips-restaurant", database: "unavailable" });
  }
}));

app.get("/api/menu", asyncRoute(async (req, res) => {
  const category = cleanText(req.query.category, 60);
  const search = cleanText(req.query.search, 80);
  const values = [];
  let where = "WHERE is_active = TRUE";
  if (category && category !== "All") {
    values.push(category);
    where += ` AND category = $${values.length}`;
  }
  if (search) {
    values.push(`%${search}%`);
    where += ` AND (name ILIKE $${values.length} OR description ILIKE $${values.length})`;
  }
  const { rows } = await pool.query(
    `SELECT id, name, description, category, price, image_url, is_vegetarian, is_available, is_demo
     FROM menu_items ${where} ORDER BY sort_order, name LIMIT 100`, values
  );
  res.json({ items: rows });
}));

app.get("/api/offers", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, description, coupon_code, is_demo
     FROM offers WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= NOW())
       AND (expires_at IS NULL OR expires_at >= NOW()) ORDER BY id DESC LIMIT 20`
  );
  res.json({ offers: rows });
}));

app.get("/api/reviews", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, display_name, rating, comment, created_at, is_demo
     FROM reviews WHERE moderation_status = 'approved' ORDER BY created_at DESC LIMIT 20`
  );
  res.json({ reviews: rows });
}));

app.post("/api/reviews", formLimiter, asyncRoute(async (req, res) => {
  const displayName = cleanText(req.body?.display_name, 80);
  const comment = cleanText(req.body?.comment, 1000);
  const rating = Number(req.body?.rating);
  if (displayName.length < 2 || comment.length < 8 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Enter your name, a review of at least 8 characters, and a rating from 1 to 5." });
  }
  const { rows } = await pool.query(
    `INSERT INTO reviews (display_name, rating, comment, moderation_status, is_demo)
     VALUES ($1, $2, $3, 'pending', FALSE) RETURNING id`,
    [displayName, rating, comment]
  );
  res.status(201).json({ ok: true, id: rows[0].id, message: "Thanks! Your review has been sent for approval." });
}));

app.post("/api/enquiries", formLimiter, asyncRoute(async (req, res) => {
  const name = cleanText(req.body?.name, 120);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const phone = cleanText(req.body?.phone, 30);
  const subject = cleanText(req.body?.subject, 160) || "General enquiry";
  const message = cleanText(req.body?.message, 2000);
  if (name.length < 2 || message.length < 10 || (!email && !phone) || (email && !validEmail(email)) || (phone && !validPhone(phone))) {
    return res.status(400).json({ error: "Enter your name, a valid email or phone number, and a message of at least 10 characters." });
  }
  const { rows } = await pool.query(
    `INSERT INTO enquiries (name, email, phone, subject, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, email || null, phone || null, subject, message]
  );
  res.status(201).json({ ok: true, id: rows[0].id, message: "Your enquiry has been received." });
}));

app.post("/api/orders", orderLimiter, asyncRoute(async (req, res) => {
  const customerName = cleanText(req.body?.customer_name, 120);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const phone = cleanText(req.body?.phone, 30);
  const pickupNotes = cleanText(req.body?.pickup_notes, 500);
  const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (customerName.length < 2 || (!email && !phone) || (email && !validEmail(email)) || (phone && !validPhone(phone))) {
    return res.status(400).json({ error: "Enter your name and at least one valid contact method (email or phone)." });
  }
  if (!requestedItems.length || requestedItems.length > 30) return res.status(400).json({ error: "Your bag must contain between 1 and 30 different items." });
  const normalisedItems = [];
  const seenIds = new Set();
  for (const entry of requestedItems) {
    const id = Number(entry?.menu_item_id);
    const quantity = Number(entry?.quantity);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || seenIds.has(id)) {
      return res.status(400).json({ error: "One or more cart items are invalid. Refresh the menu and try again." });
    }
    seenIds.add(id);
    normalisedItems.push({ id, quantity });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = normalisedItems.map(item => item.id);
    const { rows: menuRows } = await client.query(
      `SELECT id, name, price, is_available FROM menu_items
       WHERE id = ANY($1::int[]) AND is_active = TRUE FOR SHARE`, [ids]
    );
    if (menuRows.length !== normalisedItems.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Some items are no longer on the menu. Refresh and try again." });
    }
    const byId = new Map(menuRows.map(item => [Number(item.id), item]));
    const lines = [];
    let totalPaise = 0;
    for (const requested of normalisedItems) {
      const item = byId.get(requested.id);
      if (!item || !item.is_available) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "One of the items is currently unavailable. Please update your bag." });
      }
      const unitPaise = Math.round(Number(item.price) * 100);
      const linePaise = unitPaise * requested.quantity;
      totalPaise += linePaise;
      lines.push({ id: Number(item.id), name: item.name, unitPaise, quantity: requested.quantity, linePaise });
    }
    if (totalPaise <= 0 || totalPaise > 1_000_000_00) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "The order total is outside the allowed range." });
    }
    const orderCode = `IIPS-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const total = (totalPaise / 100).toFixed(2);
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_code, customer_name, customer_email, customer_phone, pickup_notes, subtotal, total)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id, order_code, status, total, created_at`,
      [orderCode, customerName, email || null, phone || null, pickupNotes, total]
    );
    const order = orderRows[0];
    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, line.id, line.name, (line.unitPaise / 100).toFixed(2), line.quantity, (line.linePaise / 100).toFixed(2)]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ ok: true, order: { ...order, items: lines.map(line => ({ name: line.name, quantity: line.quantity, line_total: (line.linePaise / 100).toFixed(2) })) }, message: "Order placed. Please pay at the counter when you collect it." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/admin/login", loginLimiter, asyncRoute(async (req, res) => {
  if (!sessionSecret || sessionSecret.length < 32) return res.status(503).json({ error: "Admin sign-in is not configured. Set SESSION_SECRET to a random value of at least 32 characters." });
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Enter your admin email and password." });
  const { rows } = await pool.query("SELECT id, email, password_hash FROM admins WHERE email = $1 LIMIT 1", [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
  await pool.query("UPDATE admins SET last_login_at = NOW() WHERE id = $1", [admin.id]);
  const token = jwt.sign({ email: admin.email }, sessionSecret, { subject: String(admin.id), issuer: "iips-restaurant", audience: "iips-admin", expiresIn: adminSessionSeconds });
  res.cookie(adminCookieName, token, adminCookieOptions());
  res.json({ ok: true, admin: { id: admin.id, email: admin.email } });
}));

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie(adminCookieName, { httpOnly: true, secure: production, sameSite: "lax", path: "/" });
  res.json({ ok: true });
});
app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ admin: req.admin }));

app.get("/api/admin/summary", requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM menu_items WHERE is_active = TRUE) AS active_menu_items,
      (SELECT COUNT(*)::int FROM orders WHERE created_at::date = CURRENT_DATE) AS orders_today,
      (SELECT COUNT(*)::int FROM orders WHERE status IN ('pending','accepted','preparing')) AS open_orders,
      (SELECT COUNT(*)::int FROM enquiries WHERE status = 'new') AS new_enquiries,
      (SELECT COUNT(*)::int FROM reviews WHERE moderation_status = 'pending') AS pending_reviews
  `);
  res.json({ summary: rows[0] });
}));

app.get("/api/admin/menu", requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM menu_items ORDER BY sort_order, name");
  res.json({ items: rows });
}));

function validateMenuItem(body) {
  const item = {
    name: cleanText(body?.name, 120),
    description: cleanText(body?.description, 500),
    category: cleanText(body?.category, 60),
    price: Number(body?.price),
    image_url: cleanText(body?.image_url, 1000),
    is_vegetarian: asBool(body?.is_vegetarian),
    is_available: body?.is_available === undefined ? true : asBool(body?.is_available),
    sort_order: Number(body?.sort_order ?? 0),
    is_demo: body?.is_demo === undefined ? false : asBool(body?.is_demo)
  };
  if (item.name.length < 2 || !item.category || !Number.isFinite(item.price) || item.price < 0 || item.price > 100000 || !Number.isInteger(item.sort_order)) return { error: "Enter a name, category, valid non-negative price, and integer sort order." };
  if (item.image_url && !/^https:\/\//i.test(item.image_url)) return { error: "Image URL must start with https://." };
  return { item };
}

app.post("/api/admin/menu", requireAdmin, asyncRoute(async (req, res) => {
  const validated = validateMenuItem(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const item = validated.item;
  const { rows } = await pool.query(
    `INSERT INTO menu_items (name, description, category, price, image_url, is_vegetarian, is_available, is_demo, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [item.name, item.description, item.category, item.price, item.image_url || null, item.is_vegetarian, item.is_available, item.is_demo, item.sort_order]
  );
  res.status(201).json({ item: rows[0] });
}));

app.put("/api/admin/menu/:id", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const validated = validateMenuItem(req.body);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid menu item." });
  if (validated.error) return res.status(400).json({ error: validated.error });
  const item = validated.item;
  const { rows } = await pool.query(
    `UPDATE menu_items SET name=$1, description=$2, category=$3, price=$4, image_url=$5,
       is_vegetarian=$6, is_available=$7, is_demo=$8, sort_order=$9, updated_at=NOW()
     WHERE id=$10 AND is_active=TRUE RETURNING *`,
    [item.name, item.description, item.category, item.price, item.image_url || null, item.is_vegetarian, item.is_available, item.is_demo, item.sort_order, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Menu item not found." });
  res.json({ item: rows[0] });
}));

app.patch("/api/admin/menu/:id/availability", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body?.is_available !== "boolean") return res.status(400).json({ error: "Invalid availability change." });
  const { rows } = await pool.query("UPDATE menu_items SET is_available=$1, updated_at=NOW() WHERE id=$2 AND is_active=TRUE RETURNING id, is_available", [req.body.is_available, id]);
  if (!rows[0]) return res.status(404).json({ error: "Menu item not found." });
  res.json({ item: rows[0] });
}));

app.delete("/api/admin/menu/:id", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid menu item." });
  const { rowCount } = await pool.query("UPDATE menu_items SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND is_active=TRUE", [id]);
  if (!rowCount) return res.status(404).json({ error: "Menu item not found." });
  res.json({ ok: true });
}));

app.get("/api/admin/orders", requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT o.id, o.order_code, o.customer_name, o.customer_email, o.customer_phone, o.pickup_notes,
           o.status, o.payment_method, o.payment_status, o.subtotal, o.total, o.created_at,
           COALESCE(json_agg(json_build_object('id', oi.id, 'name', oi.item_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200
  `);
  res.json({ orders: rows });
}));

app.patch("/api/admin/orders/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const status = cleanText(req.body?.status, 20);
  const allowed = new Set(["pending", "accepted", "preparing", "ready", "completed", "cancelled"]);
  if (!Number.isInteger(id) || id < 1 || !allowed.has(status)) return res.status(400).json({ error: "Invalid order status." });
  const { rows } = await pool.query("UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, order_code, status", [status, id]);
  if (!rows[0]) return res.status(404).json({ error: "Order not found." });
  res.json({ order: rows[0] });
}));

app.get("/api/admin/enquiries", requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 250");
  res.json({ enquiries: rows });
}));
app.patch("/api/admin/enquiries/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const status = cleanText(req.body?.status, 20);
  if (!Number.isInteger(id) || id < 1 || !["new", "in_progress", "resolved", "closed"].includes(status)) return res.status(400).json({ error: "Invalid enquiry status." });
  const { rows } = await pool.query("UPDATE enquiries SET status=$1 WHERE id=$2 RETURNING id, status", [status, id]);
  if (!rows[0]) return res.status(404).json({ error: "Enquiry not found." });
  res.json({ enquiry: rows[0] });
}));

app.get("/api/admin/reviews", requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM reviews ORDER BY CASE WHEN moderation_status='pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 250");
  res.json({ reviews: rows });
}));
app.patch("/api/admin/reviews/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const status = cleanText(req.body?.moderation_status, 20);
  if (!Number.isInteger(id) || id < 1 || !["pending", "approved", "hidden"].includes(status)) return res.status(400).json({ error: "Invalid review status." });
  const { rows } = await pool.query("UPDATE reviews SET moderation_status=$1 WHERE id=$2 RETURNING id, moderation_status", [status, id]);
  if (!rows[0]) return res.status(404).json({ error: "Review not found." });
  res.json({ review: rows[0] });
}));

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: production ? "1h" : 0, index: false }));
  app.get("*", (_req, res) => res.sendFile(resolve(clientDist, "index.html")));
} else {
  app.get("/", (_req, res) => res.status(200).send("IIPS Restaurant API is running. Start Vite with npm run dev:client for the frontend."));
}

app.use((error, _req, res, _next) => {
  if (error?.code === "23505") return res.status(409).json({ error: "That value already exists. Check for a duplicate name or coupon code." });
  if (error?.code === "23503") return res.status(409).json({ error: "This record is connected to other data and cannot be changed that way." });
  console.error("API error:", error?.message || error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

async function start() {
  try {
    await initializeDatabase();
    console.log("PostgreSQL schema is ready.");
  } catch (error) {
    console.error("Database initialization failed. The API will start, but database endpoints will be unavailable until the connection is fixed:", error.message);
  }
  const server = app.listen(port, () => console.log(`IIPS Restaurant listening on port ${port}${existsSync(clientDist) ? " (frontend + API)" : " (API)"}`));
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start();
