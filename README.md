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

## Redirectable QR codes
Choose **Redirectable** in the app. The QR code then points to `<your site>/go/<name>`, and `go/index.html` looks the name up in `links.json` and forwards visitors to the destination.

- To create one: enter your deployed site address, a short name and the destination, generate the QR code, then add the line shown in the app to `links.json` and push.
- To change where it goes later: edit that name's URL in `links.json` and push. The printed QR code keeps working.

This needs the site deployed (Vercel, GitHub Pages, etc.) at an address you'll keep. Use a domain you own if the code must last.

## Scan analytics (like Bit.ly)
Every scan of a redirectable code goes through `/go/<name>`, which records it and redirects. The stats page (`/stats.html`) shows, per code: total scans, last 7/30 days, a daily chart, devices (mobile/tablet/desktop), operating systems, browsers, countries, where the visitor came from, and the latest scans. Bots and link previews are not counted, and no IP addresses are stored.

One-time setup in the Vercel project:
1. **Storage** tab: add an **Upstash Redis** database (free tier is fine) and connect it to this project. This sets the connection environment variables automatically.
2. **Settings > Environment Variables**: add `STATS_TOKEN` with a password of your choice. You type it on the stats page.
3. Redeploy so the variables take effect.

Direct (non-redirectable) codes can't be counted because they never touch your site.
