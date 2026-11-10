"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { get, all, run, getSetting, setSetting } = require("./db");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const setupTokenFile = path.join(dataDir, "setup-token.txt");

function getSetupToken() {
  let token = getSetting("setup_token");
  if (!token) {
    token = crypto.randomBytes(16).toString("hex");
    setSetting("setup_token", token);
  }
  fs.writeFileSync(setupTokenFile, token, "utf8");
  return token;
}

function rotateSetupToken() {
  const token = crypto.randomBytes(16).toString("hex");
  setSetting("setup_token", token);
  fs.writeFileSync(setupTokenFile, token, "utf8");
  return token;
}

function verifySetupToken(token) {
  const current = getSetting("setup_token");
  return current && token && crypto.timingSafeEqual(Buffer.from(current), Buffer.from(token));
}

function isInitialized() {
  return getSetting("setup_complete") === "1";
}

function completeSetup() {
  setSetting("setup_complete", "1");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, key] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(hash));
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
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
    mustChangePassword: Boolean(user.must_change_password)
  };
}

function clientIP(req) {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
}

function createSession(req, res, user, remember = false) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const days = remember ? 30 : 1;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  
  run(
    "INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, remember, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)",
    sessionId, user.id, tokenHash, clientIP(req), req.headers["user-agent"] || "", remember ? 1 : 0, expiresAt, new Date().toISOString()
  );

  const cookieOptions = [
    `trp_session=${sessionId}.${token}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${days * 86400}`,
    "Path=/"
  ];
  res.setHeader("Set-Cookie", cookieOptions.join("; "));
}

function findSession(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("trp_session="));
  if (!match) return null;
  const val = match.substring("trp_session=".length);
  const [sessionId, token] = val.split(".");
  if (!sessionId || !token) return null;

  const session = get("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')", sessionId);
  if (!session) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(session.token_hash), Buffer.from(tokenHash))) return null;

  return get("SELECT * FROM users WHERE id = ? AND status = 'active'", session.user_id);
}

function destroySession(req, res) {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("trp_session="));
    if (match) {
      const val = match.substring("trp_session=".length);
      const [sessionId] = val.split(".");
      if (sessionId) run("DELETE FROM sessions WHERE id = ?", sessionId);
    }
  }
  res.setHeader("Set-Cookie", "trp_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/");
}

function recordAttempt(identifier, ip, success) {
  run("INSERT INTO login_attempts (identifier, ip, success, created_at) VALUES (?,?,?,?)", identifier, ip, success ? 1 : 0, new Date().toISOString());
}

function recentFailures(identifier, ip) {
  const row = get("SELECT COUNT(*) AS count FROM login_attempts WHERE (identifier = ? OR ip = ?) AND success = 0 AND created_at >= datetime('now', '-15 minutes')", identifier, ip);
  return row ? row.count : 0;
}

module.exports = {
  getSetupToken,
  rotateSetupToken,
  verifySetupToken,
  isInitialized,
  completeSetup,
  hashPassword,
  verifyPassword,
  validatePassword,
  publicUser,
  createSession,
  findSession,
  destroySession,
  recordAttempt,
  recentFailures
};