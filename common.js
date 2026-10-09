// Shared helpers for the QR maker, code list and dashboard pages.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const Auth = {
  get() { try { return sessionStorage.getItem("pw") || ""; } catch { return ""; } },
  set(p) { try { sessionStorage.setItem("pw", p); } catch {} },
  clear() { try { sessionStorage.removeItem("pw"); } catch {} },
};

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const pw = Auth.get();
  if (auth && pw) headers.Authorization = "Bearer " + pw;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

function isValidUrl(s) {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

function breakdown(title, obj, limit = 6) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = entries.reduce((s, e) => s + e[1], 0);
  const rows = entries.map(([k, v]) =>
    `<div class="brow" style="--pct:${Math.round(v / total * 100)}%"><span>${esc(k)}</span><span>${v}</span></div>`).join("");
  return `<div><h3>${esc(title)}</h3>${rows || '<div class="empty">No data yet</div>'}</div>`;
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch { return; }
  if (btn) { const old = btn.textContent; btn.textContent = "Copied"; setTimeout(() => btn.textContent = old, 1200); }
}

const DEFAULT_DESIGN = { fg: "#1c1e21", bg: "#ffffff", dots: "dots", corners: "extra-rounded", logoSize: 0.35, logo: "" };

// Builds a styled QR code inside `el`; returns an object with update(data, design) and download(ext).
function makeQR(el, size = 300) {
  const qr = new QRCodeStyling({
    width: size, height: size, type: "canvas", margin: 10,
    qrOptions: { errorCorrectionLevel: "H" }, // high redundancy so a center logo still scans
    imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: 0.35 },
  });
  qr.append(el);
  return {
    update(data, d) {
      d = { ...DEFAULT_DESIGN, ...(d || {}) };
      qr.update({
        data, image: d.logo || undefined,
        dotsOptions: { color: d.fg, type: d.dots },
        backgroundOptions: { color: d.bg },
        cornersSquareOptions: { color: d.fg, type: d.corners },
        cornersDotOptions: { color: d.fg },
        imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: Number(d.logoSize) },
      });
    },
    download(ext, name = "qr-code") { qr.download({ name, extension: ext }); },
  };
}

// Shrinks an uploaded logo so it can be saved with the code (max 256px).
function scaleLogo(dataUrl, max = 256) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || max, h = img.naturalHeight || max;
      const k = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * k) || max; c.height = Math.round(h * k) || max;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
