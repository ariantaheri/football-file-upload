import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '127.0.0.1';
const allowedFiles = new Set([
  '/index.html',
  '/favicon.svg',
  '/src/config.js',
  '/src/game.js',
  '/src/styles.css',
  '/assets/preview.svg'
]);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (!allowedFiles.has(pathname)) {
    response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' }).end('Not found');
    return;
  }

  const filePath = path.join(root, pathname.slice(1));
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' }).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Demo available at http://${host}:${port}`);
});
