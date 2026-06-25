// A short build token used to cache-bust local JS/CSS asset URLs. Derived from
// the newest mtime across the front-end asset dirs, so it changes on every
// deploy (Railway re-clones the repo) but stays stable across plain restarts.
// Falls back to process start time if the filesystem can't be read.
const fs = require('fs');
const path = require('path');

function computeBuild() {
  const dirs = ['public/js', 'public/js/screens', 'public/css'];
  let maxMtime = 0;
  try {
    for (const d of dirs) {
      const full = path.join(__dirname, '..', d);
      for (const name of fs.readdirSync(full)) {
        const st = fs.statSync(path.join(full, name));
        if (st.isFile() && st.mtimeMs > maxMtime) maxMtime = st.mtimeMs;
      }
    }
  } catch (_) { /* ignore */ }
  return (maxMtime > 0 ? Math.floor(maxMtime) : Date.now()).toString(36);
}

const BUILD = computeBuild();

// Append ?v=BUILD to local /js and /css URLs in an HTML string. Absolute
// (https://) CDN URLs and already-versioned URLs are left untouched.
function withAssetVersion(html) {
  return String(html).replace(/(src|href)="(\/(?:js|css)\/[^"?]+)"/g, `$1="$2?v=${BUILD}"`);
}

module.exports = { BUILD, withAssetVersion };
