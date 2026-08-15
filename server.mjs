import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

createServer((request, response) => {
  const pathname = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const filePath = join(root, relativePath);

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'accelerometer=(self), gyroscope=(self), fullscreen=(self), screen-wake-lock=(self)'
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Pocket Tilt running at http://${host}:${port}`);
});
