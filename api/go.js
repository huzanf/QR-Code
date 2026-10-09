// GET /<slug> (or /go/<slug>) -> records the scan, then redirects to the link's destination.
const legacy = require("../links.json");
const crypto = require("crypto");
const { configured, pipeline } = require("../lib/redis");
const { parse } = require("../lib/ua");
const { SLUG, TTL, canonicalHost } = require("../lib/store");

const clip = s => String(s).slice(0, 60);

async function record(id, uid, req) {
  const ua = parse(req.headers["user-agent"]);
  if (ua.bot) return;
  const country = req.headers["x-vercel-ip-country"] || "Unknown";
  let city = "";
  try { city = decodeURIComponent(req.headers["x-vercel-ip-city"] || ""); } catch {}
  let referrer = "Direct";
  try { if (req.headers.referer) referrer = new URL(req.headers.referer).hostname || "Direct"; } catch {}

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const d = `d:${uid}:${day}`;
  const u = `u:${uid}:${day}`;
  // Anonymous visitor id: changes every day and is never stored in readable form.
  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim();
  const visitor = crypto.createHash("sha256").update(`${ip}|${req.headers["user-agent"] || ""}|${day}|${process.env.STATS_TOKEN || ""}`).digest("hex").slice(0, 16);

  const cmds = [
    ["HINCRBY", `l:${id}`, "total", 1],
    ["HSET", `l:${id}`, "last", now.toISOString()],
    ["HINCRBY", d, "total", 1],
    ["HINCRBY", d, `device:${ua.device}`, 1],
    ["HINCRBY", d, `os:${ua.os}`, 1],
    ["HINCRBY", d, `browser:${ua.browser}`, 1],
    ["HINCRBY", d, `country:${country}`, 1],
    ["HINCRBY", d, `ref:${clip(referrer)}`, 1],
    ["EXPIRE", d, TTL],
    ["PFADD", u, visitor],
    ["EXPIRE", u, TTL],
    ["LPUSH", `r:${uid}`, JSON.stringify({ t: now.toISOString(), device: ua.device, os: ua.os, browser: ua.browser, country, city: clip(city) })],
    ["LTRIM", `r:${uid}`, 0, 49],
  ];
  if (city) cmds.push(["HINCRBY", d, `city:${clip(city)}, ${country}`, 1]);
  await pipeline(cmds);
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || req.query.c || "");
  const id = `${canonicalHost(req)}/${slug}`;
  res.setHeader("Cache-Control", "no-store");

  let dest = null, uid = null;
  if (SLUG.test(slug) && configured) {
    try { [dest, uid] = await pipeline([["HMGET", `l:${id}`, "dest", "uid"]]).then(r => r[0]); }
    catch (e) { console.error("lookup failed:", e.message); }
  }
  // Codes made before links moved to the database still work.
  if (!dest && SLUG.test(slug) && Object.hasOwn(legacy, slug)) dest = legacy[slug];

  if (!dest || !/^https?:\/\//i.test(dest)) {
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send("This link isn't set up.");
  }
  // Never let a stats failure stop someone reaching the destination.
  if (configured && uid) {
    try { await record(id, uid, req); } catch (e) { console.error("scan not recorded:", e.message); }
  }
  res.setHeader("Location", dest);
  res.status(302).end();
};
