"use strict";

const crypto = require("crypto");
const {
  get, all, run, tx, nowISO, localDateString, getSetting, setSetting,
  logActivity, notify, slugify
} = require("./db");
const {
  hashPassword, verifyPassword, validatePassword, createSession, findSession,
  destroySession, recentFailures, recordAttempt, publicUser, isInitialized,
  verifySetupToken, completeSetup, rotateSetupToken, getSetupToken
} = require("./auth");
const {
  sendJSON, sendError, readBody, clientIP, sameOrigin, sanitizeText,
  toNumber, round2, isEmail
} = require("./http");

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const routes = [];

function route(method, pattern, handler, guard = "public") {
  const parts = pattern.split("/").filter(Boolean);
  routes.push({ method, parts, handler, guard });
}

function matchRoute(method, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  let pathMatched = false;
  for (const r of routes) {
    if (r.parts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(parts[i]);
      else if (p !== parts[i]) { ok = false; break; }
    }
    if (!ok) continue;
    pathMatched = true;
    if (r.method === method) return { route: r, params };
  }
  return pathMatched ? { methodNotAllowed: true } : null;
}

async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const match = matchRoute(req.method, pathname);

  if (!match) return sendError(res, 404, "Endpoint not found.");
  if (match.methodNotAllowed) return sendError(res, 405, "Method not allowed.");

  if (req.method !== "GET" && !sameOrigin(req)) {
    return sendError(res, 403, "Cross-origin request blocked.");
  }

  let user;
  try {
    user = await findSession(req);
  } catch (error) {
    console.error("[api] session lookup failed:", error);
    return sendError(res, 500, "Something went wrong on the server.");
  }
  const { route: r, params } = match;

  if (r.guard !== "public") {
    if (!user) return sendError(res, 401, "Your session has expired. Please sign in again.", { code: "unauthenticated" });
    if (r.guard === "admin" && user.role !== "admin") {
      return sendError(res, 403, "Administrator access required.", { code: "forbidden" });
    }
    if (r.guard === "cashier" && user.role !== "cashier" && user.role !== "admin") {
      return sendError(res, 403, "Cashier access required.", { code: "forbidden" });
    }
    const allowedDuringChange = pathname === "/api/auth/session" || pathname === "/api/auth/change-password" || pathname === "/api/auth/logout";
    if (user.must_change_password && !allowedDuringChange) {
      return sendError(res, 403, "You must change your temporary password before continuing.", { code: "password_change_required" });
    }
  }

  let body = {};
  if (req.method !== "GET" && req.method !== "DELETE") {
    try { body = await readBody(req); }
    catch (error) { return sendError(res, error.status || 400, error.message); }
  }

  const ctx = { req, res, params, query: Object.fromEntries(url.searchParams), body, user, ip: clientIP(req) };
  try {
    await r.handler(ctx);
  } catch (error) {
    if (error && error.expose) return sendError(res, error.status || 400, error.message);
    console.error(`[api] ${req.method} ${pathname} failed:`, error);
    sendError(res, 500, "Something went wrong on the server.");
  }
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  throw error;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function SYMBOL() {
  return getSetting("currency_symbol", "₱");
}

function parseJSON(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function requireText(value, label, { min = 1, max = 200 } = {}) {
  const text = sanitizeText(value, max);
  if (text.length < min) fail(400, `${label} is required.`);
  return text;
}

function idParam(value, label = "ID") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) fail(400, `Invalid ${label}.`);
  return id;
}

function dateKey(date = new Date()) {
  return localDateString(date);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function eachDate(start, end) {
  const out = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 800) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

function resolveRange(range, from, to) {
  const today = dateKey();
  const [y, m] = today.split("-").map(Number);
  switch (range) {
    case "today": return { start: today, end: today };
    case "yesterday": {
      const d = addDays(today, -1);
      return { start: d, end: d };
    }
    case "week": {
      const now = new Date(y, m - 1, Number(today.split("-")[2]));
      const day = (now.getDay() + 6) % 7; // Monday = 0
      return { start: addDays(today, -day), end: today };
    }
    case "month": return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: today };
    case "last-month": {
      const startDate = new Date(y, m - 2, 1);
      const endDate = new Date(y, m - 1, 0);
      return { start: localDateString(startDate), end: localDateString(endDate) };
    }
    case "year": return { start: `${y}-01-01`, end: today };
    case "custom": {
      const ok = /^\d{4}-\d{2}-\d{2}$/;
      if (!ok.test(from || "") || !ok.test(to || "")) fail(400, "A valid custom date range is required.");
      return from <= to ? { start: from, end: to } : { start: to, end: from };
    }
    default: return { start: addDays(today, -29), end: today };
  }
}

function previousRange(start, end) {
  const len = daysBetween(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(len - 1));
  return { start: prevStart, end: prevEnd };
}

function rangeLabel(start, end) {
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

async function salesBetween(start, end) {
  return get(
    `SELECT COALESCE(SUM(total),0) AS revenue,
            COALESCE(SUM(discount),0) AS discounts,
            COALESCE(SUM(tax),0) AS tax,
            COUNT(*) AS orders
       FROM orders
      WHERE payment_status = 'paid' AND status <> 'cancelled' AND biz_date BETWEEN ? AND ?`,
    start, end
  );
}

async function orderListQuery(where, params, limit = 200) {
  return all(
    `SELECT o.*, c.contact AS customer_contact
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      ${where ? `WHERE ${where}` : ""}
      ORDER BY o.created_at DESC LIMIT ?`,
    ...params, limit
  );
}

async function readOrder(id) {
  const order = await get("SELECT * FROM orders WHERE id = ?", id);
  if (!order) fail(404, "Order not found.");
  const items = await all("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", id);
  order.items = items.map((item) => ({
    ...item,
    addons: parseJSON(item.addons, [])
  }));
  order.payment = (await get("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1", id)) || null;
  order.refund = (await get("SELECT * FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1", id)) || null;
  return order;
}

function publicOrder(order) {
  return {
    ...order,
    stockDeducted: Boolean(order.stock_deducted),
    items: order.items || []
  };
}

async function taxRates() {
  return {
    tax: Math.max(0, toNumber(await getSetting("tax_rate", "0.12"), 0.12)),
    service: Math.max(0, toNumber(await getSetting("service_charge", "0"), 0))
  };
}

async function paymentMethods() {
  return parseJSON(await getSetting("payment_methods", '["Cash","GCash"]'), ["Cash", "GCash"]);
}

async function buildLineItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) fail(400, "Add at least one item to the order.");
  if (rawItems.length > 60) fail(400, "Too many items in one order.");
  const lines = [];
  for (const raw of rawItems) {
    const productId = Number(raw.productId);
    const qty = Math.floor(toNumber(raw.quantity, 0));
    if (!Number.isInteger(productId) || productId <= 0) fail(400, "Invalid product in order.");
    if (qty < 1 || qty > 99) fail(400, "Item quantity must be between 1 and 99.");
    const product = await get("SELECT * FROM products WHERE id = ?", productId);
    if (!product) fail(400, "A product in your cart no longer exists.");
    if (!product.is_available) fail(400, `${product.name} is currently unavailable.`);

    let size = null;
    let sizeDelta = 0;
    if (product.has_sizes) {
      const sizes = await all("SELECT * FROM product_sizes WHERE product_id = ?", productId);
      const chosen = raw.size ? sizes.find((s) => s.name.toLowerCase() === String(raw.size).toLowerCase()) : sizes.find((s) => s.name === "Medium") || sizes[0];
      if (!chosen) fail(400, `Choose a valid size for ${product.name}.`);
      size = chosen.name;
      sizeDelta = chosen.price_delta;
    }

    const addonIds = Array.isArray(raw.addons) ? [...new Set(raw.addons.map(Number).filter(Boolean))] : [];
    const addonRows = [];
    if (addonIds.length) {
      const valid = await all("SELECT a.* FROM addons a JOIN product_addons pa ON pa.addon_id = a.id WHERE pa.product_id = ? AND a.is_active = 1", productId);
      for (const id of addonIds) {
        const found = valid.find((a) => a.id === id);
        if (!found) fail(400, `An add-on selected for ${product.name} is unavailable.`);
        addonRows.push({ id: found.id, name: found.name, price: found.price });
      }
    }
    const addonTotal = addonRows.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = round2(product.price + sizeDelta + addonTotal);
    const category = await get("SELECT name FROM categories WHERE id = ?", product.category_id);
    lines.push({
      productId,
      productName: product.name,
      categoryName: category?.name || "",
      size: size || "",
      addons: addonRows,
      unitPrice,
      quantity: qty,
      notes: sanitizeText(raw.notes, 300),
      lineTotal: round2(unitPrice * qty)
    });
  }
  return lines;
}

async function computeTotals(subtotal, discountId, discountReference) {
  const { tax: taxRate, service: serviceRate } = await taxRates();
  let discount = 0;
  let discountLabel = "";
  let discountRow = null;
  if (discountId) {
    const row = await get("SELECT * FROM discounts WHERE id = ? AND is_active = 1", Number(discountId));
    if (!row) fail(400, "That discount is not available.");
    if (row.requires_id && !sanitizeText(discountReference, 80)) {
      fail(400, `${row.name} requires a valid ID / reference number.`);
    }
    discount = row.type === "percent"
      ? round2(subtotal * (row.value / 100))
      : round2(Math.min(subtotal, row.value));
    discountLabel = row.name;
    discountRow = row;
  }
  const taxable = Math.max(0, subtotal - discount);
  const tax = round2(taxable * taxRate);
  const service = round2(taxable * serviceRate);
  return {
    discount, discountLabel, discountId: discountRow ? discountRow.id : null,
    tax, service, total: round2(taxable + tax + service), discountRow
  };
}

async function newOrderNumber() {
  const date = dateKey().replace(/-/g, "");
  const prefix = `TRP-${date}-`;
  const last = await get("SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1", `${prefix}%`);
  let next = 1;
  if (last) next = Number(last.order_number.slice(prefix.length)) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function deductStockForOrder(orderId, userId, userName) {
  const order = await get("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) fail(404, "Order not found.");
  if (order.stock_deducted) return { deducted: false, shortages: [] };

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", orderId);
  const needed = new Map();
  for (const item of items) {
    if (!item.product_id) continue;
    const recipe = await all("SELECT ingredient_id, quantity FROM product_recipes WHERE product_id = ?", item.product_id);
    for (const r of recipe) {
      needed.set(r.ingredient_id, (needed.get(r.ingredient_id) || 0) + r.quantity * item.quantity);
    }
  }

  const shortages = [];
  for (const [ingredientId, qty] of needed) {
    const ingredient = await get("SELECT * FROM ingredients WHERE id = ?", ingredientId);
    if (!ingredient) continue;
    if (ingredient.stock_qty < qty) {
      shortages.push({
        name: ingredient.name,
        required: round2(qty),
        available: round2(ingredient.stock_qty),
        unit: ingredient.unit
      });
    }
  }
  if (shortages.length) {
    return { deducted: false, shortages, blocked: true };
  }

  for (const [ingredientId, qty] of needed) {
    const ingredient = await get("SELECT * FROM ingredients WHERE id = ?", ingredientId);
    if (!ingredient) continue;
    await run("UPDATE ingredients SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?", qty, nowISO(), ingredientId);
    await run(
      "INSERT INTO inventory_movements (ingredient_id, type, quantity, note, order_id, user_id, created_at) VALUES (?,?,?,?,?,?,?)",
      ingredientId, "out", qty, `Order ${order.order_number}`, orderId, userId, nowISO()
    );
  }
  await run("UPDATE orders SET stock_deducted = 1 WHERE id = ?", orderId);

  // Low stock alerts
  if (await getSetting("low_stock_alerts", "1") === "1") {
    for (const ingredient of await all("SELECT * FROM ingredients WHERE stock_qty <= low_stock_threshold")) {
      const existing = await get(
        "SELECT id FROM notifications WHERE audience = 'admin' AND type = 'low-stock' AND title = ? AND is_read = 0",
        `Low stock: ${ingredient.name}`
      );
      if (!existing) {
        await notify({
          audience: "admin", type: "low-stock", title: `Low stock: ${ingredient.name}`,
          message: `${ingredient.name} is down to ${round2(ingredient.stock_qty)} ${ingredient.unit}. Reorder soon.`
        });
      }
    }
  }
  return { deducted: true, shortages: [] };
}

async function restoreStockForOrder(orderId, userId, userName) {
  const order = await get("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order || !order.stock_deducted) return false;
  const items = await all("SELECT * FROM order_items WHERE order_id = ?", orderId);
  for (const item of items) {
    if (!item.product_id) continue;
    const recipe = await all("SELECT ingredient_id, quantity FROM product_recipes WHERE product_id = ?", item.product_id);
    for (const r of recipe) {
      const qty = r.quantity * item.quantity;
      await run("UPDATE ingredients SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?", qty, nowISO(), r.ingredient_id);
      await run(
        "INSERT INTO inventory_movements (ingredient_id, type, quantity, note, order_id, user_id, created_at) VALUES (?,?,?,?,?,?,?)",
        r.ingredient_id, "in", qty, `Returned from ${order.order_number}`, orderId, userId, nowISO()
      );
    }
  }
  await run("UPDATE orders SET stock_deducted = 0 WHERE id = ?", orderId);
  return true;
}

async function notifyAllAdmins(title, message, type = "info") {
  await notify({ audience: "admin", type, title, message });
}

/* ------------------------------------------------------------------ */
/* Setup + Auth                                                        */
/* ------------------------------------------------------------------ */

route("GET", "/api/setup/status", async ({ res }) => {
  sendJSON(res, 200, { ok: true, initialized: await isInitialized() });
});

route("POST", "/api/setup", async ({ res, body, ip }) => {
  if (await isInitialized()) return sendError(res, 409, "This system has already been initialized.");
  if (!verifySetupToken(body.setupToken)) return sendError(res, 403, "Invalid setup token. Check data/setup-token.txt on the server.");
  const fullName = requireText(body.fullName, "Full name", { max: 120 });
  const username = requireText(body.username, "Username", { max: 40 });
  const email = requireText(body.email, "Email", { max: 160 }).toLowerCase();
  if (!isEmail(email)) return sendError(res, 400, "Enter a valid email address.");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return sendError(res, 400, "Username must be 3–40 characters (letters, numbers, dot, dash, underscore).");
  const passwordError = validatePassword(body.password);
  if (passwordError) return sendError(res, 400, passwordError);
  if (body.password !== body.confirmPassword) return sendError(res, 400, "Passwords do not match.");

  const created = await tx(async () => {
    const ts = nowISO();
    const result = await run(
      "INSERT INTO users (full_name, username, email, contact, password_hash, role, status, must_change_password, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,0,NULL,?,?)",
      fullName, username, email, sanitizeText(body.contact, 40), hashPassword(body.password), "admin", "active", ts, ts
    );
    const userId = Number(result.lastInsertRowid);
    await setSetting("setup_complete", "1");
    await setSetting("shop_name", sanitizeText(body.shopName, 120) || (await getSetting("shop_name", "Trippers Coffee")));
    await logActivity({ userId, userName: fullName, role: "admin", action: "system.initialized", entity: "user", entityId: userId, details: "First administrator account created", ip });
    return get("SELECT * FROM users WHERE id = ?", userId);
  });
  completeSetup();
  sendJSON(res, 201, { ok: true, message: "Administrator account created.", user: publicUser(created) });
});

route("POST", "/api/auth/login", async ({ req, res, body, ip }) => {
  const identifier = sanitizeText(body.identifier, 160).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) return sendError(res, 400, "Enter your username or email and password.");

  if (await recentFailures(identifier, ip) >= 10) {
    return sendError(res, 429, "Too many failed attempts. Please wait 15 minutes and try again.");
  }

  const user = await get("SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?", identifier, identifier);
  if (!user) {
    await recordAttempt(identifier, ip, false);
    await logActivity({ userName: identifier.slice(0, 60), role: "unknown", action: "auth.login.failed", details: "Unknown account", ip });
    return sendError(res, 401, "We couldn't find an account with those credentials.");
  }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return sendError(res, 423, "This account is temporarily locked. Try again in a few minutes.");
  }
  if (user.status !== "active") {
    await recordAttempt(identifier, ip, false);
    return sendError(res, 403, "This account has been deactivated. Contact the administrator.");
  }
  if (!verifyPassword(password, user.password_hash)) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await run("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?", attempts, lockedUntil, user.id);
    await recordAttempt(identifier, ip, false);
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "auth.login.failed", details: "Incorrect password", ip });
    return sendError(res, 401, "Incorrect password. Please try again.");
  }

  await run("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?", nowISO(), user.id);
  await recordAttempt(identifier, ip, true);
  await createSession(req, res, user, Boolean(body.remember));
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "auth.login", details: `${user.role} signed in`, ip });

  sendJSON(res, 200, {
    ok: true,
    user: publicUser(user),
    redirect: user.role === "admin" ? "/admin/" : "/pos.html",
    mustChangePassword: Boolean(user.must_change_password)
  });
});

route("POST", "/api/auth/logout", async ({ req, res, user, ip }) => {
  if (user) await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "auth.logout", ip });
  await destroySession(req, res);
  sendJSON(res, 200, { ok: true });
});

route("GET", "/api/auth/session", async ({ res, user }) => {
  if (!user) return sendJSON(res, 200, { ok: true, authenticated: false });
  sendJSON(res, 200, {
    ok: true,
    authenticated: true,
    user: publicUser(user),
    redirect: user.role === "admin" ? "/admin/" : "/pos.html"
  });
});

route("POST", "/api/auth/change-password", async ({ res, user, body, ip }) => {
  if (!user) return sendError(res, 401, "Sign in first.");
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  if (!verifyPassword(current, user.password_hash) && !user.must_change_password) {
    return sendError(res, 400, "Your current password is incorrect.");
  }
  const error = validatePassword(body.newPassword);
  if (error) return sendError(res, 400, error);
  if (body.newPassword !== body.confirmPassword) return sendError(res, 400, "New passwords do not match.");
  if (verifyPassword(body.newPassword, user.password_hash)) return sendError(res, 400, "Choose a password different from your temporary one.");

  await run("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", hashPassword(body.newPassword), nowISO(), user.id);
  await run("DELETE FROM sessions WHERE user_id = ? AND id <> ?", user.id, user.session_id);
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "auth.password.change", details: "Password updated", ip });
  sendJSON(res, 200, { ok: true, message: "Password updated. Please keep it safe." });
});

route("POST", "/api/auth/forgot-password", async ({ res, body, ip }) => {
  const identifier = sanitizeText(body.identifier, 160).toLowerCase();
  const user = identifier ? await get("SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?", identifier, identifier) : null;
  if (user) {
    await notify({
      audience: "admin", type: "security", title: "Password reset requested",
      message: `${user.full_name} (${user.username}) requested a password reset. Reset it from Manage Cashiers.`
    });
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "auth.password.reset_requested", ip });
  }
  sendJSON(res, 200, {
    ok: true,
    message: "If that account exists, an administrator has been notified. Ask your manager to reset your password."
  });
});

/* ------------------------------------------------------------------ */
/* Cashier accounts (admin only)                                       */
/* ------------------------------------------------------------------ */

route("GET", "/api/users", async ({ res, query }) => {
  const search = sanitizeText(query.search, 80).toLowerCase();
  const status = sanitizeText(query.status, 20);
  const rows = await all(
    `SELECT u.id, u.full_name, u.username, u.email, u.contact, u.role, u.status,
            u.must_change_password, u.last_login_at, u.created_at, u.updated_at,
            c.full_name AS created_by_name
       FROM users u LEFT JOIN users c ON c.id = u.created_by
      WHERE u.role = 'cashier'
        ${search ? "AND (lower(u.full_name) LIKE ? OR lower(u.username) LIKE ? OR lower(u.email) LIKE ?)" : ""}
        ${status === "active" || status === "inactive" ? "AND u.status = ?" : ""}
      ORDER BY u.created_at DESC`,
    ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []),
    ...(status === "active" || status === "inactive" ? [status] : [])
  );
  sendJSON(res, 200, {
    ok: true,
    users: rows.map((u) => ({
      id: u.id, fullName: u.full_name, username: u.username, email: u.email, contact: u.contact,
      role: u.role, status: u.status, mustChangePassword: Boolean(u.must_change_password),
      lastLoginAt: u.last_login_at, createdAt: u.created_at, updatedAt: u.updated_at,
      createdByName: u.created_by_name || "System"
    }))
  });
});

route("POST", "/api/users", async ({ res, body, user, ip }) => {
  // Role is always forced to cashier. Admin accounts cannot be created here.
  const fullName = requireText(body.fullName, "Full name", { max: 120 });
  const username = requireText(body.username, "Username", { max: 40 });
  const email = requireText(body.email, "Email", { max: 160 }).toLowerCase();
  const contact = sanitizeText(body.contact, 40);
  const status = body.status === "inactive" ? "inactive" : "active";
  if (!isEmail(email)) return sendError(res, 400, "Enter a valid email address.");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return sendError(res, 400, "Username must be 3–40 characters (letters, numbers, dot, dash, underscore).");
  const password = typeof body.password === "string" ? body.password : "";
  const error = validatePassword(password);
  if (error) return sendError(res, 400, error);
  if (password !== body.confirmPassword) return sendError(res, 400, "Passwords do not match.");
  if (await get("SELECT id FROM users WHERE lower(username) = ?", username.toLowerCase())) return sendError(res, 409, "That username is already taken.");
  if (await get("SELECT id FROM users WHERE lower(email) = ?", email)) return sendError(res, 409, "That email is already registered.");

  const created = await tx(async () => {
    const ts = nowISO();
    const result = await run(
      "INSERT INTO users (full_name, username, email, contact, password_hash, role, status, must_change_password, created_by, created_at, updated_at) VALUES (?,?,?,?,?,'cashier',?,1,?,?,?)",
      fullName, username, email, contact, hashPassword(password), status, user.id, ts, ts
    );
    const newId = Number(result.lastInsertRowid);
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "user.cashier.created", entity: "user", entityId: newId, details: `Created cashier ${fullName} (${username})`, ip });
    await notifyAllAdmins("New cashier account created", `${fullName} can now sign in as a cashier.`, "account");
    return get("SELECT * FROM users WHERE id = ?", newId);
  });
  sendJSON(res, 201, { ok: true, user: publicUser(created), message: "Cashier account created. Share the temporary password securely." });
});

route("PATCH", "/api/users/:id", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "cashier ID");
  const target = await get("SELECT * FROM users WHERE id = ? AND role = 'cashier'", id);
  if (!target) return sendError(res, 404, "Cashier account not found.");

  const fullName = body.fullName != null ? requireText(body.fullName, "Full name", { max: 120 }) : target.full_name;
  const email = body.email != null ? requireText(body.email, "Email", { max: 160 }).toLowerCase() : target.email;
  const contact = body.contact != null ? sanitizeText(body.contact, 40) : target.contact;
  const username = body.username != null ? requireText(body.username, "Username", { max: 40 }) : target.username;
  const status = body.status === "inactive" ? "inactive" : body.status === "active" ? "active" : target.status;
  if (!isEmail(email)) return sendError(res, 400, "Enter a valid email address.");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return sendError(res, 400, "Username must be 3–40 characters.");
  const dupe = await get("SELECT id FROM users WHERE (lower(username) = ? OR lower(email) = ?) AND id <> ?", username.toLowerCase(), email, id);
  if (dupe) return sendError(res, 409, "That username or email is already in use.");

  await tx(async () => {
    await run(
      "UPDATE users SET full_name = ?, username = ?, email = ?, contact = ?, status = ?, updated_at = ? WHERE id = ?",
      fullName, username, email, contact, status, nowISO(), id
    );
    if (status === "inactive") await run("DELETE FROM sessions WHERE user_id = ?", id);
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "user.cashier.updated", entity: "user", entityId: id, details: `Updated cashier ${fullName}`, ip });
  });
  sendJSON(res, 200, { ok: true, message: "Cashier account updated.", user: publicUser(await get("SELECT * FROM users WHERE id = ?", id)) });
});

route("POST", "/api/users/:id/reset-password", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "cashier ID");
  const target = await get("SELECT * FROM users WHERE id = ? AND role = 'cashier'", id);
  if (!target) return sendError(res, 404, "Cashier account not found.");
  let password = typeof body.password === "string" && body.password ? body.password : "";
  const generated = !password;
  if (generated) password = `Trp${crypto.randomBytes(4).toString("hex")}${Math.floor(Math.random() * 90 + 10)}`;
  const error = validatePassword(password);
  if (error) return sendError(res, 400, error);

  await run("UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?", hashPassword(password), nowISO(), id);
  await run("DELETE FROM sessions WHERE user_id = ?", id);
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "user.cashier.password_reset", entity: "user", entityId: id, details: `Reset password for ${target.full_name}`, ip });
  sendJSON(res, 200, {
    ok: true,
    temporaryPassword: generated ? password : undefined,
    message: "Password reset. The cashier must choose a new password on next sign-in."
  });
});

route("GET", "/api/users/:id/activity", async ({ res, params }) => {
  const id = idParam(params.id, "cashier ID");
  const rows = await all("SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200", id);
  sendJSON(res, 200, {
    ok: true,
    activity: rows.map((r) => ({
      id: r.id, action: r.action, details: r.details, ip: r.ip, createdAt: r.created_at
    })),
    logins: await all("SELECT identifier, ip, success, created_at FROM login_attempts WHERE identifier = (SELECT lower(username) FROM users WHERE id = ?) ORDER BY created_at DESC LIMIT 50", id)
  });
});

/* ------------------------------------------------------------------ */
/* Catalog (shared)                                                    */
/* ------------------------------------------------------------------ */

async function productPayload() {
  const categories = await all("SELECT * FROM categories ORDER BY sort_order, name");
  const products = await all("SELECT * FROM products ORDER BY name");
  const sizes = await all("SELECT * FROM product_sizes ORDER BY price_delta");
  const addons = await all("SELECT * FROM addons WHERE is_active = 1 ORDER BY name");
  const links = await all("SELECT * FROM product_addons");
  return {
    categories,
    addons,
    products: products.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, description: p.description, price: p.price,
      categoryId: p.category_id, category: categories.find((c) => c.id === p.category_id)?.name || "",
      emoji: p.emoji, image: p.image, hasSizes: Boolean(p.has_sizes),
      isFeatured: Boolean(p.is_featured), isAvailable: Boolean(p.is_available),
      sizes: sizes.filter((s) => s.product_id === p.id),
      addonIds: links.filter((l) => l.product_id === p.id).map((l) => l.addon_id)
    }))
  };
}

route("GET", "/api/catalog", async ({ res }) => {
  sendJSON(res, 200, { ok: true, ...(await productPayload()) });
});

route("GET", "/api/products", async ({ res, query }) => {
  const payload = await productPayload();
  const search = sanitizeText(query.search, 80).toLowerCase();
  const category = toNumber(query.categoryId, 0);
  let products = payload.products;
  if (search) products = products.filter((p) => p.name.toLowerCase().includes(search));
  if (category) products = products.filter((p) => p.categoryId === category);
  sendJSON(res, 200, { ok: true, products, categories: payload.categories, addons: payload.addons });
});

async function saveProduct({ body, user, ip, existing }) {
  const name = requireText(body.name, "Product name", { max: 120 });
  const categoryId = idParam(body.categoryId, "category");
  if (!await get("SELECT id FROM categories WHERE id = ?", categoryId)) fail(400, "Choose a valid category.");
  const price = round2(toNumber(body.price, -1));
  if (price < 0) fail(400, "Enter a valid product price.");
  const description = sanitizeText(body.description, 600);
  const emoji = sanitizeText(body.emoji, 8) || "☕";
  const hasSizes = body.hasSizes ? 1 : 0;
  const isFeatured = body.isFeatured ? 1 : 0;
  const isAvailable = body.isAvailable === false ? 0 : 1;
  const image = sanitizeText(body.image, 1000);
  const ts = nowISO();

  return tx(async () => {
    let productId;
    if (existing) {
      await run(
        "UPDATE products SET category_id=?, name=?, description=?, price=?, emoji=?, image=?, has_sizes=?, is_featured=?, is_available=?, updated_at=? WHERE id=?",
        categoryId, name, description, price, emoji, image, hasSizes, isFeatured, isAvailable, ts, existing.id
      );
      productId = existing.id;
      await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "product.updated", entity: "product", entityId: productId, details: name, ip });
    } else {
      let slug = slugify(name) || `product-${Date.now()}`;
      if (await get("SELECT id FROM products WHERE slug = ?", slug)) slug = `${slug}-${Date.now().toString(36)}`;
      const result = await run(
        "INSERT INTO products (category_id, name, slug, description, price, image, emoji, has_sizes, is_featured, is_available, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        categoryId, name, slug, description, price, image, emoji, hasSizes, isFeatured, isAvailable, ts, ts
      );
      productId = Number(result.lastInsertRowid);
      await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "product.created", entity: "product", entityId: productId, details: name, ip });
    }

    if (body.hasSizes !== undefined || Array.isArray(body.sizes)) {
      await run("DELETE FROM product_sizes WHERE product_id = ?", productId);
      if (hasSizes) {
        const sizes = Array.isArray(body.sizes) && body.sizes.length
          ? body.sizes
          : [{ name: "Small", priceDelta: -10 }, { name: "Medium", priceDelta: 0 }, { name: "Large", priceDelta: 15 }];
        for (const size of sizes) {
          const sizeName = sanitizeText(size.name, 30);
          if (!sizeName) continue;
          await run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, sizeName, round2(toNumber(size.priceDelta, 0)));
        }
      }
    }

    if (Array.isArray(body.addonIds)) {
      await run("DELETE FROM product_addons WHERE product_id = ?", productId);
      const addonIds = body.addonIds.map(Number).filter(Boolean);
      for (const addonId of addonIds) {
        if (await get("SELECT id FROM addons WHERE id = ?", addonId)) {
          await run("INSERT INTO product_addons (product_id, addon_id) VALUES (?,?)", productId, addonId);
        }
      }
    }

    if (Array.isArray(body.recipe)) {
      await run("DELETE FROM product_recipes WHERE product_id = ?", productId);
      for (const row of body.recipe) {
        const ingredientId = Number(row.ingredientId);
        const qty = toNumber(row.quantity, 0);
        if (qty > 0 && await get("SELECT id FROM ingredients WHERE id = ?", ingredientId)) {
          await run("INSERT INTO product_recipes (product_id, ingredient_id, quantity) VALUES (?,?,?)", productId, ingredientId, qty);
        }
      }
    }
    return productId;
  });
}

route("POST", "/api/products", async ({ res, body, user, ip }) => {
  const id = await saveProduct({ body, user, ip });
  sendJSON(res, 201, { ok: true, id, message: "Product created." });
});

route("PATCH", "/api/products/:id", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "product ID");
  const existing = await get("SELECT * FROM products WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Product not found.");
  await saveProduct({ body, user, ip, existing });
  sendJSON(res, 200, { ok: true, message: "Product updated." });
});

route("DELETE", "/api/products/:id", async ({ res, params, user, ip }) => {
  const id = idParam(params.id, "product ID");
  const existing = await get("SELECT * FROM products WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Product not found.");
  await run("DELETE FROM products WHERE id = ?", id);
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "product.deleted", entity: "product", entityId: id, details: existing.name, ip });
  sendJSON(res, 200, { ok: true, message: "Product deleted." });
});

route("GET", "/api/categories", async ({ res }) => {
  sendJSON(res, 200, { ok: true, categories: await all("SELECT * FROM categories ORDER BY sort_order, name") });
});

route("POST", "/api/categories", async ({ res, body, user, ip }) => {
  const name = requireText(body.name, "Category name", { max: 80 });
  if (await get("SELECT id FROM categories WHERE lower(name) = ?", name.toLowerCase())) return sendError(res, 409, "That category already exists.");
  const result = await run("INSERT INTO categories (name, sort_order, created_at) VALUES (?,?,?)", name, toNumber(body.sortOrder, 99), nowISO());
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "category.created", entity: "category", entityId: result.lastInsertRowid, details: name, ip });
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
});

route("PATCH", "/api/categories/:id", async ({ res, params, body }) => {
  const id = idParam(params.id, "category ID");
  const name = requireText(body.name, "Category name", { max: 80 });
  if (!await get("SELECT id FROM categories WHERE id = ?", id)) return sendError(res, 404, "Category not found.");
  await run("UPDATE categories SET name = ? WHERE id = ?", name, id);
  sendJSON(res, 200, { ok: true });
});

route("DELETE", "/api/categories/:id", async ({ res, params }) => {
  const id = idParam(params.id, "category ID");
  const used = await get("SELECT COUNT(*) AS n FROM products WHERE category_id = ?", id);
  if (used && used.n > 0) return sendError(res, 409, "Move or delete the products in this category first.");
  await run("DELETE FROM categories WHERE id = ?", id);
  sendJSON(res, 200, { ok: true });
});

route("GET", "/api/addons", async ({ res }) => {
  sendJSON(res, 200, { ok: true, addons: await all("SELECT * FROM addons ORDER BY name") });
});

route("POST", "/api/addons", async ({ res, body }) => {
  const name = requireText(body.name, "Add-on name", { max: 80 });
  if (await get("SELECT id FROM addons WHERE lower(name) = ?", name.toLowerCase())) return sendError(res, 409, "That add-on already exists.");
  const result = await run("INSERT INTO addons (name, price, is_active) VALUES (?,?,1)", name, round2(toNumber(body.price, 0)));
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
});

route("PATCH", "/api/addons/:id", async ({ res, params, body }) => {
  const id = idParam(params.id, "add-on ID");
  const name = requireText(body.name, "Add-on name", { max: 80 });
  await run("UPDATE addons SET name = ?, price = ?, is_active = ? WHERE id = ?", name, round2(toNumber(body.price, 0)), body.isActive === false ? 0 : 1, id);
  sendJSON(res, 200, { ok: true });
});

route("DELETE", "/api/addons/:id", async ({ res, params }) => {
  const id = idParam(params.id, "add-on ID");
  await run("DELETE FROM addons WHERE id = ?", id);
  sendJSON(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Inventory + suppliers                                               */
/* ------------------------------------------------------------------ */

route("GET", "/api/ingredients", async ({ res }) => {
  const ingredients = (await all(
    `SELECT i.*, s.name AS supplier_name
       FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id
      ORDER BY i.name`
  )).map((i) => ({ ...i, isLow: i.stock_qty <= i.low_stock_threshold, isOut: i.stock_qty <= 0 }));
  sendJSON(res, 200, { ok: true, ingredients });
});

route("POST", "/api/ingredients", async ({ res, body, user, ip }) => {
  const name = requireText(body.name, "Ingredient name", { max: 120 });
  if (await get("SELECT id FROM ingredients WHERE lower(name) = ?", name.toLowerCase())) return sendError(res, 409, "That ingredient already exists.");
  const ts = nowISO();
  const result = await run(
    "INSERT INTO ingredients (name, category, unit, stock_qty, low_stock_threshold, cost_per_unit, supplier_id, expiry_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    name, sanitizeText(body.category, 60) || "Other Supplies", sanitizeText(body.unit, 20) || "pcs",
    Math.max(0, toNumber(body.stockQty, 0)), Math.max(0, toNumber(body.lowStockThreshold, 0)),
    Math.max(0, toNumber(body.costPerUnit, 0)), body.supplierId ? Number(body.supplierId) : null,
    sanitizeText(body.expiryDate, 20) || null, ts, ts
  );
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "ingredient.created", entity: "ingredient", entityId: result.lastInsertRowid, details: name, ip });
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
});

route("PATCH", "/api/ingredients/:id", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "ingredient ID");
  const existing = await get("SELECT * FROM ingredients WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Ingredient not found.");
  await run(
    "UPDATE ingredients SET name=?, category=?, unit=?, low_stock_threshold=?, cost_per_unit=?, supplier_id=?, expiry_date=?, updated_at=? WHERE id=?",
    body.name != null ? requireText(body.name, "Ingredient name", { max: 120 }) : existing.name,
    body.category != null ? sanitizeText(body.category, 60) : existing.category,
    body.unit != null ? sanitizeText(body.unit, 20) : existing.unit,
    body.lowStockThreshold != null ? Math.max(0, toNumber(body.lowStockThreshold, 0)) : existing.low_stock_threshold,
    body.costPerUnit != null ? Math.max(0, toNumber(body.costPerUnit, 0)) : existing.cost_per_unit,
    body.supplierId !== undefined ? (body.supplierId ? Number(body.supplierId) : null) : existing.supplier_id,
    body.expiryDate !== undefined ? (sanitizeText(body.expiryDate, 20) || null) : existing.expiry_date,
    nowISO(), id
  );
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "ingredient.updated", entity: "ingredient", entityId: id, details: existing.name, ip });
  sendJSON(res, 200, { ok: true });
});

route("DELETE", "/api/ingredients/:id", async ({ res, params, user, ip }) => {
  const id = idParam(params.id, "ingredient ID");
  const existing = await get("SELECT * FROM ingredients WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Ingredient not found.");
  await run("DELETE FROM ingredients WHERE id = ?", id);
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "ingredient.deleted", entity: "ingredient", entityId: id, details: existing.name, ip });
  sendJSON(res, 200, { ok: true });
});

route("POST", "/api/inventory/adjust", async ({ res, body, user, ip }) => {
  const ingredientId = idParam(body.ingredientId, "ingredient");
  const type = ["in", "out", "waste", "adjustment"].includes(body.type) ? body.type : "in";
  const quantity = toNumber(body.quantity, 0);
  if (quantity <= 0) return sendError(res, 400, "Enter a quantity greater than zero.");
  const ingredient = await get("SELECT * FROM ingredients WHERE id = ?", ingredientId);
  if (!ingredient) return sendError(res, 404, "Ingredient not found.");
  const delta = type === "in" ? quantity : -quantity;
  if (type !== "adjustment" && ingredient.stock_qty + delta < 0) {
    return sendError(res, 400, `Only ${round2(ingredient.stock_qty)} ${ingredient.unit} of ${ingredient.name} is available.`);
  }
  const newQty = type === "adjustment" ? quantity : ingredient.stock_qty + delta;
  if (newQty < 0) return sendError(res, 400, "Stock cannot be negative.");
  await tx(async () => {
    await run("UPDATE ingredients SET stock_qty = ?, updated_at = ? WHERE id = ?", newQty, nowISO(), ingredientId);
    await run(
      "INSERT INTO inventory_movements (ingredient_id, type, quantity, note, user_id, created_at) VALUES (?,?,?,?,?,?)",
      ingredientId, type, quantity, sanitizeText(body.note, 300), user.id, nowISO()
    );
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: `inventory.${type}`, entity: "ingredient", entityId: ingredientId, details: `${quantity} ${ingredient.unit} of ${ingredient.name}`, ip });
  });
  sendJSON(res, 200, { ok: true, stockQty: round2(newQty) });
});

route("GET", "/api/inventory/movements", async ({ res, query }) => {
  const limit = Math.min(500, Math.max(1, toNumber(query.limit, 150)));
  const ingredientId = toNumber(query.ingredientId, 0);
  const rows = await all(
    `SELECT m.*, i.name AS ingredient_name, i.unit, u.full_name AS user_name
       FROM inventory_movements m
       JOIN ingredients i ON i.id = m.ingredient_id
       LEFT JOIN users u ON u.id = m.user_id
      ${ingredientId ? "WHERE m.ingredient_id = ?" : ""}
      ORDER BY m.created_at DESC LIMIT ?`,
    ...(ingredientId ? [ingredientId] : []), limit
  );
  sendJSON(res, 200, { ok: true, movements: rows });
});

route("GET", "/api/suppliers", async ({ res }) => {
  sendJSON(res, 200, { ok: true, suppliers: await all("SELECT * FROM suppliers ORDER BY name") });
});

route("POST", "/api/suppliers", async ({ res, body }) => {
  const name = requireText(body.name, "Supplier name", { max: 120 });
  if (await get("SELECT id FROM suppliers WHERE lower(name) = ?", name.toLowerCase())) return sendError(res, 409, "That supplier already exists.");
  const result = await run(
    "INSERT INTO suppliers (name, contact, email, notes, created_at) VALUES (?,?,?,?,?)",
    name, sanitizeText(body.contact, 60), sanitizeText(body.email, 160), sanitizeText(body.notes, 400), nowISO()
  );
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
});

route("PATCH", "/api/suppliers/:id", async ({ res, params, body }) => {
  const id = idParam(params.id, "supplier ID");
  const existing = await get("SELECT * FROM suppliers WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Supplier not found.");
  await run(
    "UPDATE suppliers SET name=?, contact=?, email=?, notes=? WHERE id=?",
    body.name != null ? requireText(body.name, "Supplier name", { max: 120 }) : existing.name,
    body.contact != null ? sanitizeText(body.contact, 60) : existing.contact,
    body.email != null ? sanitizeText(body.email, 160) : existing.email,
    body.notes != null ? sanitizeText(body.notes, 400) : existing.notes,
    id
  );
  sendJSON(res, 200, { ok: true });
});

route("DELETE", "/api/suppliers/:id", async ({ res, params }) => {
  const id = idParam(params.id, "supplier ID");
  await run("DELETE FROM suppliers WHERE id = ?", id);
  sendJSON(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

route("GET", "/api/customers", async ({ res, query }) => {
  const search = sanitizeText(query.search, 80).toLowerCase();
  const rows = await all(
    `SELECT c.*, COUNT(o.id) AS order_count, COALESCE(SUM(CASE WHEN o.payment_status='paid' AND o.status<>'cancelled' THEN o.total ELSE 0 END),0) AS total_spent
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
      ${search ? "WHERE lower(c.name) LIKE ? OR c.contact LIKE ? OR lower(c.email) LIKE ?" : ""}
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 300`,
    ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [])
  );
  sendJSON(res, 200, { ok: true, customers: rows });
});

route("POST", "/api/customers", async ({ res, body, user }) => {
  const name = requireText(body.name, "Customer name", { max: 120 });
  const contact = sanitizeText(body.contact, 40);
  const email = sanitizeText(body.email, 160);
  const existing = contact
    ? await get("SELECT * FROM customers WHERE contact = ? AND lower(name) = ?", contact, name.toLowerCase())
    : null;
  if (existing) return sendJSON(res, 200, { ok: true, customer: existing, existing: true });
  const ts = nowISO();
  const result = await run("INSERT INTO customers (name, contact, email, notes, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    name, contact, email, sanitizeText(body.notes, 300), ts, ts);
  sendJSON(res, 201, { ok: true, customer: await get("SELECT * FROM customers WHERE id = ?", Number(result.lastInsertRowid)) });
});

route("PATCH", "/api/customers/:id", async ({ res, params, body }) => {
  const id = idParam(params.id, "customer ID");
  const existing = await get("SELECT * FROM customers WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Customer not found.");
  await run("UPDATE customers SET name=?, contact=?, email=?, notes=?, updated_at=? WHERE id=?",
    body.name != null ? requireText(body.name, "Customer name", { max: 120 }) : existing.name,
    body.contact != null ? sanitizeText(body.contact, 40) : existing.contact,
    body.email != null ? sanitizeText(body.email, 160) : existing.email,
    body.notes != null ? sanitizeText(body.notes, 300) : existing.notes,
    nowISO(), id);
  sendJSON(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

route("GET", "/api/orders", async ({ res, query }) => {
  const status = sanitizeText(query.status, 20);
  const payment = sanitizeText(query.payment, 20);
  const method = sanitizeText(query.method, 40);
  const cashierId = toNumber(query.cashierId, 0);
  const search = sanitizeText(query.search, 80);
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  let where = ["o.biz_date BETWEEN ? AND ?"];
  const params = [start, end];
  if (["pending", "preparing", "ready", "completed", "cancelled"].includes(status)) { where.push("o.status = ?"); params.push(status); }
  if (["unpaid", "paid", "refunded"].includes(payment)) { where.push("o.payment_status = ?"); params.push(payment); }
  if (method) { where.push("o.payment_method = ?"); params.push(method); }
  if (cashierId) { where.push("o.cashier_id = ?"); params.push(cashierId); }
  if (search) { where.push("(o.order_number LIKE ? OR lower(o.customer_name) LIKE ?)"); params.push(`%${search}%`, `%${search.toLowerCase()}%`); }
  const orders = await orderListQuery(where.join(" AND "), params, Math.min(500, toNumber(query.limit, 200)));
  const enriched = await Promise.all(orders.map(async (o) => {
    const items = await all("SELECT * FROM order_items WHERE order_id = ?", o.id);
    const refund = await get("SELECT * FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1", o.id);
    return {
      ...o,
      items: items.map((i) => ({ ...i, addons: parseJSON(i.addons, []) })),
      refund: refund || null
    };
  }));
  sendJSON(res, 200, {
    ok: true,
    range: { ...{ start, end }, label: rangeLabel(start, end) },
    orders: enriched
  });
});

route("GET", "/api/orders/mine", async ({ res, query, user }) => {
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  const status = sanitizeText(query.status, 20);
  const search = sanitizeText(query.search, 80);
  let where = "o.cashier_id = ? AND o.biz_date BETWEEN ? AND ?";
  const params = [user.id, start, end];
  if (["pending", "preparing", "ready", "completed", "cancelled"].includes(status)) { where += " AND o.status = ?"; params.push(status); }
  if (search) { where += " AND (o.order_number LIKE ? OR lower(o.customer_name) LIKE ?)"; params.push(`%${search}%`, `%${search.toLowerCase()}%`); }
  const orders = await orderListQuery(where, params, 300);
  const enriched = await Promise.all(orders.map(async (o) => {
    const items = await all("SELECT * FROM order_items WHERE order_id = ?", o.id);
    return {
      ...o,
      items: items.map((i) => ({ ...i, addons: parseJSON(i.addons, []) }))
    };
  }));
  sendJSON(res, 200, { ok: true, orders: enriched });
});

route("POST", "/api/orders", async ({ res, body, user, ip }) => {
  if (user.role === "admin") return sendError(res, 403, "Admin accounts cannot create POS orders. Sign in as a cashier.");
  const lines = await buildLineItems(body.items);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const totals = await computeTotals(subtotal, body.discountId, body.discountReference);
  const notes = sanitizeText(body.notes, 500);

  let customerId = null;
  let customerName = sanitizeText(body.customerName, 120) || "Walk-in guest";
  if (body.customerId) {
    const customer = await get("SELECT * FROM customers WHERE id = ?", Number(body.customerId));
    if (customer) { customerId = customer.id; customerName = customer.name; }
  } else if (customerName !== "Walk-in guest") {
    const ts = nowISO();
    const contact = sanitizeText(body.customerContact, 40);
    const email = sanitizeText(body.customerEmail, 160);
    const existing = contact
      ? await get("SELECT * FROM customers WHERE contact = ? AND lower(name) = ?", contact, customerName.toLowerCase())
      : null;
    if (existing) { customerId = existing.id; customerName = existing.name; }
    else {
      const result = await run("INSERT INTO customers (name, contact, email, notes, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        customerName, contact, email, "", ts, ts);
      customerId = Number(result.lastInsertRowid);
    }
  }

  const created = await tx(async () => {
    const ts = nowISO();
    const orderNumber = await newOrderNumber();
    const result = await run(
      `INSERT INTO orders (order_number, customer_id, customer_name, cashier_id, cashier_name, status, payment_status,
                           subtotal, discount, discount_id, discount_label, tax, service_charge, total, payment_method,
                           stock_deducted, notes, biz_date, created_at, updated_at)
       VALUES (?,?,?,?,?,'pending','unpaid',?,?,?,?,?,?,?,'',0,?,?,?,?)`,
      orderNumber, customerId, customerName, user.id, user.full_name,
      subtotal, totals.discount, totals.discountId, totals.discountLabel, totals.tax, totals.service, totals.total,
      notes, dateKey(), ts, ts
    );
    const orderId = Number(result.lastInsertRowid);
    for (const line of lines) {
      await run(
        "INSERT INTO order_items (order_id, product_id, product_name, category_name, size, addons, unit_price, quantity, notes, line_total) VALUES (?,?,?,?,?,?,?,?,?,?)",
        orderId, line.productId, line.productName, line.categoryName, line.size, JSON.stringify(line.addons), line.unitPrice, line.quantity, line.notes, line.lineTotal
      );
    }
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "order.created", entity: "order", entityId: orderId, details: `${orderNumber} • ${customerName}`, ip });
    return orderId;
  });

  const order = await readOrder(created);
  sendJSON(res, 201, { ok: true, order: publicOrder(order), totals, message: "Order saved as pending." });
});

route("GET", "/api/orders/:id", async ({ res, params, user }) => {
  const id = idParam(params.id, "order ID");
  const order = await readOrder(id);
  if (user.role === "cashier" && order.cashier_id !== user.id) {
    return sendError(res, 403, "You can only view your own orders.");
  }
  sendJSON(res, 200, { ok: true, order: publicOrder(order) });
});

async function payOrder({ res, orderId, body, user, ip }) {
  const order = await get("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) return sendError(res, 404, "Order not found.");
  if (user.role === "cashier" && order.cashier_id !== user.id) return sendError(res, 403, "You can only process your own orders.");
  if (order.payment_status === "paid") return sendError(res, 409, "This order has already been paid.");
  if (order.status === "cancelled") return sendError(res, 409, "This order was cancelled.");
  if (order.status === "completed" && order.payment_status === "paid") return sendError(res, 409, "This order is already complete.");

  const method = sanitizeText(body.method, 40);
  const methods = await paymentMethods();
  if (!methods.includes(method)) return sendError(res, 400, "Choose a valid payment method.");
  const tendered = method === "Cash" ? round2(toNumber(body.tendered, 0)) : round2(toNumber(body.amount, order.total));
  const reference = sanitizeText(body.reference, 80);

  if (method === "Cash") {
    if (tendered < order.total) return sendError(res, 400, "Cash tendered is less than the amount due.");
  } else {
    if (!reference) return sendError(res, 400, `${method} payments require a confirmation or reference number.`);
    if (body.confirmed !== true) return sendError(res, 400, "Confirm that the digital payment was received before completing the sale.");
  }

  const change = method === "Cash" ? round2(tendered - order.total) : 0;
  const ts = nowISO();
  const symbol = await SYMBOL();

  const result = await tx(async () => {
    const updated = await run(
      "UPDATE orders SET payment_status='paid', status='completed', payment_method=?, completed_at=?, updated_at=? WHERE id=? AND payment_status='unpaid'",
      method, ts, ts, orderId
    );
    if (!updated.changes) {
      const error = new Error("This order was already paid.");
      error.status = 409;
      error.expose = true;
      throw error;
    }
    await run(
      "INSERT INTO payments (order_id, cashier_id, method, amount, tendered, change_due, reference, status, created_at) VALUES (?,?,?,?,?,?,?, 'paid', ?)",
      orderId, user.id, method, order.total, tendered, change, reference, ts
    );

    const deduction = await deductStockForOrder(orderId, user.id, user.full_name);
    if (deduction.blocked) {
      const error = new Error(
        `Not enough stock to complete this sale: ${deduction.shortages.map((s) => `${s.name} (need ${s.required} ${s.unit}, have ${s.available})`).join(", ")}.`
      );
      error.status = 409;
      error.expose = true;
      throw error;
    }

    const shift = await get("SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", order.cashier_id);
    if (shift) {
      await run("UPDATE shifts SET total_sales = total_sales + ?, order_count = order_count + 1 WHERE id = ?", order.total, shift.id);
    }

    const numberRow = await get("SELECT order_number FROM orders WHERE id = ?", orderId);
    const number = numberRow.order_number;
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "order.paid", entity: "order", entityId: orderId, details: `${number} • ${method} • ${symbol}${Number(order.total).toFixed(2)}`, ip });
    await notify({
      audience: "cashier", userId: order.cashier_id, type: "payment",
      title: "Payment received", message: `${number} completed via ${method}.`
    });
    if (order.total >= 1000) {
      await notifyAllAdmins("Large sale completed", `${number} for ${order.customer_name} totalled ${symbol}${Number(order.total).toFixed(2)}.`, "sales");
    }
    return number;
  });

  sendJSON(res, 200, {
    ok: true,
    order: publicOrder(await readOrder(orderId)),
    change,
    transactionId: result,
    message: "Payment accepted. Order sent to the bar."
  });
}

route("POST", "/api/orders/:id/pay", async ({ res, params, body, user, ip }) => {
  await payOrder({ res, orderId: idParam(params.id, "order ID"), body, user, ip });
});

route("PATCH", "/api/orders/:id", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "order ID");
  const order = await get("SELECT * FROM orders WHERE id = ?", id);
  if (!order) return sendError(res, 404, "Order not found.");
  if (user.role === "cashier" && order.cashier_id !== user.id) return sendError(res, 403, "You can only update your own orders.");

  const status = sanitizeText(body.status, 20);
  if (!["pending", "preparing", "ready", "completed", "cancelled"].includes(status)) return sendError(res, 400, "Invalid order status.");
  if (status === "cancelled") {
    if (order.payment_status === "paid" && user.role !== "admin") {
      return sendError(res, 403, "Paid orders can only be cancelled by an administrator through a refund.");
    }
    const reason = requireText(body.reason, "Cancellation reason", { max: 300 });
    await tx(async () => {
      await run("UPDATE orders SET status='cancelled', cancelled_at=?, cancel_reason=?, updated_at=? WHERE id=?", nowISO(), reason, nowISO(), id);
      if (order.payment_status === "paid") {
        await run("UPDATE orders SET payment_status='refunded' WHERE id=?", id);
        await run("UPDATE payments SET status='refunded' WHERE order_id=?", id);
        await run(
          "INSERT INTO refunds (order_id, amount, reason, status, requested_by, decided_by, created_at, decided_at) VALUES (?,?,?,'approved',NULL,?,?,?)",
          id, order.total, reason, user.id, nowISO(), nowISO()
        );
        await restoreStockForOrder(id, user.id, user.full_name);
      }
      await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "order.cancelled", entity: "order", entityId: id, details: `${order.order_number} • ${reason}`, ip });
    });
  } else if (status === "completed" && order.payment_status !== "paid") {
    return sendError(res, 400, "Take payment before marking this order complete.");
  } else {
    await run("UPDATE orders SET status=?, updated_at=? WHERE id=?", status, nowISO(), id);
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "order.status", entity: "order", entityId: id, details: `${order.order_number} → ${status}`, ip });
  }
  sendJSON(res, 200, { ok: true, order: publicOrder(await readOrder(id)) });
});

route("POST", "/api/orders/:id/refund-request", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "order ID");
  const order = await get("SELECT * FROM orders WHERE id = ?", id);
  if (!order) return sendError(res, 404, "Order not found.");
  if (user.role === "cashier" && order.cashier_id !== user.id) return sendError(res, 403, "You can only request refunds for your own orders.");
  if (order.payment_status !== "paid") return sendError(res, 400, "Only paid orders can be refunded.");
  if (await get("SELECT id FROM refunds WHERE order_id = ? AND status = 'pending'", id)) return sendError(res, 409, "A refund request is already pending for this order.");
  const reason = requireText(body.reason, "Refund reason", { max: 400 });
  const result = await run(
    "INSERT INTO refunds (order_id, amount, reason, status, requested_by, created_at) VALUES (?,?,?,'pending',?,?)",
    id, order.total, reason, user.id, nowISO()
  );
  const symbol = await SYMBOL();
  await notifyAllAdmins("Refund request pending", `${user.full_name} requested a refund for ${order.order_number} (${symbol}${Number(order.total).toFixed(2)}).`, "refund");
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "refund.requested", entity: "order", entityId: id, details: reason, ip });
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid), message: "Refund request submitted for admin approval." });
});

/* ------------------------------------------------------------------ */
/* Receipts                                                            */
/* ------------------------------------------------------------------ */

async function receiptPayload(orderId, user) {
  const order = await readOrder(orderId);
  if (user.role === "cashier" && order.cashier_id !== user.id) fail(403, "You can only view your own receipts.");
  const settings = {
    shopName: await getSetting("shop_name", "Trippers Coffee"),
    address: await getSetting("address", ""),
    contact: await getSetting("contact", ""),
    email: await getSetting("email", ""),
    header: await getSetting("receipt_header", "TRIPPERS COFFEE"),
    footer: await getSetting("receipt_footer", ""),
    showLogo: await getSetting("receipt_show_logo", "1") === "1",
    symbol: await SYMBOL()
  };
  return { ...publicOrder(order), settings };
}

route("GET", "/api/receipts", async ({ res, query, user }) => {
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  const where = user.role === "cashier"
    ? "o.cashier_id = ? AND o.payment_status = 'paid' AND o.biz_date BETWEEN ? AND ?"
    : "o.payment_status = 'paid' AND o.biz_date BETWEEN ? AND ?";
  const params = user.role === "cashier" ? [user.id, start, end] : [start, end];
  const orders = await orderListQuery(where, params, 300);
  const receipts = await Promise.all(orders.map(async (o) => ({
    ...o,
    items: await all("SELECT * FROM order_items WHERE order_id = ?", o.id)
  })));
  sendJSON(res, 200, { ok: true, receipts });
});

route("GET", "/api/orders/:id/receipt", async ({ res, params, user }) => {
  sendJSON(res, 200, { ok: true, receipt: await receiptPayload(idParam(params.id, "order ID"), user) });
});

/* ------------------------------------------------------------------ */
/* Discounts                                                           */
/* ------------------------------------------------------------------ */

route("GET", "/api/discounts", async ({ res }) => {
  sendJSON(res, 200, {
    ok: true,
    discounts: (await all("SELECT * FROM discounts ORDER BY is_active DESC, name")).map((d) => ({
      ...d, requiresId: Boolean(d.requires_id), isActive: Boolean(d.is_active)
    }))
  });
});

route("POST", "/api/discounts", async ({ res, body, user, ip }) => {
  const name = requireText(body.name, "Discount name", { max: 80 });
  const type = body.type === "fixed" ? "fixed" : "percent";
  const value = toNumber(body.value, 0);
  if (value <= 0) return sendError(res, 400, "Enter a discount value greater than zero.");
  if (type === "percent" && value > 100) return sendError(res, 400, "Percentage discount cannot exceed 100%.");
  const result = await run(
    "INSERT INTO discounts (name, type, value, requires_id, is_active, created_at) VALUES (?,?,?,?,?,?)",
    name, type, value, body.requiresId ? 1 : 0, body.isActive === false ? 0 : 1, nowISO()
  );
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "discount.created", entity: "discount", entityId: result.lastInsertRowid, details: name, ip });
  sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
});

route("PATCH", "/api/discounts/:id", async ({ res, params, body }) => {
  const id = idParam(params.id, "discount ID");
  const existing = await get("SELECT * FROM discounts WHERE id = ?", id);
  if (!existing) return sendError(res, 404, "Discount not found.");
  await run(
    "UPDATE discounts SET name=?, type=?, value=?, requires_id=?, is_active=? WHERE id=?",
    body.name != null ? requireText(body.name, "Discount name", { max: 80 }) : existing.name,
    body.type === "fixed" ? "fixed" : body.type === "percent" ? "percent" : existing.type,
    body.value != null ? toNumber(body.value, existing.value) : existing.value,
    body.requiresId != null ? (body.requiresId ? 1 : 0) : existing.requires_id,
    body.isActive != null ? (body.isActive ? 1 : 0) : existing.is_active,
    id
  );
  sendJSON(res, 200, { ok: true });
});

route("DELETE", "/api/discounts/:id", async ({ res, params }) => {
  await run("DELETE FROM discounts WHERE id = ?", idParam(params.id, "discount ID"));
  sendJSON(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Refunds (admin)                                                     */
/* ------------------------------------------------------------------ */

route("GET", "/api/refunds", async ({ res, query }) => {
  const status = sanitizeText(query.status, 20);
  const rows = await all(
    `SELECT r.*, o.order_number, o.total AS order_total, o.customer_name, o.payment_method,
            u.full_name AS requested_by_name, d.full_name AS decided_by_name
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN users u ON u.id = r.requested_by
       LEFT JOIN users d ON d.id = r.decided_by
      ${["pending", "approved", "rejected"].includes(status) ? "WHERE r.status = ?" : ""}
      ORDER BY r.created_at DESC LIMIT 300`,
    ...(["pending", "approved", "rejected"].includes(status) ? [status] : [])
  );
  sendJSON(res, 200, { ok: true, refunds: rows });
});

route("POST", "/api/refunds/:id/decide", async ({ res, params, body, user, ip }) => {
  const id = idParam(params.id, "refund ID");
  const refund = await get("SELECT * FROM refunds WHERE id = ?", id);
  if (!refund) return sendError(res, 404, "Refund request not found.");
  if (refund.status !== "pending") return sendError(res, 409, "This refund has already been decided.");
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : null;
  if (!decision) return sendError(res, 400, "Choose approved or rejected.");

  await tx(async () => {
    await run("UPDATE refunds SET status=?, decided_by=?, decided_at=? WHERE id=?", decision, user.id, nowISO(), id);
    if (decision === "approved") {
      await run("UPDATE orders SET payment_status='refunded', status='cancelled', cancelled_at=?, cancel_reason=? WHERE id=?",
        nowISO(), refund.reason, refund.order_id);
      await run("UPDATE payments SET status='refunded' WHERE order_id=?", refund.order_id);
      await restoreStockForOrder(refund.order_id, user.id, user.full_name);
    }
    const order = await get("SELECT order_number FROM orders WHERE id = ?", refund.order_id);
    await notify({
      audience: "admin", type: "refund", title: `Refund ${decision}`,
      message: `${order.order_number} refund was ${decision} by ${user.full_name}.`
    });
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: `refund.${decision}`, entity: "order", entityId: refund.order_id, details: refund.reason, ip });
  });
  sendJSON(res, 200, { ok: true, message: `Refund ${decision}.` });
});

/* ------------------------------------------------------------------ */
/* Shifts                                                              */
/* ------------------------------------------------------------------ */

route("GET", "/api/shifts", async ({ res, query, user }) => {
  const scope = user.role === "cashier" ? "WHERE s.cashier_id = ?" : "";
  const params = user.role === "cashier" ? [user.id] : [];
  const rows = await all(
    `SELECT s.*, u.full_name AS cashier_name FROM shifts s JOIN users u ON u.id = s.cashier_id
      ${scope} ORDER BY s.clock_in DESC LIMIT 200`, ...params
  );
  sendJSON(res, 200, { ok: true, shifts: rows });
});

route("GET", "/api/shifts/current", async ({ res, user }) => {
  const shift = await get("SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", user.id);
  if (!shift) return sendJSON(res, 200, { ok: true, shift: null });
  const sales = await get(
    "SELECT COALESCE(SUM(o.total),0) AS total, COUNT(*) AS orders FROM orders o WHERE o.cashier_id = ? AND o.payment_status='paid' AND o.status<>'cancelled' AND o.created_at >= ?",
    user.id, shift.clock_in
  );
  const cashSales = await get(
    "SELECT COALESCE(SUM(o.total),0) AS total FROM orders o WHERE o.cashier_id = ? AND o.payment_status='paid' AND o.status<>'cancelled' AND o.payment_method='Cash' AND o.created_at >= ?",
    user.id, shift.clock_in
  );
  sendJSON(res, 200, {
    ok: true, shift,
    summary: { totalSales: sales.total, orders: sales.orders, cashSales: cashSales.total, expectedCash: round2(shift.opening_cash + cashSales.total) }
  });
});

route("POST", "/api/shifts/clock-in", async ({ res, body, user, ip }) => {
  if (user.role === "admin") return sendError(res, 403, "Admins do not clock in.");
  const open = await get("SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open'", user.id);
  if (open) return sendError(res, 409, "You already have an open shift.");
  const opening = round2(toNumber(body.openingCash, 0));
  if (opening < 0) return sendError(res, 400, "Opening cash cannot be negative.");
  const result = await run(
    "INSERT INTO shifts (cashier_id, clock_in, opening_cash, status) VALUES (?,?,?,'open')",
    user.id, nowISO(), opening
  );
  const symbol = await SYMBOL();
  await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "shift.clock_in", entity: "shift", entityId: result.lastInsertRowid, details: `Opening cash ${symbol}${opening.toFixed(2)}`, ip });
  sendJSON(res, 201, { ok: true, shift: await get("SELECT * FROM shifts WHERE id = ?", Number(result.lastInsertRowid)) });
});

route("POST", "/api/shifts/clock-out", async ({ res, body, user, ip }) => {
  if (user.role === "admin") return sendError(res, 403, "Admins do not clock out.");
  const shift = await get("SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", user.id);
  if (!shift) return sendError(res, 404, "You do not have an open shift.");
  const closing = round2(toNumber(body.closingCash, 0));
  if (closing < 0) return sendError(res, 400, "Closing cash cannot be negative.");
  const sales = await get(
    "SELECT COALESCE(SUM(o.total),0) AS total, COUNT(*) AS orders FROM orders o WHERE o.cashier_id = ? AND o.payment_status='paid' AND o.status<>'cancelled' AND o.created_at >= ?",
    user.id, shift.clock_in
  );
  const cashSales = await get(
    "SELECT COALESCE(SUM(o.total),0) AS total FROM orders o WHERE o.cashier_id = ? AND o.payment_status='paid' AND o.status<>'cancelled' AND o.payment_method='Cash' AND o.created_at >= ?",
    user.id, shift.clock_in
  );
  const expected = round2(shift.opening_cash + cashSales.total);
  const difference = round2(closing - expected);
  const symbol = await SYMBOL();
  await tx(async () => {
    await run(
      "UPDATE shifts SET clock_out=?, closing_cash=?, expected_cash=?, cash_difference=?, total_sales=?, order_count=?, status='closed' WHERE id=?",
      nowISO(), closing, expected, difference, sales.total, sales.orders, shift.id
    );
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "shift.clock_out", entity: "shift", entityId: shift.id, details: `Closing cash ${symbol}${closing.toFixed(2)} • difference ${symbol}${difference.toFixed(2)}`, ip });
    await notifyAllAdmins("Cashier shift completed", `${user.full_name} closed a shift with ${symbol}${Number(sales.total).toFixed(2)} in sales. Cash difference: ${symbol}${difference.toFixed(2)}.`, "shift");
  });
  sendJSON(res, 200, { ok: true, summary: { totalSales: sales.total, orders: sales.orders, expected, closing, difference } });
});

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

route("GET", "/api/notifications", async ({ res, user }) => {
  const rows = user.role === "admin"
    ? await all("SELECT * FROM notifications WHERE audience IN ('admin','all') ORDER BY created_at DESC LIMIT 100")
    : await all("SELECT * FROM notifications WHERE audience='all' OR (audience='cashier' AND (user_id IS NULL OR user_id = ?)) ORDER BY created_at DESC LIMIT 100", user.id);
  sendJSON(res, 200, {
    ok: true,
    notifications: rows.map((n) => ({ ...n, isRead: Boolean(n.is_read) })),
    unread: rows.filter((n) => !n.is_read).length
  });
});

route("POST", "/api/notifications/read", async ({ res, body, user }) => {
  const id = toNumber(body.id, 0);
  if (id) await run("UPDATE notifications SET is_read = 1 WHERE id = ?", id);
  else if (user.role === "admin") await run("UPDATE notifications SET is_read = 1 WHERE audience IN ('admin','all')");
  else await run("UPDATE notifications SET is_read = 1 WHERE audience='all' OR (audience='cashier' AND (user_id IS NULL OR user_id = ?))", user.id);
  sendJSON(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Activity logs                                                       */
/* ------------------------------------------------------------------ */

route("GET", "/api/activity", async ({ res, query }) => {
  const search = sanitizeText(query.search, 80).toLowerCase();
  const rows = await all(
    `SELECT * FROM activity_logs
      ${search ? "WHERE lower(user_name) LIKE ? OR lower(action) LIKE ? OR lower(details) LIKE ?" : ""}
      ORDER BY created_at DESC LIMIT 400`,
    ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [])
  );
  sendJSON(res, 200, { ok: true, activity: rows });
});

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

async function categoryBreakdown(start, end) {
  const rows = await all(
    `SELECT oi.category_name AS name,
            COALESCE(SUM(oi.line_total),0) AS revenue,
            COALESCE(SUM(oi.quantity),0) AS quantity
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status='paid' AND o.status<>'cancelled' AND o.biz_date BETWEEN ? AND ?
      GROUP BY oi.category_name ORDER BY revenue DESC`,
    start, end
  );
  const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
  return rows.map((r) => ({ ...r, percent: round2((r.revenue / total) * 100) }));
}

async function productBreakdown(start, end, limit = 100) {
  return all(
    `SELECT oi.product_id, oi.product_name AS name, oi.category_name AS category,
            COALESCE(SUM(oi.quantity),0) AS quantity, COALESCE(SUM(oi.line_total),0) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status='paid' AND o.status<>'cancelled' AND o.biz_date BETWEEN ? AND ?
      GROUP BY oi.product_id, oi.product_name
      ORDER BY quantity DESC, revenue DESC LIMIT ?`,
    start, end, limit
  );
}

async function cashierBreakdown(start, end) {
  return all(
    `SELECT u.id, u.full_name AS name, COUNT(o.id) AS orders, COALESCE(SUM(o.total),0) AS revenue,
            COALESCE(AVG(o.total),0) AS average
       FROM orders o JOIN users u ON u.id = o.cashier_id
      WHERE o.payment_status='paid' AND o.status<>'cancelled' AND o.biz_date BETWEEN ? AND ?
      GROUP BY u.id ORDER BY revenue DESC`,
    start, end
  );
}

async function paymentBreakdown(start, end) {
  return all(
    `SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE payment_status='paid' AND status<>'cancelled' AND biz_date BETWEEN ? AND ?
      GROUP BY payment_method ORDER BY revenue DESC`,
    start, end
  );
}

async function dailySeries(start, end) {
  const rows = await all(
    `SELECT biz_date AS date, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE payment_status='paid' AND status<>'cancelled' AND biz_date BETWEEN ? AND ?
      GROUP BY biz_date ORDER BY biz_date`,
    start, end
  );
  const map = new Map(rows.map((r) => [r.date, r]));
  return eachDate(start, end).map((date) => {
    const row = map.get(date);
    return {
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: row ? round2(row.revenue) : 0,
      orders: row ? row.orders : 0
    };
  });
}

route("GET", "/api/analytics", async ({ res, query }) => {
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  const categoryId = toNumber(query.categoryId, 0);

  const today = dateKey();
  const week = resolveRange("week");
  const month = resolveRange("month");

  const current = await salesBetween(start, end);
  const prevRange = previousRange(start, end);
  const previous = await salesBetween(prevRange.start, prevRange.end);
  const revenueAll = await get("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE payment_status='paid' AND status<>'cancelled'");
  const customers = await get("SELECT COUNT(*) AS n FROM customers");
  const cashiers = await get("SELECT COUNT(*) AS n FROM users WHERE role='cashier' AND status='active'");
  const productCount = await get("SELECT COUNT(*) AS n FROM products");
  const lowStock = await get("SELECT COUNT(*) AS n FROM ingredients WHERE stock_qty <= low_stock_threshold");

  const series = await dailySeries(start, end);
  const previousSeries = await dailySeries(prevRange.start, prevRange.end);
  const categories = await categoryBreakdown(start, end);
  const productsRanked = await productBreakdown(start, end, 120);
  const totalProductRevenue = productsRanked.reduce((s, p) => s + p.revenue, 0) || 1;
  const cashiersPerf = await cashierBreakdown(start, end);
  const payments = await paymentBreakdown(start, end);
  const recent = await orderListQuery(
    "o.payment_status='paid' AND o.status<>'cancelled' AND o.biz_date BETWEEN ? AND ?",
    [start, end], 12
  );
  const growth = previous.revenue > 0
    ? round2(((current.revenue - previous.revenue) / previous.revenue) * 100)
    : current.revenue > 0 ? 100 : 0;

  const productMeta = new Map(
    (await all("SELECT id, category_id, is_available FROM products")).map((p) => [p.id, p])
  );
  const filteredProducts = categoryId
    ? productsRanked.filter((p) => p.name && productMeta.get(p.product_id)?.category_id === categoryId)
    : productsRanked;

  sendJSON(res, 200, {
    ok: true,
    range: { start, end, label: rangeLabel(start, end), previous: prevRange },
    cards: {
      salesToday: (await salesBetween(today, today)).revenue,
      salesWeek: (await salesBetween(week.start, week.end)).revenue,
      salesMonth: (await salesBetween(month.start, month.end)).revenue,
      revenue: revenueAll.v,
      rangeRevenue: current.revenue,
      rangeOrders: current.orders,
      avgOrder: current.orders ? round2(current.revenue / current.orders) : 0,
      products: productCount.n,
      lowStock: lowStock.n,
      cashiers: cashiers.n,
      customers: customers.n,
      tax: current.tax,
      discounts: current.discounts
    },
    comparison: { current: current.revenue, previous: previous.revenue, growth, orders: current.orders, previousOrders: previous.orders },
    series,
    previousSeries,
    categories,
    productPerformance: productsRanked.map((p, index) => ({
      rank: index + 1,
      productId: p.product_id,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      revenue: round2(p.revenue),
      percent: round2((p.revenue / totalProductRevenue) * 100),
      status: productMeta.get(p.product_id)?.is_available ? "Available" : "Unavailable"
    })),
    filteredProductPerformance: filteredProducts.length,
    topProducts: productsRanked.slice(0, 5).map((p, i) => ({ ...p, rank: i + 1 })),
    leastProducts: [...productsRanked].sort((a, b) => a.quantity - b.quantity).slice(0, 5),
    cashiers: cashiersPerf,
    payments,
    recent: recent.map((o) => ({
      id: o.id, orderNumber: o.order_number, cashier: o.cashier_name, customer: o.customer_name,
      method: o.payment_method, total: o.total, status: o.status, createdAt: o.created_at
    }))
  });
});

route("GET", "/api/analytics/cashier", async ({ res, user }) => {
  const today = dateKey();
  const week = resolveRange("week");
  const shift = await get("SELECT * FROM shifts WHERE cashier_id = ? AND status='open' ORDER BY id DESC LIMIT 1", user.id);
  const salesToday = await get(
    "SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE cashier_id=? AND payment_status='paid' AND status<>'cancelled' AND biz_date=?",
    user.id, today
  );
  const salesWeek = await get(
    "SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE cashier_id=? AND payment_status='paid' AND status<>'cancelled' AND biz_date BETWEEN ? AND ?",
    user.id, week.start, week.end
  );
  sendJSON(res, 200, {
    ok: true,
    cashier: publicUser(user),
    shift,
    today: { orders: salesToday.orders, revenue: salesToday.revenue },
    week: { orders: salesWeek.orders, revenue: salesWeek.revenue },
    series: await dailySeries(week.start, today)
  });
});

/* ------------------------------------------------------------------ */
/* Reports + exports                                                   */
/* ------------------------------------------------------------------ */

route("GET", "/api/reports/:type", async ({ res, query, params }) => {
  const type = sanitizeText(params.type, 30);
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  if (type === "sales") {
    return sendJSON(res, 200, {
      ok: true, range: { start, end, label: rangeLabel(start, end) },
      summary: await salesBetween(start, end), series: await dailySeries(start, end),
      categories: await categoryBreakdown(start, end), payments: await paymentBreakdown(start, end)
    });
  }
  if (type === "products") {
    return sendJSON(res, 200, { ok: true, range: { start, end, label: rangeLabel(start, end) }, products: await productBreakdown(start, end, 200) });
  }
  if (type === "cashiers") {
    return sendJSON(res, 200, {
      ok: true, range: { start, end, label: rangeLabel(start, end) },
      cashiers: await cashierBreakdown(start, end),
      shifts: await all("SELECT s.*, u.full_name AS cashier_name FROM shifts s JOIN users u ON u.id = s.cashier_id WHERE SUBSTR(s.clock_in, 1, 10) BETWEEN ? AND ? ORDER BY s.clock_in DESC", start, end)
    });
  }
  if (type === "inventory") {
    return sendJSON(res, 200, {
      ok: true,
      ingredients: await all(`SELECT i.*, s.name AS supplier_name FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name`),
      movements: await all(`SELECT m.*, i.name AS ingredient_name, i.unit FROM inventory_movements m JOIN ingredients i ON i.id = m.ingredient_id ORDER BY m.created_at DESC LIMIT 300`),
      lowStock: await all("SELECT * FROM ingredients WHERE stock_qty <= low_stock_threshold"),
      expiring: await all("SELECT * FROM ingredients WHERE expiry_date IS NOT NULL AND SUBSTR(expiry_date, 1, 10) <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 14 DAY), '%Y-%m-%d') ORDER BY expiry_date")
    });
  }
  if (type === "profit") {
    const items = await all(
      `SELECT oi.product_id, oi.quantity, oi.line_total FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status='paid' AND o.status<>'cancelled' AND o.biz_date BETWEEN ? AND ?`, start, end
    );
    let cost = 0;
    for (const item of items) {
      if (!item.product_id) continue;
      const recipe = await all("SELECT quantity, (SELECT cost_per_unit FROM ingredients WHERE id = ?) AS unit_cost FROM product_recipes WHERE product_id = ?", item.product_id, item.product_id);
      for (const r of recipe) cost += r.quantity * (r.unit_cost || 0) * item.quantity;
    }
    const sales = await salesBetween(start, end);
    return sendJSON(res, 200, {
      ok: true, range: { start, end, label: rangeLabel(start, end) },
      revenue: sales.revenue, cost: round2(cost), profit: round2(sales.revenue - cost),
      margin: sales.revenue ? round2(((sales.revenue - cost) / sales.revenue) * 100) : 0,
      tax: sales.tax, discounts: sales.discounts, orders: sales.orders
    });
  }
  return sendError(res, 404, "Unknown report type.");
});

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCSV(res, filename, headers, rows) {
  const body = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  });
  res.end("\uFEFF" + body);
}

route("GET", "/api/export/orders", async ({ res, query }) => {
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  const rows = await orderListQuery("o.biz_date BETWEEN ? AND ?", [start, end], 5000);
  sendCSV(res, `trippers-orders-${start}-to-${end}.csv`,
    ["Transaction ID", "Date", "Cashier", "Customer", "Status", "Payment Status", "Method", "Subtotal", "Discount", "Tax", "Service", "Total"],
    rows.map((o) => [o.order_number, o.created_at, o.cashier_name, o.customer_name, o.status, o.payment_status, o.payment_method, o.subtotal, o.discount, o.tax, o.service_charge, o.total])
  );
});

route("GET", "/api/export/products", async ({ res, query }) => {
  const { start, end } = resolveRange(query.range || "month", query.from, query.to);
  const rows = await productBreakdown(start, end, 500);
  sendCSV(res, `trippers-products-${start}-to-${end}.csv`,
    ["Rank", "Product", "Category", "Quantity Sold", "Revenue"],
    rows.map((p, i) => [i + 1, p.name, p.category, p.quantity, p.revenue])
  );
});

route("GET", "/api/export/inventory", async ({ res }) => {
  const rows = await all(`SELECT i.*, s.name AS supplier_name FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name`);
  sendCSV(res, `trippers-inventory-${dateKey()}.csv`,
    ["Ingredient", "Category", "Unit", "On Hand", "Low Stock Threshold", "Cost Per Unit", "Supplier", "Expiry"],
    rows.map((i) => [i.name, i.category, i.unit, i.stock_qty, i.low_stock_threshold, i.cost_per_unit, i.supplier_name || "", i.expiry_date || ""])
  );
});

route("GET", "/api/export/customers", async ({ res }) => {
  const rows = await all("SELECT * FROM customers ORDER BY name");
  sendCSV(res, `trippers-customers-${dateKey()}.csv`,
    ["Name", "Contact", "Email", "Notes", "Created"],
    rows.map((c) => [c.name, c.contact, c.email, c.notes, c.created_at])
  );
});

/* ------------------------------------------------------------------ */
/* Settings + backup                                                   */
/* ------------------------------------------------------------------ */

const PUBLIC_SETTINGS = new Set([
  "shop_name", "shop_tagline", "address", "contact", "email", "currency", "currency_symbol",
  "payment_methods", "receipt_header", "receipt_footer", "receipt_show_logo", "tax_rate",
  "service_charge", "senior_discount_percent", "pwd_discount_percent", "auto_print_receipt"
]);

async function settingsObject() {
  const rows = await all("SELECT * FROM settings");
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  out.payment_methods = parseJSON(out.payment_methods, ["Cash", "GCash"]);
  return out;
}

route("GET", "/api/settings", async ({ res }) => {
  sendJSON(res, 200, { ok: true, settings: await settingsObject() });
});

route("GET", "/api/settings/public", async ({ res }) => {
  const allSettings = await settingsObject();
  const out = {};
  for (const key of PUBLIC_SETTINGS) if (allSettings[key] !== undefined) out[key] = allSettings[key];
  sendJSON(res, 200, { ok: true, settings: out });
});

route("PUT", "/api/settings", async ({ res, body, user, ip }) => {
  const allowed = [
    "shop_name", "shop_tagline", "address", "contact", "email", "currency_symbol", "tax_rate",
    "service_charge", "receipt_header", "receipt_footer", "receipt_show_logo", "low_stock_alerts",
    "session_timeout_minutes", "auto_print_receipt", "senior_discount_percent", "pwd_discount_percent"
  ];
  const changed = [];
  await tx(async () => {
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      let value = body[key];
      if (Array.isArray(value)) value = JSON.stringify(value);
      if (key === "tax_rate" || key === "service_charge") {
        const num = Math.max(0, toNumber(value, 0));
        value = String(num > 1 ? num / 100 : num);
      }
      await setSetting(key, value);
      changed.push(key);
    }
    if (Array.isArray(body.payment_methods)) {
      const methods = body.payment_methods.map((m) => sanitizeText(m, 40)).filter(Boolean);
      if (methods.length) {
        await setSetting("payment_methods", JSON.stringify(methods));
        changed.push("payment_methods");
      }
    }
    await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "settings.updated", entity: "settings", details: changed.join(", "), ip });
  });
  sendJSON(res, 200, { ok: true, settings: await settingsObject(), message: "Settings saved." });
});

const BACKUP_TABLES = [
  "roles", "users", "categories", "products", "product_sizes", "addons", "product_addons",
  "suppliers", "ingredients", "product_recipes", "inventory_movements", "customers",
  "discounts", "orders", "order_items", "payments", "refunds", "shifts",
  "notifications", "activity_logs", "settings"
];

route("GET", "/api/backup", async ({ res, user }) => {
  if (user.role !== "admin") return sendError(res, 403, "Administrator access required.");
  const payload = { app: "Trippers Coffee POS", version: 1, createdAt: nowISO(), tables: {} };
  for (const table of BACKUP_TABLES) payload.tables[table] = await all(`SELECT * FROM ${table}`);
  sendJSON(res, 200, { ok: true, backup: payload });
});

route("POST", "/api/backup/restore", async ({ res, body, user, ip }) => {
  if (user.role !== "admin") return sendError(res, 403, "Administrator access required.");
  if (body.confirm !== "RESTORE") return sendError(res, 400, "Type RESTORE to confirm.");
  const backup = body.backup;
  if (!backup || typeof backup !== "object" || !backup.tables) return sendError(res, 400, "That backup file is not valid.");
  await tx(async () => {
    await run("SET FOREIGN_KEY_CHECKS = 0");
    try {
      await run("DELETE FROM sessions");
      for (const table of [...BACKUP_TABLES].reverse()) await run(`DELETE FROM ${table}`);
      for (const table of BACKUP_TABLES) {
        const rows = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];
        for (const row of rows) {
          const keys = Object.keys(row).filter((k) => /^[a-z_]+$/.test(k));
          if (!keys.length) continue;
          const columns = keys.map((k) => `\`${k}\``).join(",");
          const sql = `INSERT INTO ${table} (${columns}) VALUES (${keys.map(() => "?").join(",")})`;
          await run(sql, ...keys.map((k) => row[k]));
        }
      }
      await logActivity({ userId: user.id, userName: user.full_name, role: user.role, action: "system.restore", entity: "settings", details: "Database restored from backup", ip });
    } finally {
      await run("SET FOREIGN_KEY_CHECKS = 1");
    }
  });
  sendJSON(res, 200, { ok: true, message: "Database restored. Sign in again." });
});

route("GET", "/api/system/summary", async ({ res }) => {
  const totals = await get(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE role='cashier') AS cashiers,
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM orders) AS orders,
       (SELECT COUNT(*) FROM customers) AS customers,
       (SELECT COUNT(*) FROM ingredients) AS ingredients,
       (SELECT COUNT(*) FROM ingredients WHERE stock_qty <= low_stock_threshold) AS lowStock`
  );
  sendJSON(res, 200, { ok: true, totals });
});

/* ------------------------------------------------------------------ */
/* Central authorization policy (fail closed)                          */
/* ------------------------------------------------------------------ */

const GUARD_RULES = [
  // Public
  ["GET", /^\/api\/setup\/status$/, "public"],
  ["POST", /^\/api\/setup$/, "public"],
  ["POST", /^\/api\/auth\/(login|logout|change-password|forgot-password)$/, "public"],
  ["GET", /^\/api\/auth\/session$/, "public"],
  ["GET", /^\/api\/settings\/public$/, "public"],

  // Cashier workspace
  ["GET", /^\/api\/orders\/mine$/, "cashier"],
  ["GET", /^\/api\/shifts\/current$/, "cashier"],
  ["GET", /^\/api\/analytics\/cashier$/, "cashier"],

  // Any authenticated role
  ["GET", /^\/api\/catalog$/, "any"],
  ["GET", /^\/api\/products$/, "any"],
  ["GET", /^\/api\/categories$/, "any"],
  ["GET", /^\/api\/addons$/, "any"],
  ["GET", /^\/api\/customers$/, "any"],
  ["POST", /^\/api\/customers$/, "any"],
  ["PATCH", /^\/api\/customers\/[^/]+$/, "any"],
  ["GET", /^\/api\/orders\/[^/]+$/, "any"],
  ["GET", /^\/api\/orders\/[^/]+\/receipt$/, "any"],
  ["GET", /^\/api\/receipts$/, "any"],
  ["GET", /^\/api\/discounts$/, "any"],
  ["GET", /^\/api\/shifts$/, "any"],
  ["GET", /^\/api\/notifications$/, "any"],
  ["POST", /^\/api\/notifications\/read$/, "any"],
  ["PATCH", /^\/api\/orders\/[^/]+$/, "any"],

  // Cashier mutations
  ["POST", /^\/api\/orders$/, "cashier"],
  ["POST", /^\/api\/orders\/[^/]+\/pay$/, "cashier"],
  ["POST", /^\/api\/orders\/[^/]+\/refund-request$/, "cashier"],
  ["POST", /^\/api\/shifts\/clock-(in|out)$/, "cashier"],

  // Admin only
  ["GET", /^\/api\/users(\/[^/]+)?(\/activity)?$/, "admin"],
  ["POST", /^\/api\/users(\/[^/]+)?(\/reset-password)?$/, "admin"],
  ["PATCH", /^\/api\/users\/[^/]+$/, "admin"],
  ["POST", /^\/api\/products$/, "admin"],
  ["PATCH", /^\/api\/products\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/products\/[^/]+$/, "admin"],
  ["POST", /^\/api\/categories$/, "admin"],
  ["PATCH", /^\/api\/categories\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/categories\/[^/]+$/, "admin"],
  ["POST", /^\/api\/addons$/, "admin"],
  ["PATCH", /^\/api\/addons\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/addons\/[^/]+$/, "admin"],
  ["GET", /^\/api\/ingredients$/, "admin"],
  ["POST", /^\/api\/ingredients$/, "admin"],
  ["PATCH", /^\/api\/ingredients\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/ingredients\/[^/]+$/, "admin"],
  ["POST", /^\/api\/inventory\/adjust$/, "admin"],
  ["GET", /^\/api\/inventory\/movements$/, "admin"],
  ["GET", /^\/api\/suppliers$/, "admin"],
  ["POST", /^\/api\/suppliers$/, "admin"],
  ["PATCH", /^\/api\/suppliers\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/suppliers\/[^/]+$/, "admin"],
  ["GET", /^\/api\/orders$/, "admin"],
  ["GET", /^\/api\/refunds$/, "admin"],
  ["POST", /^\/api\/refunds\/[^/]+\/decide$/, "admin"],
  ["POST", /^\/api\/discounts$/, "admin"],
  ["PATCH", /^\/api\/discounts\/[^/]+$/, "admin"],
  ["DELETE", /^\/api\/discounts\/[^/]+$/, "admin"],
  ["GET", /^\/api\/activity$/, "admin"],
  ["GET", /^\/api\/analytics$/, "admin"],
  ["GET", /^\/api\/reports\/[^/]+$/, "admin"],
  ["GET", /^\/api\/export\/[^/]+$/, "admin"],
  ["GET", /^\/api\/settings$/, "admin"],
  ["PUT", /^\/api\/settings$/, "admin"],
  ["GET", /^\/api\/backup$/, "admin"],
  ["POST", /^\/api\/backup\/restore$/, "admin"],
  ["GET", /^\/api\/system\/summary$/, "admin"]
];

function applyGuards() {
  for (const r of routes) {
    const sample = `/${r.parts.map((p) => (p.startsWith(":") ? "1" : p)).join("/")}`;
    const rule = GUARD_RULES.find(([method, regex]) => method === r.method && regex.test(sample));
    if (!rule) {
      throw new Error(`No authorization rule for ${r.method} ${sample}`);
    }
    r.guard = rule[2];
  }
}
applyGuards();

module.exports = { handleApi, rotateSetupToken };
