'use strict';

// Unit tests for the task store and input validation.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TaskStore, ValidationError } = require('../app/store');

const tmpStore = () => new TaskStore(fs.mkdtempSync(path.join(os.tmpdir(), 'store-')));

test('new store is seeded with sample tasks', () => {
  assert.ok(tmpStore().list().length > 0);
});

test('title is required', () => {
  assert.throws(() => tmpStore().create({ title: '   ' }), ValidationError);
});

test('invalid status is rejected', () => {
  assert.throws(() => tmpStore().create({ title: 'x', status: 'later' }), ValidationError);
});

test('invalid priority is rejected', () => {
  assert.throws(() => tmpStore().create({ title: 'x', priority: 'urgent' }), ValidationError);
});

test('defaults are applied', () => {
  const t = tmpStore().create({ title: 'Plan sprint' });
  assert.strictEqual(t.status, 'backlog');
  assert.strictEqual(t.priority, 'medium');
  assert.ok(t.id && t.createdAt);
});

test('unknown fields are ignored', () => {
  const t = tmpStore().create({ title: 'Clean', id: 'hack', admin: true });
  assert.notStrictEqual(t.id, 'hack');
  assert.strictEqual(t.admin, undefined);
});

test('data is saved to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
  const a = new TaskStore(dir);
  const t = a.create({ title: 'Persist me' });
  const b = new TaskStore(dir);
  assert.ok(b.list().some((x) => x.id === t.id));
});

test('update of a missing task returns null', () => {
  assert.strictEqual(tmpStore().update('missing', { title: 'x' }), null);
});
