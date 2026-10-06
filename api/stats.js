// GET /api/stats  (Authorization: Bearer <STATS_TOKEN>)  ->  per-code scan statistics.
const crypto = require("crypto");
const links = require("../links.json");
const { configured, pipeline } = require("../lib/redis");

function authorized(req) {
  const expected = process.env.STATS_TOKEN;
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// HGETALL replies arrive as a flat [field, value, ...] array.
function toObject(flat) {
  const o = {};
  for (let i = 0; Array.isArray(flat) && i < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]);
  return o;
}

function group(h, prefix) {
  const out = {};
  for (const [k, v] of Object.entries(h)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.STATS_TOKEN) return res.status(503).json({ error: "STATS_TOKEN is not set on the server." });
  if (!authorized(req)) return res.status(401).json({ error: "Wrong password." });
  if (!configured) return res.status(503).json({ error: "Redis storage is not connected." });

  const slugs = Object.keys(links);
  const cmds = slugs.flatMap(s => [["HGETALL", `qr:${s}`], ["LRANGE", `qr:${s}:recent`, 0, 19]]);
  let results;
  try { results = cmds.length ? await pipeline(cmds, 5000) : []; }
  catch (e) { return res.status(502).json({ error: e.message }); }

  const out = slugs.map((slug, i) => {
    const h = toObject(results[i * 2]);
    const recent = (results[i * 2 + 1] || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    return {
      slug,
      destination: links[slug],
      total: h.total || 0,
      days: group(h, "day:"),
      devices: group(h, "device:"),
      os: group(h, "os:"),
      browsers: group(h, "browser:"),
      countries: group(h, "country:"),
      referrers: group(h, "ref:"),
      recent,
    };
  });
  res.status(200).json({ codes: out });
};
