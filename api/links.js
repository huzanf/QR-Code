// /api/links  (owner only)   GET = list codes, POST = create a code (or import links.json)
const legacy = require("../links.json");
const { configured, pipeline } = require("../lib/redis");
const S = require("../lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.STATS_TOKEN) return res.status(503).json({ error: "STATS_TOKEN is not set on the server." });
  if (!S.isOwner(req)) return res.status(401).json({ error: "Wrong password." });
  if (!configured) return res.status(503).json({ error: "Redis storage is not connected." });
  const primary = S.primaryHost(req);

  try {
    if (req.method === "GET") {
      const [ids] = await pipeline([["SMEMBERS", "links"]]);
      const rows = ids.length ? await pipeline(ids.map(id => ["HGETALL", `l:${id}`])) : [];
      const links = ids.map((id, i) => {
        const h = S.toObject(rows[i]);
        const slash = id.indexOf("/");
        return { id, host: id.slice(0, slash), slug: id.slice(slash + 1), shortUrl: `${S.origin(id.slice(0, slash), req)}/${id.slice(slash + 1)}`,
          dest: h.dest, title: h.title || "", created: h.created, last: h.last || null, total: Number(h.total || 0) };
      }).sort((a, b) => String(b.created).localeCompare(String(a.created)));
      return res.status(200).json({ links, primary });
    }

    if (req.method === "POST") {
      const b = S.body(req);

      if (b.importLegacy) {
        let imported = 0;
        for (const [slug, dest] of Object.entries(legacy)) {
          if (await S.createLink(`${primary}/${slug}`, { dest, title: slug })) imported++;
        }
        return res.status(200).json({ imported });
      }

      if (!S.validDest(b.dest)) return res.status(400).json({ error: "Enter a full destination URL starting with http:// or https://" });
      const host = String(b.host || primary).toLowerCase();
      if (host !== primary) {
        const [ok] = await pipeline([["SISMEMBER", "domains", host]]);
        if (!ok) return res.status(400).json({ error: `${host} isn't in your domain list.` });
      }
      const design = b.design && typeof b.design === "object" ? b.design : {};
      if (JSON.stringify(design).length > 300000) return res.status(400).json({ error: "The logo image is too large." });

      let slug = String(b.slug || "").trim();
      if (slug && (!S.SLUG.test(slug) || S.RESERVED.has(slug.toLowerCase()))) {
        return res.status(400).json({ error: "Short name: 2-60 letters, numbers, dashes or underscores (and not a reserved word)." });
      }
      let made = null;
      for (let i = 0; i < 6 && !made; i++) {
        const candidate = slug || S.randomSlug();
        made = await S.createLink(`${host}/${candidate}`, { dest: b.dest, title: b.title, design });
        if (made) slug = candidate;
        else if (b.slug) return res.status(409).json({ error: `${host}/${candidate} is already taken.` });
      }
      if (!made) return res.status(500).json({ error: "Couldn't find a free short name. Try again." });

      const id = `${host}/${slug}`;
      const dash = `${S.origin(primary, req)}/dashboard?l=${encodeURIComponent(id)}`;
      return res.status(201).json({ id, host, slug, shortUrl: `${S.origin(host, req)}/${slug}`, dashboardUrl: dash, shareUrl: `${dash}&t=${made.token}` });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: e.message });
  }
};
