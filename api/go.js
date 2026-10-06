// GET /go/<slug>  ->  records the scan, then redirects to the destination in links.json.
// Changing a destination means editing links.json; the printed QR code never changes.
const links = require("../links.json");
const { configured, pipeline } = require("../lib/redis");
const { parse } = require("../lib/ua");

const SLUG = /^[a-z0-9-]+$/;

async function record(slug, req) {
  const ua = parse(req.headers["user-agent"]);
  if (ua.bot) return;
  const country = req.headers["x-vercel-ip-country"] || "Unknown";
  let referrer = "Direct";
  try { if (req.headers.referer) referrer = new URL(req.headers.referer).hostname; } catch {}
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const key = `qr:${slug}`;
  const recent = JSON.stringify({ t: now.toISOString(), device: ua.device, os: ua.os, browser: ua.browser, country });
  await pipeline([
    ["HINCRBY", key, "total", 1],
    ["HINCRBY", key, `day:${day}`, 1],
    ["HINCRBY", key, `device:${ua.device}`, 1],
    ["HINCRBY", key, `os:${ua.os}`, 1],
    ["HINCRBY", key, `browser:${ua.browser}`, 1],
    ["HINCRBY", key, `country:${country}`, 1],
    ["HINCRBY", key, `ref:${referrer}`, 1],
    ["LPUSH", `${key}:recent`, recent],
    ["LTRIM", `${key}:recent`, 0, 49],
  ]);
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || req.query.c || "");
  const dest = SLUG.test(slug) && Object.hasOwn(links, slug) ? links[slug] : null;
  res.setHeader("Cache-Control", "no-store");

  if (!dest || !/^https?:\/\//i.test(dest)) {
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send("This link isn't set up.");
  }

  // Never let a stats failure stop someone reaching the destination.
  if (configured) {
    try { await record(slug, req); } catch (e) { console.error("scan not recorded:", e.message); }
  }
  res.setHeader("Location", dest);
  res.status(302).end();
};
