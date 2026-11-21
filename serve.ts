#!/usr/bin/env node
// Vice City Cover Studio — static server for app/ (dev + screenshots).
// usage: node serve.ts [--port N]   (default port 8080, localhost only)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'app');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let port = 8080;
const argv = process.argv.slice(2);
const pi = argv.indexOf('--port');
if (pi >= 0 && argv[pi + 1]) {
  const n = parseInt(argv[pi + 1], 10);
  if (Number.isFinite(n) && n > 0 && n < 65536) port = n;
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  let rel = normalize(path).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '');
  if (rel === '') rel = 'index.html';
  const file = join(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => {
  console.log(`Vice City Cover Studio on http://localhost:${port}/`);
});
