"use strict";

const {
  tx, all, get, run, nowISO, slugify, closeDb, initDb, databaseName
} = require("./db");
const {
  DEFAULT_SETTINGS, ROLES, CATEGORIES, ADDONS,
  SUPPLIERS, INGREDIENTS, PRODUCTS, DISCOUNTS
} = require("./seed-data");

const SEED_SENTINEL = "base_seeded";

async function seed() {
  const alreadySeeded = await get("SELECT `value` FROM settings WHERE `key` = ?", SEED_SENTINEL);
  if (alreadySeeded) return { seeded: false, reason: "already-seeded" };

  const counts = {
    roles: 0, settings: 0, categories: 0, addons: 0, suppliers: 0,
    ingredients: 0, products: 0, discounts: 0
  };

  await tx(async () => {
    const ts = nowISO();

    for (const role of ROLES) {
      const result = await run(
        "INSERT IGNORE INTO roles (name, label, permissions, created_at) VALUES (?,?,?,?)",
        role.name, role.label, JSON.stringify(role.permissions), ts
      );
      counts.roles += result.changes;
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const result = await run(
        "INSERT IGNORE INTO settings (`key`, `value`) VALUES (?,?)",
        key, typeof value === "string" ? value : JSON.stringify(value)
      );
      counts.settings += result.changes;
    }

    for (const [index, name] of CATEGORIES.entries()) {
      const result = await run(
        "INSERT IGNORE INTO categories (name, sort_order, created_at) VALUES (?,?,?)",
        name, index, ts
      );
      counts.categories += result.changes;
    }

    for (const [name, price] of ADDONS) {
      const result = await run(
        "INSERT IGNORE INTO addons (name, price, is_active) VALUES (?,?,1)",
        name, price
      );
      counts.addons += result.changes;
    }

    for (const [name, contact, email, notes] of SUPPLIERS) {
      const result = await run(
        "INSERT IGNORE INTO suppliers (name, contact, email, notes, created_at) VALUES (?,?,?,?,?)",
        name, contact, email, notes, ts
      );
      counts.suppliers += result.changes;
    }

    const supplierIds = new Map((await all("SELECT id, name FROM suppliers")).map((row) => [row.name, row.id]));
    for (const [name, category, unit, stock, low, cost, supplier] of INGREDIENTS) {
      const result = await run(
        `INSERT IGNORE INTO ingredients
           (name, category, unit, stock_qty, low_stock_threshold, cost_per_unit, supplier_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        name, category, unit, stock, low, cost, supplierIds.get(supplier) || null, ts, ts
      );
      counts.ingredients += result.changes;
    }

    const ingredientIds = new Map((await all("SELECT id, name FROM ingredients")).map((row) => [row.name, row.id]));
    const categoryIds = new Map((await all("SELECT id, name FROM categories")).map((row) => [row.name, row.id]));
    const addonIds = (await all("SELECT id FROM addons")).map((row) => row.id);

    for (const [name, category, price, emoji, hasSizes, description, recipe] of PRODUCTS) {
      const result = await run(
        `INSERT IGNORE INTO products
           (category_id, name, slug, description, price, image, emoji, has_sizes, is_featured, is_available, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,0,1,?,?)`,
        categoryIds.get(category), name, slugify(name), description, price, "", emoji, hasSizes, ts, ts
      );
      if (!result.changes) continue;
      counts.products += 1;

      const productId = result.lastInsertRowid;
      if (hasSizes) {
        await run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Small", -10);
        await run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Medium", 0);
        await run("INSERT INTO product_sizes (product_id, name, price_delta) VALUES (?,?,?)", productId, "Large", 15);
        for (const addonId of addonIds) {
          await run("INSERT INTO product_addons (product_id, addon_id) VALUES (?,?)", productId, addonId);
        }
      }

      for (const [ingredientName, quantity] of recipe) {
        const ingredientId = ingredientIds.get(ingredientName);
        if (ingredientId) {
          await run(
            "INSERT INTO product_recipes (product_id, ingredient_id, quantity) VALUES (?,?,?)",
            productId, ingredientId, quantity
          );
        }
      }
    }

    for (const [name, type, value, requiresId] of DISCOUNTS) {
      const result = await run(
        "INSERT IGNORE INTO discounts (name, type, value, requires_id, is_active, created_at) VALUES (?,?,?,?,1,?)",
        name, type, value, requiresId, ts
      );
      counts.discounts += result.changes;
    }

    await run(
      "INSERT INTO settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      SEED_SENTINEL, ts
    );
  });

  return { seeded: true, counts };
}

async function main() {
  await initDb();
  const result = await seed();
  if (!result.seeded) {
    console.log(`Base seed skipped in "${databaseName}": ${result.reason}.`);
    return;
  }
  const summary = Object.entries(result.counts).map(([key, value]) => `${key}=${value}`).join(", ");
  console.log(`Base seed complete in "${databaseName}": ${summary}.`);
}

if (require.main === module) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error("Base seed failed:", error);
      process.exitCode = 1;
    } finally {
      await closeDb();
    }
  })();
}

module.exports = { seed };
