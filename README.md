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
