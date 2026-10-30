'use strict';

// API tests: start the server on a random port with a temporary data folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../app/server');
const { TaskStore } = require('../app/store');

let server, base, dir;

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-'));
  server = createServer(new TaskStore(dir));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
};

test('health endpoint returns ok', async () => {
  const { status, data } = await call('GET', '/api/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(data.status, 'ok');
});

test('info endpoint returns build details', async () => {
  const { data } = await call('GET', '/api/info');
  assert.strictEqual(data.app, 'TaskFlow');
  assert.ok(data.version);
  assert.ok(data.build);
});

test('seed tasks are created on first start', async () => {
  const { data } = await call('GET', '/api/tasks');
  assert.ok(data.length >= 5);
});

test('create, update and delete a task', async () => {
  const created = await call('POST', '/api/tasks', { title: 'Write report', priority: 'high', tag: 'Docs' });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.status, 'backlog');

  const updated = await call('PATCH', `/api/tasks/${created.data.id}`, { status: 'done' });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(updated.data.status, 'done');

  const deleted = await call('DELETE', `/api/tasks/${created.data.id}`);
  assert.strictEqual(deleted.status, 204);

  const again = await call('DELETE', `/api/tasks/${created.data.id}`);
  assert.strictEqual(again.status, 404);
});

test('serves the web page', async () => {
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /TaskFlow/);
});

test('unknown API route returns 404', async () => {
  const { status } = await call('GET', '/api/unknown');
  assert.strictEqual(status, 404);
});
