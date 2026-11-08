"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { get, run, nowISO, logActivity, getSetting } = require("./db");
const { parseCookies, serializeCookie, clientIP } = require("./http");

const COOKIE_NAME = "trippers_session";
const SESSION_INDEX = "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)";
const { db } = require("./db");
db.exec(SESSION_INDEX);

const dataDir = path.join(__dirname, "..", "data");
const setupTokenPath = path.join(dataDir, "setup-token.txt");

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sessionMinutes(remember) {
  const fallback = remember ? 60 * 24 * 30 : 720;
  const configured = Number(getSetting("session_timeout_minutes", "720"));
  if (!remember && Number.isFinite(configured) && configured > 0) return configured;
  return fallback;
}

function createSession(req, res, user, remember = false) {
  const token = crypto.randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  const minutes = sessionMinutes(remember);
  const expires = new Date(Date.now() + minutes * 60 * 1000);

  run(
    "INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, remember, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)",
    id, user.id, sha256(token), clientIP(req), String(req.headers["user-agent"] || "").slice(0, 300),
    remember ? 1 : 0, expires.toISOString(), nowISO()
  );

  res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, token, {
    maxAge: minutes * 60,
    expires,
    secure: process.env.TRIPPERS_SECURE_COOKIES === "1"
  }));
  return { token, expires };
}

function findSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const hash = sha256(token);
  const row = get(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.full_name, u.username, u.email, u.contact,
            u.role, u.status, u.must_change_password, u.last_login_at, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hash
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE id = ?", row.session_id);
    return null;
  }
  if (row.status !== "active") return null;
  return row;
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, "", { maxAge: 0 }));
}

function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
  clearSessionCookie(res);
}

function cleanupSessions() {
  run("DELETE FROM sessions WHERE expires_at < ?", nowISO());
}
cleanupSessions();

/* ------------------------------------------------------------------ */
/* Login protection                                                    */
/* ------------------------------------------------------------------ */

function recentFailures(identifier, ip) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = get(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND created_at >= ? AND (identifier = ? OR ip = ?)",
    since, identifier, ip
  );
  return row ? row.n : 0;
}

function recordAttempt(identifier, ip, success) {
  run(
    "INSERT INTO login_attempts (identifier, ip, success, created_at) VALUES (?,?,?,?)",
    identifier, ip, success ? 1 : 0, nowISO()
  );
  // Keep the table small.
  run("DELETE FROM login_attempts WHERE created_at < ?", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

function canAccessAdmin(user) {
  return Boolean(user && user.role === "admin");
}

function canAccessCashier(user) {
  return Boolean(user && (user.role === "cashier" || user.role === "admin"));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    contact: user.contact,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at
  };
}

/* ------------------------------------------------------------------ */
/* One-time admin initialization                                       */
/* ------------------------------------------------------------------ */

function adminCount() {
  const row = get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  return row ? row.n : 0;
}

function isInitialized() {
  return adminCount() > 0;
}

function getSetupToken() {
  if (!fs.existsSync(setupTokenPath)) {
    const token = crypto.randomBytes(24).toString("hex");
    fs.writeFileSync(setupTokenPath, token, { mode: 0o600 });
    return token;
  }
  return fs.readFileSync(setupTokenPath, "utf8").trim();
}

function rotateSetupToken() {
  const token = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(setupTokenPath, token, { mode: 0o600 });
  return token;
}

function verifySetupToken(candidate) {
  if (!candidate) return false;
  const expected = getSetupToken();
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function completeSetup() {
  try { fs.unlinkSync(setupTokenPath); } catch { /* already gone */ }
  try { fs.unlinkSync(path.join(dataDir, "setup-token.txt")); } catch { /* ignore */ }
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  validatePassword,
  createSession,
  findSession,
  destroySession,
  clearSessionCookie,
  recentFailures,
  recordAttempt,
  canAccessAdmin,
  canAccessCashier,
  publicUser,
  isInitialized,
  getSetupToken,
  rotateSetupToken,
  verifySetupToken,
  completeSetup,
  adminCount,
  logActivity
};
