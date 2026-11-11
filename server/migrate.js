"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { initDb, closeDb, get, run, tx, setSetting } = require("./db");
const { seed } = require("./seed");

const dryRun = process.argv.includes("--dry-run");

function fail(message) {
  throw new Error(message);
}

function text(value, label, max, { optional = false } = {}) {
  if (value == null && optional) return null;
  if (typeof value !== "string") fail(`${label} must be a string.`);
  if (!optional && !value.trim()) fail(`${label} is required.`);
  if (value.length > max) fail(`${label} exceeds ${max} characters.`);
  return value;
}

function username(value, label) {
  const result = text(value, label, 40);
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(result)) fail(`${label} has an invalid format: ${result}`);
  return result;
}

function email(value, label) {
  const result = text(value, label, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(result)) fail(`${label} is invalid: ${result}`);
  return result;
}

function integer(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) fail(`${label} must be an integer >= ${min}.`);
  return number;
}

function readSqlite(sourcePath) {
  if (!fs.existsSync(sourcePath)) fail(`SQLite database not found: ${sourcePath}`);
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const users = db.prepare(
      "SELECT id, full_name, username, email, contact, password_hash, role, status, must_change_password, failed_attempts, locked_until, created_by, last_login_at, created_at, updated_at FROM users ORDER BY id"
    ).all();
    const settings = db.prepare("SELECT key, value FROM settings ORDER BY key").all();
    return { users, settings };
  } finally {
    db.close();
  }
}

function validateUsers(rows) {
  const sourceIds = new Set();
  const usernames = new Set();
  const emails = new Set();
  const users = rows.map((row) => {
    const id = integer(row.id, "users.id", { min: 1 });
    if (sourceIds.has(id)) fail(`Duplicate SQLite user id: ${id}`);
    sourceIds.add(id);

    const normalizedUsername = username(row.username, `username for user ${id}`);
    const normalizedEmail = email(row.email, `email for user ${id}`);
    const usernameKey = normalizedUsername.toLowerCase();
    const emailKey = normalizedEmail.toLowerCase();
    if (usernames.has(usernameKey)) fail(`Duplicate SQLite username: ${normalizedUsername}`);
    if (emails.has(emailKey)) fail(`Duplicate SQLite email: ${normalizedEmail}`);
    usernames.add(usernameKey);
    emails.add(emailKey);

    const role = text(row.role, `role for user ${id}`, 20);
    if (!["admin", "cashier"].includes(role)) fail(`Invalid role for user ${id}: ${role}`);
    const status = text(row.status, `status for user ${id}`, 20);
    if (!["active", "inactive"].includes(status)) fail(`Invalid status for user ${id}: ${status}`);

    return {
      id,
      full_name: text(row.full_name, `full_name for user ${id}`, 120),
      username: normalizedUsername,
      email: normalizedEmail,
      contact: text(row.contact ?? "", `contact for user ${id}`, 40, { optional: true }) ?? "",
      password_hash: text(row.password_hash, `password_hash for user ${id}`, 255),
      role,
      status,
      must_change_password: integer(row.must_change_password ?? 0, `must_change_password for user ${id}`),
      failed_attempts: integer(row.failed_attempts ?? 0, `failed_attempts for user ${id}`),
      locked_until: text(row.locked_until, `locked_until for user ${id}`, 32, { optional: true }),
      created_by: row.created_by == null ? null : integer(row.created_by, `created_by for user ${id}`, { min: 1 }),
      last_login_at: text(row.last_login_at, `last_login_at for user ${id}`, 32, { optional: true }),
      created_at: text(row.created_at, `created_at for user ${id}`, 32),
      updated_at: text(row.updated_at, `updated_at for user ${id}`, 32)
    };
  });

  if (!users.length) fail("The SQLite database contains no users to migrate.");
  for (const user of users) {
    if (user.created_by != null && !sourceIds.has(user.created_by)) {
      fail(`User ${user.username} references missing created_by user ${user.created_by}.`);
    }
  }
  return users;
}

function validateSettings(rows) {
  const keys = new Set();
  const settings = [];
  for (const row of rows) {
    const key = text(row.key, "settings.key", 64);
    if (keys.has(key)) fail(`Duplicate SQLite setting: ${key}`);
    keys.add(key);
    if (key === "seeded" || key === "base_seeded" || key === "setup_complete") continue;
    settings.push({ key, value: text(row.value, `setting ${key}`, 1024 * 1024, { optional: true }) ?? "" });
  }
  return settings;
}

async function existingSchema() {
  const row = await get(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users','settings')"
  );
  return Number(row.n) === 2;
}

async function findExistingUser(user) {
  const byUsername = await get("SELECT * FROM users WHERE lower(username) = ?", user.username.toLowerCase());
  const byEmail = await get("SELECT * FROM users WHERE lower(email) = ?", user.email.toLowerCase());
  if (byUsername && byEmail && byUsername.id !== byEmail.id) {
    fail(`SQLite user ${user.username} matches two different existing users: ${byUsername.username} and ${byEmail.username}.`);
  }
  return byUsername || byEmail || null;
}

async function planUsers(users) {
  const plan = [];
  for (const user of users) {
    const existing = await findExistingUser(user);
    plan.push({ user, existing });
  }
  return plan;
}

async function migrate(users, settings) {
  const result = { inserted: 0, updated: 0, settings: 0, createdBy: 0 };
  const idMap = new Map();

  await tx(async () => {
    for (const user of users) {
      const existing = await findExistingUser(user);
      if (existing) {
        await run(
          `UPDATE users SET full_name=?, username=?, email=?, contact=?, password_hash=?, role=?, status=?,
                  must_change_password=?, failed_attempts=?, locked_until=?, created_by=NULL,
                  last_login_at=?, created_at=?, updated_at=? WHERE id=?`,
          user.full_name, user.username, user.email, user.contact, user.password_hash, user.role, user.status,
          user.must_change_password ? 1 : 0, user.failed_attempts, user.locked_until,
          user.last_login_at, user.created_at, user.updated_at, existing.id
        );
        idMap.set(user.id, existing.id);
        result.updated++;
      } else {
        const created = await run(
          `INSERT INTO users (full_name, username, email, contact, password_hash, role, status,
                              must_change_password, failed_attempts, locked_until, created_by,
                              last_login_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`,
          user.full_name, user.username, user.email, user.contact, user.password_hash, user.role, user.status,
          user.must_change_password ? 1 : 0, user.failed_attempts, user.locked_until,
          user.last_login_at, user.created_at, user.updated_at
        );
        idMap.set(user.id, Number(created.lastInsertRowid));
        result.inserted++;
      }
    }

    for (const user of users) {
      if (user.created_by == null) continue;
      const targetId = idMap.get(user.id);
      const creatorId = idMap.get(user.created_by);
      if (!targetId || !creatorId) fail(`Could not map created_by for ${user.username}.`);
      await run("UPDATE users SET created_by = ? WHERE id = ?", creatorId, targetId);
      result.createdBy++;
    }

    for (const setting of settings) {
      await setSetting(setting.key, setting.value);
      result.settings++;
    }
    await setSetting("setup_complete", "1");
  });

  return result;
}

async function main() {
  const sourcePath = path.resolve(process.env.TRIPPERS_DB || path.join(__dirname, "..", "data", "trippers.db"));
  const source = readSqlite(sourcePath);
  const users = validateUsers(source.users);
  const settings = validateSettings(source.settings);

  console.log(`Source: ${sourcePath}`);
  console.log(`Users: ${users.length}; settings: ${settings.length} (setup_complete will be set to 1)`);

  if (dryRun) {
    const schemaReady = await existingSchema();
    const plan = schemaReady ? await planUsers(users) : users.map((user) => ({ user, existing: null }));
    console.log(`Target schema ready: ${schemaReady ? "yes" : "no"}`);
    for (const item of plan) {
      console.log(`  ${item.existing ? "update" : "insert"} ${item.user.username} (${item.user.role})`);
    }
    console.log("Dry run: no changes written.");
    return;
  }

  await initDb();
  await seed();
  const result = await migrate(users, settings);
  console.log(`Migration complete: ${result.inserted} users inserted, ${result.updated} users updated, ${result.settings} settings applied.`);
  console.log("setup_complete = 1");
  console.log("Sessions were not migrated. Sign in with the existing accounts and passwords.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => {});
  });
