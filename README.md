# Custom QR Code Maker

A single-page app: enter a URL, get a QR code, and add your own logo/design in the center.

## Use
Open `index.html` in a browser (or run `python3 -m http.server` and visit http://localhost:8000).

- Enter a URL; the QR code updates live.
- Upload your logo or design image to place it in the center.
- Customize colors, dot style, and corner style.
- Download as PNG or SVG.

Uses error-correction level H so the code still scans with a logo covering part of it. Keep the logo size moderate and always test-scan before printing.

Requires internet access to load the `qr-code-styling` library from a CDN.

## Tracked QR codes (Bit.ly-style)
Choose **Tracked** in the maker, enter the destination (and optionally a custom back-half and title), and click **Create tracked QR code**. The QR code contains a short link like `https://your-domain/xyz-im-25`. You get back:

- the **short link**,
- your **dashboard** link (needs your admin password), and
- a **share link** (read-only stats for that one code, no password).

Each code's dashboard shows scans over time (7/30/90 days, compared with the previous period), unique visitors, countries, cities, devices, operating systems, browsers, referrers, the latest scans and a change history. You can change the destination at any time without reprinting the code. The code's design (colors, dot style, logo) is saved so you can re-download it later. **My QR codes** (`/stats`) lists every code.

Bots and link previews are not counted. No IP addresses are stored; unique visitors use an anonymous hash that changes daily, so they are counted per day.

### Setup (once)
1. **Storage**: connect an Upstash Redis database to the Vercel project.
2. **Environment variables**: `STATS_TOKEN` = your admin password. Optionally `PRIMARY_HOST` = your main address (for example `qr-code-huzan.vercel.app`) so short links always use it.
3. Redeploy. Then open **My QR codes** and click **Import codes from links.json** to move older codes into the database.

### Custom short domains
Each code can use a different domain, such as `go.clientsite.com`:
1. Add the domain to the Vercel project (**Settings > Domains**).
2. Add the DNS record Vercel shows (usually a `CNAME` to `cname.vercel-dns.com`) wherever the domain's DNS is managed.
3. Add the domain on the **My QR codes** page, then pick it when creating a code.

The same back-half can be used on different domains. A subdomain of the client's own site is the simplest option.

### Old-style codes
`/go/<name>` links and entries in `links.json` still redirect. They are only counted once imported.

Direct codes (the other link type) never touch your site, so they can't be tracked or changed.

## Limits
Each scan uses about 14 Redis commands and each dashboard view about 100, so the free Upstash tier handles roughly 35,000 scans a month.
