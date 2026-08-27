// Tiny static server for the prototype preview (dev-only, not part of the app).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';

const ROOT = '/Users/jackmilka/Desktop/THE90';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

    // dev-only sink so the in-page Figma extractor can drop its JSON on disk
    if (req.method === 'POST' && url.pathname === '/__save') {
      const name = normalize(url.searchParams.get('name') || 'scene.json').replace(/^(\.\.[/\\])+/, '');
      const out = join(ROOT, 'figma-export', name);
      if (!out.startsWith(join(ROOT, 'figma-export'))) { res.writeHead(403, CORS); res.end(); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, Buffer.concat(chunks));
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: Buffer.concat(chunks).length, path: out }));
      return;
    }

    let path = normalize(decodeURIComponent(url.pathname));
    if (path === '/' || path === '') path = '/index.html';
    if (path === '/favicon.ico') path = '/assets/the90-logo.svg';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { ...CORS, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, CORS); res.end('not found');
  }
}).listen(4173, () => console.log('serving on 4173'));
