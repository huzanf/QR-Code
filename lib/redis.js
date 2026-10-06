// Minimal Upstash/Vercel KV REST client (no dependencies).
// Works with the env vars set by Vercel's Upstash Redis integration.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = Boolean(url && token);

// Runs several commands in one round trip. Returns an array of results.
async function pipeline(commands, timeoutMs = 1500) {
  if (!configured) throw new Error("Redis is not configured");
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const out = await res.json();
  return out.map(r => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

module.exports = { configured, pipeline };
