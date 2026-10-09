// /api/domains  (owner only)   GET = list, POST {host} = add, DELETE ?host= = remove
// This is the list offered when creating a code. The domain itself must also be
// added to the Vercel project (Settings > Domains) and its DNS pointed at Vercel.
const { configured, pipeline } = require("../lib/redis");
const S = require("../lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.STATS_TOKEN) return res.status(503).json({ error: "STATS_TOKEN is not set on the server." });
  if (!S.isOwner(req)) return res.status(401).json({ error: "Wrong password." });
  if (!configured) return res.status(503).json({ error: "Redis storage is not connected." });
  const primary = S.primaryHost(req);
  try {
    if (req.method === "POST") {
      const host = String(S.body(req).host || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!S.HOST.test(host)) return res.status(400).json({ error: "Enter a domain like go.example.com" });
      await pipeline([["SADD", "domains", host]]);
    } else if (req.method === "DELETE") {
      await pipeline([["SREM", "domains", String(req.query.host || "").toLowerCase()]]);
    } else if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const [domains] = await pipeline([["SMEMBERS", "domains"]]);
    return res.status(200).json({ primary, domains: domains.filter(d => d !== primary).sort() });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
