// Tiny user-agent classifier: just enough for device / OS / browser breakdowns.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|headless|monitor|uptime/i;

function parse(ua = "") {
  const device = /ipad|tablet/i.test(ua) ? "tablet"
    : /mobi|iphone|ipod|android/i.test(ua) ? "mobile" : "desktop";
  const os = /iphone|ipad|ipod/i.test(ua) ? "iOS"
    : /android/i.test(ua) ? "Android"
    : /windows/i.test(ua) ? "Windows"
    : /mac os x|macintosh/i.test(ua) ? "macOS"
    : /cros/i.test(ua) ? "ChromeOS"
    : /linux/i.test(ua) ? "Linux" : "Other";
  const browser = /edg\//i.test(ua) ? "Edge"
    : /opr\/|opera/i.test(ua) ? "Opera"
    : /samsungbrowser/i.test(ua) ? "Samsung Internet"
    : /firefox|fxios/i.test(ua) ? "Firefox"
    : /chrome|crios/i.test(ua) ? "Chrome"
    : /safari/i.test(ua) ? "Safari" : "Other";
  return { device, os, browser, bot: !ua || BOT.test(ua) };
}

module.exports = { parse };
