"use strict";

const MAX_BODY = 2 * 1024 * 1024;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function serializeCookie(name, value, options = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  bits.push(`Path=${options.path || "/"}`);
  if (options.maxAge != null) bits.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) bits.push(`Expires=${options.expires.toUTCString()}`);
  bits.push(`HttpOnly`);
  bits.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure) bits.push("Secure");
  return bits.join("; ");
}

function sendJSON(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function sendError(res, status, message, extra = {}) {
  sendJSON(res, status, { ok: false, error: message, ...extra });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function clientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function normalizeHost(value) {
  if (!value) return "";
  let host = String(value).trim().toLowerCase();
  if (!host) return "";
  // IPv6 hosts look like [::1]:4173.
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end === -1) return host;
    const address = host.slice(0, end + 1);
    const port = host.slice(end + 1).replace(/^:/, "");
    return port && port !== "80" && port !== "443" ? `${address}:${port}` : address;
  }
  const colon = host.lastIndexOf(":");
  if (colon !== -1 && host.indexOf(":") === colon) {
    const port = host.slice(colon + 1);
    if (port === "80" || port === "443") host = host.slice(0, colon);
  }
  return host;
}

function sameOrigin(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  // Browsers set this header themselves and it cannot be forged by a page.
  if (fetchSite === "cross-site") return false;

  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl, tests)

  let originHost;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    originHost = normalizeHost(parsed.host);
  } catch {
    return false;
  }
  if (!originHost) return false;

  const hosts = new Set();
  const addHost = (value) => {
    if (typeof value !== "string") return;
    for (const part of value.split(",")) {
      const normalized = normalizeHost(part);
      if (normalized) hosts.add(normalized);
    }
  };
  addHost(req.headers.host);
  addHost(req.headers["x-forwarded-host"]);

  const forwarded = req.headers.forwarded;
  if (typeof forwarded === "string") {
    for (const part of forwarded.split(",")) {
      const match = /host="?([^";]+)"?/i.exec(part);
      if (match) addHost(match[1]);
    }
  }

  if (hosts.has(originHost)) return true;
  // Some tunnels and IDE preview proxies rewrite the Host header while
  // keeping the browser's same-origin fetch metadata intact.
  return fetchSite === "same-origin" || fetchSite === "none";
}

function sanitizeText(value, max = 500) {
  if (value == null) return "";
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

module.exports = {
  parseCookies,
  serializeCookie,
  sendJSON,
  sendError,
  readBody,
  clientIP,
  sameOrigin,
  sanitizeText,
  toNumber,
  round2,
  isEmail
};
