// Shared helpers for the API functions: hosts, auth, validation and link creation.
const crypto = require("crypto");
const { pipeline } = require("./redis");

// Short names that must never be used, because they are real pages or paths.
const RESERVED = new Set(["api", "go", "stats", "dashboard", "index", "admin", "login", "favicon", "robots", "assets", "static", "app"]);
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{1,59}$/;
const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const TTL = 400 * 86400; // per-day stats expire after ~13 months

function reqHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

// The "main" address of this project, where the admin pages live.
function primaryHost(req) {
  const env = process.env.PRIMARY_HOST || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
  return (env.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || reqHost(req)).toLowerCase();
}

// All *.vercel.app addresses of the project share one set of links.
function canonicalHost(req) {
  const h = reqHost(req);
  return h.endsWith(".vercel.app") ? primaryHost(req) : h;
}

const origin = host => `${/^(localhost|127\.)/.test(host) ? "http" : "https"}://${host}`;

function sameSecret(a, b) {
  if (!a || !b) return false;
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function isOwner(req) {
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return sameSecret(given, process.env.STATS_TOKEN);
}

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

function validDest(s) {
  if (typeof s !== "string" || s.length > 2048) return false;
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

function toObject(flat) {
  const o = {};
  for (let i = 0; Array.isArray(flat) && i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}

function randomSlug() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(7);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

// Claims id ("host/slug") and stores the link. Returns null if the id is taken.
async function createLink(id, { dest, title = "", design = {} }) {
  const [claimed] = await pipeline([["HSETNX", `l:${id}`, "dest", dest]]);
  if (!claimed) return null;
  const uid = crypto.randomBytes(6).toString("hex");
  const token = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  await pipeline([
    ["HSET", `l:${id}`, "uid", uid, "title", String(title).slice(0, 120), "created", now, "token", token, "design", JSON.stringify(design || {}), "total", 0],
    ["SADD", "links", id],
    ["LPUSH", `h:${uid}`, JSON.stringify({ t: now, type: "created", dest })],
  ]);
  return { uid, token };
}

function dayList(n, end = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(end.getTime() - i * 864e5).toISOString().slice(0, 10));
  return out;
}

module.exports = { RESERVED, SLUG, HOST, TTL, reqHost, primaryHost, canonicalHost, origin, sameSecret, isOwner, body, validDest, toObject, randomSlug, createLink, dayList };
