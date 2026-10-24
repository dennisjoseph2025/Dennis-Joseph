/* Self-check for the static portfolio. Run: node check.js */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);

/* 1. Duplicate ids */
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
dupes.length ? fail(`duplicate ids: ${[...new Set(dupes)].join(', ')}`) : pass(`${ids.length} ids, all unique`);

/* 2. Internal anchors resolve */
const anchors = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
const deadAnchors = anchors.filter((a) => !ids.includes(a));
deadAnchors.length ? fail(`dead anchors: ${deadAnchors.join(', ')}`) : pass(`${anchors.length} in-page anchors resolve`);

/* 3. Local asset paths exist */
const refs = [...new Set([
  ...[...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]),
  ...[...css.matchAll(/url\(['"]?(\/[^'")]+)['"]?\)/g)].map((m) => m[1]),
])];
const missing = refs.filter((r) => !fs.existsSync(path.join(ROOT, r.replace(/^\//, ''))));
missing.length ? fail(`missing assets: ${missing.join(', ')}`) : pass(`${refs.length} local assets exist`);

/* 4. Single h1 */
const h1 = (html.match(/<h1\b/g) || []).length;
h1 === 1 ? pass('exactly one <h1>') : fail(`found ${h1} <h1> elements`);

/* 5. JSON-LD valid */
const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!ld.length) fail('no JSON-LD block');
else {
  try {
    ld.forEach((b) => JSON.parse(b));
    pass('JSON-LD parses');
  } catch (e) {
    fail(`JSON-LD invalid: ${e.message}`);
  }
}

/* 6. Required SEO tags */
const required = [
  ['<meta name="description"', 'meta description'],
  ['rel="canonical"', 'canonical link'],
  ['property="og:title"', 'og:title'],
  ['property="og:image"', 'og:image'],
  ['name="twitter:card"', 'twitter:card'],
  ['name="viewport"', 'viewport'],
  ['<title>', 'title'],
];
const missingTags = required.filter(([needle]) => !html.includes(needle)).map(([, name]) => name);
missingTags.length ? fail(`missing SEO tags: ${missingTags.join(', ')}`) : pass(`all ${required.length} SEO tags present`);

/* 7. Every img has alt + dimensions */
const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const badImgs = imgs.filter((t) => !/\balt="/.test(t) || !/\bwidth="/.test(t) || !/\bheight="/.test(t));
badImgs.length ? fail(`${badImgs.length} <img> missing alt/width/height`) : pass(`${imgs.length} images have alt + dimensions`);

/* 8. CSS sanity */
let depth = 0, unbalanced = false;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth < 0) { unbalanced = true; break; } }
}
depth === 0 && !unbalanced ? pass('CSS braces balanced') : fail(`CSS braces unbalanced (depth ${depth})`);
/\b#[\da-fA-F]{5}\s+\d\b/.test(css) ? fail('CSS contains a split/invalid hex colour') : pass('no malformed hex colours');

/* 9. No placeholder lorem / TODO leaks */
/(lorem ipsum|TODO:|FIXME)/i.test(html) ? fail('placeholder text left in HTML') : pass('no placeholder text');

/* Report */
console.log(ok.map((m) => `  PASS  ${m}`).join('\n'));
if (errors.length) {
  console.log('\n' + errors.map((m) => `  FAIL  ${m}`).join('\n'));
  console.log(`\n${errors.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
