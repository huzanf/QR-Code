// /api/link?l=<host/slug>
//   GET    owner, or anyone with the share token (&t=)  -> details + analytics (&days=7|30|90)
//   PATCH  owner  {dest?, title?, design?, resetToken?}
//   DELETE owner
const { configured, pipeline } = require("../lib/redis");
const S = require("../lib/store");

const GROUPS = { device: "devices", os: "os", browser: "browsers", country: "countries", city: "cities", ref: "referrers" };

function aggregate(dayObjs) {
  const out = { total: 0 };
  for (const g of Object.values(GROUPS)) out[g] = {};
  for (const o of dayObjs) {
    for (const [k, v] of Object.entries(o)) {
      if (k === "total") { out.total += Number(v); continue; }
      const i = k.indexOf(":");
      const group = GROUPS[k.slice(0, i)];
      if (group) out[group][k.slice(i + 1)] = (out[group][k.slice(i + 1)] || 0) + Number(v);
    }
  }
  return out;
}

const parseList = list => (list || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!configured) return res.status(503).json({ error: "Redis storage is not connected." });
  const id = String(req.query.l || "");
  const slash = id.indexOf("/");
  if (slash < 1) return res.status(400).json({ error: "Missing link." });

  try {
    const [flat] = await pipeline([["HGETALL", `l:${id}`]]);
    const h = S.toObject(flat);
    const owner = S.isOwner(req);
    // Same message for "no such link" and "wrong token" so tokens can't be probed.
    if (!h.uid || !(owner || S.sameSecret(req.query.t, h.token))) {
      return res.status(owner ? 404 : 401).json({ error: owner ? "Link not found." : "Wrong password or link." });
    }

    if (req.method === "PATCH") {
      if (!owner) return res.status(401).json({ error: "Wrong password." });
      const b = S.body(req);
      const cmds = [];
      const now = new Date().toISOString();
      let newToken;
      if (b.dest !== undefined) {
        if (!S.validDest(b.dest)) return res.status(400).json({ error: "Enter a full destination URL starting with http:// or https://" });
        if (b.dest !== h.dest) {
          cmds.push(["HSET", `l:${id}`, "dest", b.dest]);
          cmds.push(["LPUSH", `h:${h.uid}`, JSON.stringify({ t: now, type: "destination", from: h.dest, dest: b.dest })]);
        }
      }
      if (b.title !== undefined) cmds.push(["HSET", `l:${id}`, "title", String(b.title).slice(0, 120)]);
      if (b.design && typeof b.design === "object") {
        if (JSON.stringify(b.design).length > 300000) return res.status(400).json({ error: "The logo image is too large." });
        cmds.push(["HSET", `l:${id}`, "design", JSON.stringify(b.design)]);
      }
      if (b.resetToken) {
        newToken = require("crypto").randomBytes(16).toString("hex");
        cmds.push(["HSET", `l:${id}`, "token", newToken]);
        cmds.push(["LPUSH", `h:${h.uid}`, JSON.stringify({ t: now, type: "share-reset" })]);
      }
      if (cmds.length) await pipeline(cmds);
      return res.status(200).json({ ok: true, token: newToken });
    }

    if (req.method === "DELETE") {
      if (!owner) return res.status(401).json({ error: "Wrong password." });
      await pipeline([["DEL", `l:${id}`], ["DEL", `r:${h.uid}`], ["DEL", `h:${h.uid}`], ["SREM", "links", id]]);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const cur = S.dayList(days);
    const prev = S.dayList(days * 2).slice(0, days);
    const r = await pipeline([
      ...cur.map(d => ["HGETALL", `d:${h.uid}:${d}`]),
      ...prev.map(d => ["HGET", `d:${h.uid}:${d}`, "total"]),
      ...cur.map(d => ["PFCOUNT", `u:${h.uid}:${d}`]),
      ["LRANGE", `r:${h.uid}`, 0, 19],
      ["LRANGE", `h:${h.uid}`, 0, 29],
    ], 8000);
    const dayObjs = r.slice(0, days).map(S.toObject);
    const prevTotals = r.slice(days, days * 2).map(Number);
    const uniques = r.slice(days * 2, days * 3).map(Number);
    const agg = aggregate(dayObjs);
    let design = {};
    try { design = JSON.parse(h.design || "{}"); } catch {}

    const slug = id.slice(slash + 1), host = id.slice(0, slash);
    return res.status(200).json({
      link: { id, host, slug, shortUrl: `${S.origin(host, req)}/${slug}`, dest: h.dest, title: h.title || "", created: h.created,
        last: h.last || null, total: Number(h.total || 0), design, owner, token: owner ? h.token : undefined },
      range: {
        days, total: agg.total, prevTotal: prevTotals.reduce((a, b) => a + b, 0), unique: uniques.reduce((a, b) => a + b, 0),
        series: cur.map((d, i) => ({ d, v: Number(dayObjs[i].total || 0), u: uniques[i], p: prevTotals[i] })),
        devices: agg.devices, os: agg.os, browsers: agg.browsers, countries: agg.countries, cities: agg.cities, referrers: agg.referrers,
      },
      recent: parseList(r[days * 3]),
      history: parseList(r[days * 3 + 1]),
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: e.message });
  }
};
