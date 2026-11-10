"use strict";

/**
 * Optional demo dataset for testing the dashboards.
 * Usage: node server/seed-demo.js [--force]
 *
 * Creates a demo cashier and ~45 days of completed transactions.
 * It does NOT deduct ingredient stock, so the seeded inventory stays intact.
 */

const { db, get, all, run, tx, nowISO, localDateString, getSetting, hashPassword } = (() => {
  const dbModule = require("./db");
  return {
    ...dbModule,
    hashPassword: require("./auth").hashPassword
  };
})();

const force = process.argv.includes("--force");
const existingOrders = get("SELECT COUNT(*) AS n FROM orders").n;
if (existingOrders > 0 && !force) {
  console.log(`Demo data skipped: ${existingOrders} orders already exist. Use --force to add more.`);
  process.exit(0);
}

const CUSTOMER_NAMES = [
  "Maya Reyes", "Eli Santos", "Noah Garcia", "Priya Lim", "Jamie Cruz",
  "Andrea Dela Cruz", "Miguel Torres", "Sofia Bautista", "Liam Mendoza",
  "Isabella Ramos", "Gabriel Flores", "Chloe Navarro", "Rafael Aquino",
  "Bea Villanueva", "Daniel Castro", "Nina Salazar", "Marco Dizon"
];

const ticketNotes = ["", "", "", "Less ice, please", "Extra hot", "For pickup at 3pm", "No straw"];

function pad(n) { return String(n).padStart(2, "0"); }

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

let cashier = get("SELECT * FROM users WHERE role = 'cashier' ORDER BY id LIMIT 1");
if (!cashier) {
  const ts = nowISO();
  const result = run(
    "INSERT INTO users (full_name, username, email, contact, password_hash, role, status, must_change_password, created_by, created_at, updated_at) VALUES (?,?,?,?,?,'cashier','active',0,NULL,?,?)",
    "Jamie Rivera", "cashier", "cashier@tripperscoffee.com", "+63 917 555 0142",
    hashPassword("Cashier@2026"), ts, ts
  );
  cashier = get("SELECT * FROM users WHERE id = ?", Number(result.lastInsertRowid));
  console.log("Created demo cashier: cashier / Cashier@2026");
}

const products = all("SELECT * FROM products WHERE is_available = 1");
const sizes = all("SELECT * FROM product_sizes");
const addons = all("SELECT * FROM addons WHERE is_active = 1");
const linkRows = all("SELECT * FROM product_addons");
const categories = new Map(all("SELECT id, name FROM categories").map((c) => [c.id, c.name]));
const methods = ["Cash", "Cash", "Cash", "GCash", "GCash", "Maya", "Card"];

const customerIds = [];
for (const name of CUSTOMER_NAMES) {
  const existing = get("SELECT id FROM customers WHERE name = ?", name);
  if (existing) { customerIds.push(existing.id); continue; }
  const ts = nowISO();
  const result = run(
    "INSERT INTO customers (name, contact, email, notes, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    name, `+63 9${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(1000, 9999)}`,
    `${name.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`, "", ts, ts
  );
  customerIds.push(Number(result.lastInsertRowid));
}

function buildTicket() {
  const lineCount = randomInt(1, 4);
  const chosen = [];
  for (let i = 0; i < lineCount; i++) {
    const product = pick(products);
    if (chosen.some((c) => c.product.id === product.id)) continue;
    const productSizes = sizes.filter((s) => s.product_id === product.id);
    const size = productSizes.length ? pick(productSizes) : null;
    const availableAddons = linkRows.filter((l) => l.product_id === product.id).map((l) => l.addon_id);
    const chosenAddons = availableAddons.length && Math.random() < 0.3
      ? [pick(availableAddons)].map((id) => addons.find((a) => a.id === id)).filter(Boolean)
      : [];
    const unit = round2(product.price + (size ? size.price_delta : 0) + chosenAddons.reduce((s, a) => s + a.price, 0));
    const quantity = Math.random() < 0.2 ? 2 : 1;
    chosen.push({ product, size, chosenAddons, unit, quantity });
  }
  return chosen;
}

function createOrder(date, hour, minute) {
  const created = new Date(date);
  created.setHours(hour, minute, randomInt(0, 59), 0);
  const createdAt = created.toISOString();

  const lines = buildTicket();
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unit * l.quantity, 0));
  const tax = round2(subtotal * 0.12);
  const total = round2(subtotal + tax);
  const method = pick(methods);
  const customerId = Math.random() < 0.55 ? pick(customerIds) : null;
  const customer = customerId ? get("SELECT * FROM customers WHERE id = ?", customerId) : null;
  const customerName = customer ? customer.name : "Walk-in guest";
  const orderNumber = `TRP-${date.replace(/-/g, "")}-${pad(randomInt(1, 998))}${randomInt(0, 9)}`;

  if (get("SELECT id FROM orders WHERE order_number = ?", orderNumber)) return false;

  const orderId = tx(() => {
    const result = run(
      `INSERT INTO orders (order_number, customer_id, customer_name, cashier_id, cashier_name, status, payment_status,
                           subtotal, discount, discount_id, discount_label, tax, service_charge, total, payment_method,
                           stock_deducted, notes, biz_date, created_at, updated_at, completed_at)
       VALUES (?,?,?,?,?,'completed','paid',?,0,NULL,'',?,0,?,?,0,?,?,?,?,?)`,
      orderNumber, customerId, customerName, cashier.id, cashier.full_name,
      subtotal, tax, total, method, pick(ticketNotes), date, createdAt, createdAt, createdAt
    );
    const id = Number(result.lastInsertRowid);
    for (const line of lines) {
      run(
        "INSERT INTO order_items (order_id, product_id, product_name, category_name, size, addons, unit_price, quantity, notes, line_total) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id, line.product.id, line.product.name, categories.get(line.product.category_id) || "",
        line.size ? line.size.name : "", JSON.stringify(line.chosenAddons.map((a) => ({ id: a.id, name: a.name, price: a.price }))),
        line.unit, line.quantity, "", round2(line.unit * line.quantity)
      );
    }
    run(
      "INSERT INTO payments (order_id, cashier_id, method, amount, tendered, change_due, reference, status, created_at) VALUES (?,?,?,?,?,?,?,'paid',?)",
      id, cashier.id, method, total,
      method === "Cash" ? round2(Math.ceil(total / 100) * 100) : total,
      method === "Cash" ? round2(Math.ceil(total / 100) * 100 - total) : 0,
      method === "Cash" ? "" : `REF-${randomInt(100000, 999999)}`,
      createdAt
    );
    return id;
  });
  return Boolean(orderId);
}

const today = new Date();
let created = 0;
const days = 45;
for (let d = days - 1; d >= 0; d--) {
  const date = new Date(today);
  date.setDate(today.getDate() - d);
  const dateStr = localDateString(date);
  const orderCount = d === 0 ? randomInt(4, 9) : randomInt(6, 14);
  for (let i = 0; i < orderCount; i++) {
    const hour = randomInt(8, 20);
    if (createOrder(dateStr, hour, randomInt(0, 59))) created++;
  }
}

// One pending order and one refund request so admin screens have something to review.
const pendingDate = localDateString(new Date());
const pendingNumber = `TRP-${pendingDate.replace(/-/g, "")}-9001`;
if (!get("SELECT id FROM orders WHERE order_number = ?", pendingNumber)) {
  const lines = buildTicket();
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unit * l.quantity, 0));
  const tax = round2(subtotal * 0.12);
  tx(() => {
    const result = run(
      `INSERT INTO orders (order_number, customer_id, customer_name, cashier_id, cashier_name, status, payment_status,
                           subtotal, discount, tax, service_charge, total, payment_method, stock_deducted, notes, biz_date, created_at, updated_at)
       VALUES (?,?,?,?,?,'pending','unpaid',?,0,?,0,?,'',0,'Waiting for pickup',?,?,?)`,
      pendingNumber, null, "Walk-in guest", cashier.id, cashier.full_name,
      subtotal, tax, round2(subtotal + tax), pendingDate, nowISO(), nowISO()
    );
    const id = Number(result.lastInsertRowid);
    for (const line of lines) {
      run(
        "INSERT INTO order_items (order_id, product_id, product_name, category_name, size, addons, unit_price, quantity, notes, line_total) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id, line.product.id, line.product.name, categories.get(line.product.category_id) || "",
        line.size ? line.size.name : "", JSON.stringify(line.chosenAddons.map((a) => ({ id: a.id, name: a.name, price: a.price }))),
        line.unit, line.quantity, "", round2(line.unit * line.quantity)
      );
    }
  });
}

const refundOrder = get("SELECT * FROM orders WHERE payment_status='paid' ORDER BY id DESC LIMIT 1 OFFSET 3");
if (refundOrder && !get("SELECT id FROM refunds WHERE order_id = ?", refundOrder.id)) {
  run(
    "INSERT INTO refunds (order_id, amount, reason, status, requested_by, created_at) VALUES (?,?,?,'pending',?,?)",
    refundOrder.id, refundOrder.total, "Customer reported a wrong drink size.", cashier.id, nowISO()
  );
}

run(
  "INSERT INTO notifications (audience, type, title, message, is_read, created_at) VALUES ('admin','info',?,?,0,?)",
  "Welcome to Trippers Coffee", "Demo data loaded. Review sales analytics, cashier accounts, and inventory.", nowISO()
);

console.log(`Demo data ready: ${created} completed orders, 1 pending order, 1 refund request.`);
console.log("Sign in as admin with the account you created, or use the demo cashier:");
console.log("  username: cashier");
console.log("  password: Cashier@2026");
