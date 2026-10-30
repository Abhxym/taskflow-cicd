'use strict';

// TaskFlow - small task board API + web UI (Node.js, no external packages)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { TaskStore, ValidationError } = require('./store');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Build details are passed in by Jenkins (docker build args) and Terraform (env vars)
const info = {
  app: 'TaskFlow',
  version: process.env.APP_VERSION || '1.0.0',
  build: process.env.BUILD_NUMBER || 'local',
  commit: (process.env.GIT_COMMIT || 'dev').slice(0, 7),
  environment: process.env.DEPLOY_ENV || 'local',
  instance: os.hostname(),
  startedAt: new Date().toISOString(),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function createServer(store) {
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    res.setHeader('X-Instance', info.instance);
    try {
      if (pathname === '/api/health') return json(res, 200, { status: 'ok', instance: info.instance });
      if (pathname === '/api/info') return json(res, 200, info);

      if (pathname === '/api/tasks') {
        if (req.method === 'GET') return json(res, 200, store.list());
        if (req.method === 'POST') return json(res, 201, store.create(await body(req)));
        return json(res, 405, { error: 'method not allowed' });
      }

      const m = pathname.match(/^\/api\/tasks\/([\w-]+)$/);
      if (m) {
        if (req.method === 'PATCH') {
          const task = store.update(m[1], await body(req));
          return task ? json(res, 200, task) : json(res, 404, { error: 'task not found' });
        }
        if (req.method === 'DELETE') {
          return store.remove(m[1]) ? json(res, 204) : json(res, 404, { error: 'task not found' });
        }
        return json(res, 405, { error: 'method not allowed' });
      }

      if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });
      return serveStatic(res, pathname);
    } catch (err) {
      if (err instanceof ValidationError || err instanceof SyntaxError) return json(res, 400, { error: err.message });
      console.error(err);
      return json(res, 500, { error: 'internal error' });
    }
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data === undefined ? '' : JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

if (require.main === module) {
  const store = new TaskStore(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
  const server = createServer(store);
  server.listen(PORT, () => {
    console.log(`TaskFlow ${info.version} (build ${info.build}, ${info.commit}) on port ${PORT} [${info.environment}]`);
  });
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

module.exports = { createServer, info };
