"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi } = require("./server/api");
const { isInitialized, getSetupToken, findSession } = require("./server/auth");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};

const BLOCKED_PREFIXES = ["/server", "/data", "/.vscode", "/.git", "/node_modules"];
const BLOCKED_FILES = new Set([
  "/server.js", "/package.json", "/package-lock.json", "/README.md", "/desktop.ini"
]);

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join("; ")
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  if (pathname.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(key, value);

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/login" || pathname === "/login.html" || pathname === "/admin/login.html") {
    response.writeHead(302, { Location: "/index.html", "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/dashboard.html";

  const protectedPage = pathname === "/pos.html" || pathname.startsWith("/admin/") && pathname.endsWith(".html");
  if (protectedPage) {
    const user = findSession(request);
    if (!isInitialized()) {
      response.writeHead(302, { Location: "/index.html#setup", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (!user) {
      response.writeHead(302, { Location: "/index.html", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (user.must_change_password) {
      response.writeHead(302, { Location: "/index.html#change-password", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (pathname === "/pos.html" && user.role !== "cashier") {
      response.writeHead(302, { Location: "/admin/dashboard.html", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (pathname.startsWith("/admin/") && user.role !== "admin") {
      response.writeHead(302, { Location: "/pos.html", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
  }

  const lowerPath = pathname.toLowerCase();
  if (BLOCKED_PREFIXES.some((prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`))) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  if (BLOCKED_FILES.has(lowerPath) || path.basename(lowerPath).startsWith(".")) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!mimeTypes[ext]) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[ext],
      "Content-Length": stats.size,
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log("");
  console.log("  TRIPPERS COFFEE · POS & Management System");
  console.log(`  Running at http://localhost:${port}`);
  console.log("");
  if (!isInitialized()) {
    const token = getSetupToken();
    console.log("  FIRST-TIME SETUP REQUIRED");
    console.log("  Open http://localhost:" + port + "/login.html#setup");
    console.log("  One-time setup token: " + token);
    console.log("  (also saved to data/setup-token.txt)");
    console.log("");
  }
  console.log("  Press Ctrl+C to stop.");
  console.log("");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT to a different value.`);
    process.exit(1);
  }
  throw error;
});
