"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.TRIPPERS_DB || path.join(dataDir, "trippers.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

db.exec(`
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  contact TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','cashier')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_by INTEGER REFERENCES users(id),
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  remember INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_identifier ON login_attempts(identifier, created_at);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  image TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '☕',
  has_sizes INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sizes_product ON product_sizes(product_id);

CREATE TABLE IF NOT EXISTS addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_addons (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_id INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, addon_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Other Supplies',
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 0,
  cost_per_unit REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  expiry_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier ON ingredients(supplier_id);

CREATE TABLE IF NOT EXISTS product_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity REAL NOT NULL DEFAULT 0,
  UNIQUE (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','waste','adjustment')),
  quantity REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  order_id INTEGER,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_ingredient ON inventory_movements(ingredient_id, created_at);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value REAL NOT NULL DEFAULT 0,
  requires_id INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in guest',
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  cashier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  discount_id INTEGER REFERENCES discounts(id) ON DELETE SET NULL,
  discount_label TEXT NOT NULL DEFAULT '',
  tax REAL NOT NULL DEFAULT 0,
  service_charge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  stock_deducted INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  biz_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(biz_date);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  addons TEXT NOT NULL DEFAULT '[]',
  unit_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT NOT NULL DEFAULT '',
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  tendered REAL NOT NULL DEFAULT 0,
  change_due REAL NOT NULL DEFAULT 0,
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','refunded','voided')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash REAL,
  expected_cash REAL,
  cash_difference REAL,
  total_sales REAL NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id, clock_in);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL DEFAULT 'admin' CHECK (audience IN ('admin','cashier','all')),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience, is_read);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'System',
  role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const nowISO = () => new Date().toISOString();

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const statements = new Map();
function stmt(sql) {
  let s = statements.get(sql);
  if (!s) {
    s = db.prepare(sql);
    statements.set(sql, s);
  }
  return s;
}
const get = (sql, ...params) => stmt(sql).get(...params);
const all = (sql, ...params) => stmt(sql).all(...params);
const run = (sql, ...params) => stmt(sql).run(...params);

function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

function getSetting(key, fallback = null) {
  const row = get("SELECT value FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  return row.value;
}

function setSetting(key, value) {
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

function logActivity({ userId = null, userName = "System", role = "system", action, entity = "", entityId = "", details = "", ip = "" }) {
  run(
    "INSERT INTO activity_logs (user_id, user_name, role, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    userId, userName, role, action, entity, String(entityId ?? ""), details, ip, nowISO()
  );
}

function notify({ audience = "admin", userId = null, type = "info", title, message = "" }) {
  run(
    "INSERT INTO notifications (audience, user_id, type, title, message, is_read, created_at) VALUES (?,?,?,?,?,0,?)",
    audience, userId, type, title, message, nowISO()
  );
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  shop_name: "Trippers Coffee",
  shop_tagline: "Good coffee. Good trips. Good memories.",
  address: "24 Katipunan Avenue, Quezon City, Metro Manila",
  contact: "+63 917 555 0142",
  email: "hello@tripperscoffee.com",
  currency: "PHP",
  currency_symbol: "₱",
  tax_rate: "0.12",
  service_charge: "0",
  payment_methods: JSON.stringify(["Cash", "GCash", "Card", "Maya"]),
  receipt_header: "TRIPPERS COFFEE",
  receipt_footer: "Thank you for tripping with us. Good coffee. Good trips. Good memories.",
  receipt_show_logo: "1",
  low_stock_alerts: "1",
  session_timeout_minutes: "720",
  auto_print_receipt: "0",
  senior_discount_percent: "20",
  pwd_discount_percent: "20",
  setup_complete: "0"
};

const CATEGORIES = [
  "Hot Coffee", "Cold Coffee", "Frappuccino", "Tea",
  "Non-Coffee Drinks", "Bakery", "Snacks", "Other Products"
];

const ADDONS = [
  ["Extra Espresso", 20], ["Extra Shot", 20], ["Whipped Cream", 15],
  ["Caramel", 10], ["Vanilla", 10], ["Additional Milk", 15]
];

const INGREDIENTS = [
  ["Espresso Beans", "Coffee Beans", "g", 5000, 1000, 0.9, "Batangas Coffee Roasters"],
  ["Fresh Milk", "Milk", "ml", 18000, 4000, 0.12, "DairyFresh Philippines"],
  ["Condensed Milk", "Milk", "ml", 4500, 1000, 0.15, "DairyFresh Philippines"],
  ["Caramel Syrup", "Syrups", "ml", 2600, 600, 0.35, "Sweetline Syrups"],
  ["Vanilla Syrup", "Syrups", "ml", 2800, 600, 0.35, "Sweetline Syrups"],
  ["Chocolate Syrup", "Syrups", "ml", 2400, 600, 0.35, "Sweetline Syrups"],
  ["Hazelnut Syrup", "Syrups", "ml", 1800, 400, 0.4, "Sweetline Syrups"],
  ["Strawberry Syrup", "Syrups", "ml", 1700, 400, 0.4, "Sweetline Syrups"],
  ["Matcha Powder", "Tea", "g", 140, 250, 1.6, "Kyoto Leaf Trading"],
  ["Ube Powder", "Other Supplies", "g", 900, 200, 1.2, "Sweetline Syrups"],
  ["Tea Leaves", "Tea", "g", 1400, 300, 0.8, "Kyoto Leaf Trading"],
  ["Whipped Cream", "Milk", "ml", 320, 500, 0.25, "DairyFresh Philippines"],
  ["Sugar", "Sugar", "g", 4600, 1000, 0.05, "Sweetline Syrups"],
  ["Cup 16oz", "Cups", "pcs", 780, 150, 4.5, "EcoPack Supplies"],
  ["Cup 22oz", "Cups", "pcs", 420, 120, 5.5, "EcoPack Supplies"],
  ["Lids", "Lids", "pcs", 1150, 250, 1.2, "EcoPack Supplies"],
  ["Butter Croissant", "Packaging", "pcs", 58, 15, 32, "Bakehouse Manila"],
  ["Blueberry Muffin", "Packaging", "pcs", 38, 12, 22, "Bakehouse Manila"],
  ["Granola Bar", "Packaging", "pcs", 46, 10, 18, "Bakehouse Manila"],
  ["Cheese Roll", "Packaging", "pcs", 34, 10, 15, "Bakehouse Manila"]
];

// [name, category, price, emoji, hasSizes, description, recipe]
const PRODUCTS = [
  ["Cafe Latte", "Hot Coffee", 49, "☕", 1, "Silky espresso and steamed milk with a delicate crema.", [["Espresso Beans", 18], ["Fresh Milk", 180], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Americano", "Hot Coffee", 49, "☕", 1, "Bold espresso shots mellowed with hot water.", [["Espresso Beans", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Spanish Latte", "Hot Coffee", 59, "☕", 1, "Espresso with sweetened condensed milk and steamed milk.", [["Espresso Beans", 18], ["Fresh Milk", 120], ["Condensed Milk", 40], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Mocha Latte", "Hot Coffee", 59, "☕", 1, "Espresso, chocolate, and velvety steamed milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Chocolate Syrup", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Caramel Macchiato", "Hot Coffee", 69, "☕", 1, "Layered espresso and milk with a caramel finish.", [["Espresso Beans", 18], ["Fresh Milk", 180], ["Caramel Syrup", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Salted Caramel", "Hot Coffee", 69, "☕", 1, "Sweet caramel with a whisper of sea salt.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Caramel Syrup", 25], ["Cup 16oz", 1], ["Lids", 1]]],
  ["French Vanilla", "Hot Coffee", 69, "☕", 1, "Classic vanilla latte with a smooth, aromatic finish.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Vanilla Syrup", 25], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Iced Caramel Latte", "Cold Coffee", 79, "🧋", 1, "Espresso over ice with caramel drizzle and cold milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Caramel Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["White Mocha", "Cold Coffee", 69, "🧋", 1, "Chilled espresso with white chocolate and milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Chocolate Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Hazelnut Cold Brew", "Cold Coffee", 69, "🧋", 1, "Slow-steeped coffee with roasted hazelnut.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Hazelnut Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Vietnamese Iced", "Cold Coffee", 69, "🧋", 1, "Strong coffee with a generous pour of condensed milk.", [["Espresso Beans", 22], ["Condensed Milk", 50], ["Fresh Milk", 80], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Strawberry Frappe", "Frappuccino", 89, "🥤", 1, "Blended strawberry and milk topped with whipped cream.", [["Strawberry Syrup", 40], ["Fresh Milk", 120], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Oreo Matcha Frappe", "Frappuccino", 89, "🥤", 1, "Earthy matcha blended smooth with cookie crumble.", [["Matcha Powder", 8], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Cookies & Cream Frappe", "Frappuccino", 89, "🥤", 1, "Chocolate cookie frappe with a creamy finish.", [["Chocolate Syrup", 20], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Ube Frappe", "Frappuccino", 89, "🥤", 1, "Purple yam blended with milk and topped with cream.", [["Ube Powder", 15], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Caramel Frappe", "Frappuccino", 89, "🥤", 1, "Coffee frappe with caramel and whipped cream.", [["Espresso Beans", 18], ["Fresh Milk", 140], ["Caramel Syrup", 25], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Matcha Latte", "Tea", 79, "🍵", 1, "Ceremonial matcha whisked with silky steamed milk.", [["Matcha Powder", 6], ["Fresh Milk", 180], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Iced Green Tea", "Tea", 59, "🍵", 1, "Light, citrusy green tea served over ice.", [["Tea Leaves", 8], ["Sugar", 10], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Dirty Matcha", "Tea", 89, "🍵", 1, "Matcha latte with a bold espresso shot.", [["Matcha Powder", 6], ["Espresso Beans", 18], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Iced Choco", "Non-Coffee Drinks", 59, "🥛", 1, "Rich chocolate milk poured over ice.", [["Chocolate Syrup", 30], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Strawberry Latte", "Non-Coffee Drinks", 59, "🥛", 1, "Sweet strawberry milk with a creamy texture.", [["Strawberry Syrup", 35], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Biscoff Latte", "Non-Coffee Drinks", 79, "🥛", 1, "Caramelized biscuit flavour in every sip.", [["Fresh Milk", 170], ["Caramel Syrup", 15], ["Whipped Cream", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Nutella Latte", "Non-Coffee Drinks", 79, "🥛", 1, "Hazelnut chocolate milk, served cold.", [["Chocolate Syrup", 25], ["Fresh Milk", 170], ["Whipped Cream", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Fruit Soda", "Non-Coffee Drinks", 49, "🥤", 1, "Sparkling fruit soda with a strawberry lift.", [["Strawberry Syrup", 30], ["Sugar", 10], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Butter Croissant", "Bakery", 85, "🥐", 0, "Flaky, golden layers made with real butter.", [["Butter Croissant", 1]]],
  ["Chocolate Croissant", "Bakery", 95, "🥐", 0, "Buttery pastry filled with dark chocolate.", [["Butter Croissant", 1], ["Chocolate Syrup", 10]]],
  ["Blueberry Muffin", "Bakery", 70, "🧁", 0, "Tender muffin with bright blueberries.", [["Blueberry Muffin", 1]]],
  ["Honey Granola Bar", "Snacks", 65, "🍫", 0, "Chewy oat bar with honey and seeds.", [["Granola Bar", 1]]],
  ["Cheese Roll", "Snacks", 55, "🥖", 0, "Warm cheese-filled bread roll.", [["Cheese Roll", 1]]],
  ["Bottled Water", "Other Products", 20, "💧", 0, "Chilled 500ml mineral water.", []]
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function seed() {
  const seeded = get("SELECT value FROM settings WHERE key = 'seeded'");
  if (seeded) return;

  tx(() => {
    const ts = nowISO();
    run("INSERT INTO roles (name, label, permissions, created_at) VALUES (?,?,?,?)", "admin", "Administrator", JSON.stringify(["*"]), ts);
    run("INSERT INTO roles (name, label, permissions, created_at) VALUES (?,?,?,?)", "cashier", "Cashier", JSON.stringify([
      "pos.dashboard", "orders.create", "orders.read.own", "payments.process", "receipts.print", "customers.manage", "shift.manage", "account.self"
    ]), ts);

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) setSetting(key, value);
    setSetting("seeded", ts);

    CATEGORIES.forEach((name, i) =>
      run("INSERT INTO categories (name, sort_order, created_at) VALUES (?,?,?)", name, i, ts)
    );

    for (const [name, price] of ADDONS) {
      run("INSERT INTO addons (name, price, is_active) VALUES (?,?,1)", name, price);
    }

    const suppliers = [
      ["Batangas Coffee Roasters", "+63 918 220 1180", "orders@batangasroasters.ph", "Single-origin beans, weekly delivery"],
      ["DairyFresh Philippines", "+63 917 884 5521", "trade@dairyfresh.ph", "Milk and cream, delivers Mon/Wed/Fri"],
      ["Sweetline Syrups", "+63 920 665 3320", "sales@sweetlinesyrups.ph", "Syrups, powders, and sugar"],
      ["EcoPack Supplies", "+63 995 441 7782", "support@ecopack.ph", "Cups, lids, and packaging"],
      ["Bakehouse Manila", "+63 927 310 8890", "hello@bakehousemanila.ph", "Fresh pastries every morning"]
    ];
    const supplierIds = new Map();
    for (const [name, contact, email, notes] of suppliers) {
      const r = run("INSERT INTO suppliers (name, contact, email, notes, created_at) VALUES (?,?,?,?,?)", name, contact, email, notes, ts);
      supplierIds.set(name, Number(r.lastInsertRowid));
    }

    for (const [name, category, unit, stock, low, cost, supplier] of INGREDIENTS) {
      run(
        "INSERT INTO ingredients (name, category, unit, stock_qty, low_stock_threshold, cost_per_unit, supplier_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        name, category, unit, stock, low, cost, supplierIds.get(supplier) || null, ts, ts
      );
    }

    const ingredientIds = new Map(
      all("SELECT id, name FROM ingredients").map((r) => [r.name, r.id])
    );
    const addonIds = all("SELECT id FROM addons").map((r) => r.id);
    const categoryIds = new Map(
      all("SELECT id, name FROM categories").map((r) => [r.name, r.id])
    );

    for (const [name, category, price, emoji, hasSizes, description, recipe] of PRODUCTS) {
      const slug = slugify(name);
      const r = run(
        "INSERT INTO products (category_id, name, slug, description, price, image, emoji, has_sizes, is_featured, is_available, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)",
        categoryIds.get(category), name, slug, description, price, "", emoji, hasSizes, 0, ts, ts
      );
      const productId = Number(r.lastInsertRowid);

      if (hasSizes) {
        run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Small", -10);
        run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Medium", 0);
        run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Large", 15);
        for (const addonId of addonIds) {
          run("INSERT INTO product_addons (product_id, addon_id) VALUES (?,?)", productId, addonId);
        }
      }

      for (const [ingredientName, qty] of recipe) {
        const ingredientId = ingredientIds.get(ingredientName);
        if (ingredientId) {
          run("INSERT INTO product_recipes (product_id, ingredient_id, quantity) VALUES (?,?,?)", productId, ingredientId, qty);
        }
      }
    }

    const discounts = [
      ["Senior Citizen", "percent", 20, 1],
      ["PWD", "percent", 20, 1],
      ["Employee Meal", "percent", 15, 0],
      ["Promo - ₱20 Off", "fixed", 20, 0]
    ];
    for (const [name, type, value, requiresId] of discounts) {
      run("INSERT INTO discounts (name, type, value, requires_id, is_active, created_at) VALUES (?,?,?,?,1,?)", name, type, value, requiresId, ts);
    }
  });
}

seed();

module.exports = {
  db,
  dbPath,
  get,
  all,
  run,
  tx,
  nowISO,
  localDateString,
  getSetting,
  setSetting,
  logActivity,
  notify,
  slugify,
  DEFAULT_SETTINGS
};
