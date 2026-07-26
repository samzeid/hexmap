// Minimal static file server for the repo root — no external dependencies,
// so the test suite only needs puppeteer from npm. Replaces the ad-hoc
// `python3 -m http.server` used during development.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

export function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = join(repoRoot, safePath);
        if (!filePath.startsWith(repoRoot)) { res.writeHead(403); res.end(); return; }
        const ext = filePath.slice(filePath.lastIndexOf('.'));
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(body);
      } catch (e) {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || '8791', 10);
  startServer(port).then(() => console.log(`Serving ${repoRoot} on http://localhost:${port}`));
}
