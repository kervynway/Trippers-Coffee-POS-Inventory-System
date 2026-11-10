-- Trippers Coffee POS
-- MySQL/MariaDB schema for XAMPP (MariaDB 10.4+)
-- Target database: trippers_db
--
-- Import with phpMyAdmin:
--   1. Open http://localhost/phpmyadmin
--   2. Select trippers_db
--   3. Import -> choose this file -> Go
--
-- Or from the project root:
--   cmd /c "C:\xampp\mysql\bin\mysql.exe -u root trippers_db < database\trippers_mysql.sql"
--
-- This script is non-destructive: it only creates missing tables.
-- For a clean rebuild, use a fresh database or drop the existing tables first.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS roles (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  label VARCHAR(120) NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(40) NOT NULL,
  email VARCHAR(160) NOT NULL,
  contact VARCHAR(40) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'cashier',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until VARCHAR(32) NULL,
  created_by INT NULL,
  last_login_at VARCHAR(32) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_created_by (created_by),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_users_role CHECK (role IN ('admin','cashier')),
  CONSTRAINT chk_users_status CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  remember TINYINT(1) NOT NULL DEFAULT 0,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  KEY idx_sessions_token (token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT NOT NULL AUTO_INCREMENT,
  identifier VARCHAR(160) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_attempts_identifier (identifier, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DOUBLE NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  emoji VARCHAR(16) NOT NULL DEFAULT '☕',
  has_sizes TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_products_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_sizes (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  name VARCHAR(40) NOT NULL,
  price_delta DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sizes_product (product_id),
  CONSTRAINT fk_product_sizes_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addons (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  price DOUBLE NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_addons_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_addons (
  product_id INT NOT NULL,
  addon_id INT NOT NULL,
  PRIMARY KEY (product_id, addon_id),
  KEY idx_product_addons_addon (addon_id),
  CONSTRAINT fk_product_addons_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_addons_addon FOREIGN KEY (addon_id) REFERENCES addons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  contact VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Other Supplies',
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  stock_qty DOUBLE NOT NULL DEFAULT 0,
  low_stock_threshold DOUBLE NOT NULL DEFAULT 0,
  cost_per_unit DOUBLE NOT NULL DEFAULT 0,
  supplier_id INT NULL,
  expiry_date VARCHAR(10) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ingredients_name (name),
  KEY idx_ingredients_supplier (supplier_id),
  CONSTRAINT fk_ingredients_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_recipes (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_recipes (product_id, ingredient_id),
  KEY idx_recipes_ingredient (ingredient_id),
  CONSTRAINT fk_product_recipes_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_recipes_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT NOT NULL AUTO_INCREMENT,
  ingredient_id INT NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity DOUBLE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  order_id INT NULL,
  user_id INT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_movements_ingredient (ingredient_id, created_at),
  CONSTRAINT fk_inventory_movements_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_movements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_movements_type CHECK (type IN ('in','out','waste','adjustment'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  contact VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discounts (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(20) NOT NULL,
  value DOUBLE NOT NULL DEFAULT 0,
  requires_id TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discounts_name (name),
  CONSTRAINT chk_discounts_type CHECK (type IN ('percent','fixed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  customer_id INT NULL,
  customer_name VARCHAR(160) NOT NULL DEFAULT 'Walk-in guest',
  cashier_id INT NOT NULL,
  cashier_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  subtotal DOUBLE NOT NULL DEFAULT 0,
  discount DOUBLE NOT NULL DEFAULT 0,
  discount_id INT NULL,
  discount_label VARCHAR(160) NOT NULL DEFAULT '',
  tax DOUBLE NOT NULL DEFAULT 0,
  service_charge DOUBLE NOT NULL DEFAULT 0,
  total DOUBLE NOT NULL DEFAULT 0,
  payment_method VARCHAR(40) NOT NULL DEFAULT '',
  stock_deducted TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  biz_date VARCHAR(10) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  completed_at VARCHAR(32) NULL,
  cancelled_at VARCHAR(32) NULL,
  cancel_reason TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_cashier (cashier_id, created_at),
  KEY idx_orders_status (status),
  KEY idx_orders_date (biz_date),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_cashier FOREIGN KEY (cashier_id) REFERENCES users (id),
  CONSTRAINT fk_orders_discount FOREIGN KEY (discount_id) REFERENCES discounts (id) ON DELETE SET NULL,
  CONSTRAINT chk_orders_status CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('unpaid','paid','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(160) NOT NULL,
  category_name VARCHAR(120) NOT NULL DEFAULT '',
  size VARCHAR(40) NOT NULL DEFAULT '',
  addons TEXT NOT NULL DEFAULT '[]',
  unit_price DOUBLE NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  line_total DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_items_order (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  cashier_id INT NULL,
  method VARCHAR(40) NOT NULL,
  amount DOUBLE NOT NULL,
  tendered DOUBLE NOT NULL DEFAULT 0,
  change_due DOUBLE NOT NULL DEFAULT 0,
  reference VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_cashier FOREIGN KEY (cashier_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_status CHECK (status IN ('paid','refunded','voided'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  amount DOUBLE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by INT NULL,
  decided_by INT NULL,
  created_at VARCHAR(32) NOT NULL,
  decided_at VARCHAR(32) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_refunds_decided_by FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_refunds_status CHECK (status IN ('pending','approved','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
  id INT NOT NULL AUTO_INCREMENT,
  cashier_id INT NOT NULL,
  clock_in VARCHAR(32) NOT NULL,
  clock_out VARCHAR(32) NULL,
  opening_cash DOUBLE NOT NULL DEFAULT 0,
  closing_cash DOUBLE NULL,
  expected_cash DOUBLE NULL,
  cash_difference DOUBLE NULL,
  total_sales DOUBLE NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  PRIMARY KEY (id),
  KEY idx_shifts_cashier (cashier_id, clock_in),
  CONSTRAINT fk_shifts_cashier FOREIGN KEY (cashier_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_shifts_status CHECK (status IN ('open','closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT,
  audience VARCHAR(20) NOT NULL DEFAULT 'admin',
  user_id INT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'info',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_audience (audience, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_notifications_audience CHECK (audience IN ('admin','cashier','all'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  user_name VARCHAR(120) NOT NULL DEFAULT 'System',
  role VARCHAR(40) NOT NULL DEFAULT 'system',
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(80) NOT NULL DEFAULT '',
  entity_id VARCHAR(80) NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  ip VARCHAR(64) NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_activity_created (created_at),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
