"use strict";

const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
const mysql = require("mysql2/promise");

const databaseName = process.env.DB_NAME || "trippers_db";
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME must contain only letters, numbers, and underscores.");
}

const poolConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: databaseName,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
  queueLimit: 0,
  charset: "utf8mb4",
  enableKeepAlive: true
};

const pool = mysql.createPool(poolConfig);
const transactionStorage = new AsyncLocalStorage();
const schemaFile = path.join(__dirname, "..", "database", "trippers_mysql.sql");

function executor() {
  const store = transactionStorage.getStore();
  return store ? store.connection : pool;
}

function normalizeParams(params) {
  return params.map((value) => (value === undefined ? null : value));
}

function resultShape(result) {
  const lastInsertRowid = Number(result.insertId || 0);
  const changes = Number(result.affectedRows || 0);
  return { lastInsertRowid, changes, insertId: lastInsertRowid, affectedRows: changes };
}

async function get(sql, ...params) {
  const [rows] = await executor().query(sql, normalizeParams(params));
  return rows[0];
}

async function all(sql, ...params) {
  const [rows] = await executor().query(sql, normalizeParams(params));
  return rows;
}

async function run(sql, ...params) {
  const [result] = await executor().query(sql, normalizeParams(params));
  return resultShape(result);
}

async function tx(fn) {
  if (typeof fn !== "function") throw new TypeError("tx() expects a function.");
  const current = transactionStorage.getStore();
  if (current) return fn();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await transactionStorage.run({ connection }, fn);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    connection.release();
  }
}

function nowISO() {
  return new Date().toISOString();
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function getSetting(key, fallback = null) {
  const row = await get("SELECT `value` FROM settings WHERE `key` = ?", key);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  await run(
    "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    key,
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

async function logActivity({ userId = null, userName = "System", role = "system", action, entity = "", entityId = "", details = "", ip = "" }) {
  await run(
    "INSERT INTO activity_logs (user_id, user_name, role, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    userId, userName, role, action, entity, String(entityId ?? ""), details, ip, nowISO()
  );
}

async function notify({ audience = "admin", userId = null, type = "info", title, message = "" }) {
  await run(
    "INSERT INTO notifications (audience, user_id, type, title, message, is_read, created_at) VALUES (?,?,?,?,?,0,?)",
    audience, userId, type, title, message, nowISO()
  );
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function initDb() {
  const schema = await fs.promises.readFile(schemaFile, "utf8");
  const connection = await mysql.createConnection({
    host: poolConfig.host,
    port: poolConfig.port,
    user: poolConfig.user,
    password: poolConfig.password,
    charset: poolConfig.charset,
    multipleStatements: true
  });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(schema);
  } finally {
    await connection.end();
  }
  return { database: databaseName, schemaFile };
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  db: pool,
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
  initDb,
  closeDb,
  databaseName
};
