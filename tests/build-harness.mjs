// Regenerates test-harness.html from the real ../index.html on every run —
// swaps the three real Firebase CDN <script> tags for mock-firebase.js and
// leaves everything else untouched, so the tests always exercise whatever
// index.html/script.js/inventory/*.js currently are, not a stale copy.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

export function buildHarness() {
  const srcPath = join(repoRoot, 'index.html');
  let html = readFileSync(srcPath, 'utf8');

  // The generated file lives at tests/test-harness.html but index.html's
  // relative asset paths (script.js, inventory/*.js, map.webp, styles.css,
  // sounds/*) assume they're being served from the repo root — <base>
  // makes every relative URL in the document resolve against the server
  // root regardless of the document's own path, so those don't need
  // rewriting (and tests/mock-firebase.js below resolves the same way).
  html = html.replace('<head>', '<head>\n  <base href="/">');

  const appAuthScripts =
    '<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>\n' +
    '  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>';
  if (!html.includes(appAuthScripts)) {
    throw new Error('build-harness: expected Firebase app/auth <script> tags not found in index.html — did the script tags change? Update build-harness.mjs to match.');
  }
  html = html.replace(appAuthScripts, '<script src="tests/mock-firebase.js"></script>');

  const dbScript = '<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>\n  ';
  if (!html.includes(dbScript)) {
    throw new Error('build-harness: expected Firebase database <script> tag not found in index.html — did the script tags change? Update build-harness.mjs to match.');
  }
  html = html.replace(dbScript, '');

  const outPath = join(__dirname, 'test-harness.html');
  writeFileSync(outPath, html);
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outPath = buildHarness();
  console.log('Built', outPath);
}
