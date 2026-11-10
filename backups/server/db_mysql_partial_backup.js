"use strict";

const mysql = require("mysql2");

// Create a connection pool to your XAMPP MySQL database
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "", // Default XAMPP password is blank
  database: "trippers_db", // Make sure you created this database in phpMyAdmin!
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise();

// Simple helper functions for queries
async function get(sql, ...params) {
  const [rows] = await db.query(sql, params);
  return rows[0];
}

async function all(sql, ...params) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function run(sql, ...params) {
  const [result] = await db.execute(sql, params);
  return result;
}

module.exports = {
  db,
  get,
  all,
  run
};