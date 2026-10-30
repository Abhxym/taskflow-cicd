'use strict';

// Very small JSON file store for tasks.
// The file lives in DATA_DIR, which is a Docker volume created by Terraform,
// so tasks survive container restarts and redeployments.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STATUSES = ['backlog', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

const SEED = [
  { title: 'Set up Jenkins pipeline', description: 'Checkout, test, build and deploy stages in a Jenkinsfile.', status: 'done', priority: 'high', tag: 'DevOps', assignee: 'Abhay Maurya', due: '2026-11-02' },
  { title: 'Write Terraform module for the app', description: 'Network, volume, containers and Nginx load balancer.', status: 'done', priority: 'high', tag: 'Infra', assignee: 'Abhay Maurya', due: '2026-11-03' },
  { title: 'Add unit tests for the task API', description: 'Cover create, update, delete and validation errors.', status: 'review', priority: 'medium', tag: 'Testing', assignee: 'Riya Shah', due: '2026-11-05' },
  { title: 'Drag and drop between columns', description: 'Move cards and save the new status.', status: 'in_progress', priority: 'medium', tag: 'Frontend', assignee: 'Karan Mehta', due: '2026-11-06' },
  { title: 'Production approval step', description: 'Manual input step before deploying to production.', status: 'in_progress', priority: 'high', tag: 'DevOps', assignee: 'Abhay Maurya', due: '2026-11-07' },
  { title: 'Dark mode', description: 'Theme toggle saved per browser.', status: 'backlog', priority: 'low', tag: 'Frontend', assignee: 'Sneha Patil', due: '2026-11-12' },
  { title: 'Email reminders for due tasks', description: 'Send a daily summary of tasks due tomorrow.', status: 'backlog', priority: 'low', tag: 'Backend', assignee: 'Riya Shah', due: '2026-11-15' },
];

class TaskStore {
  constructor(dir) {
    this.file = path.join(dir, 'tasks.json');
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.file)) {
      const now = new Date().toISOString();
      this.write(SEED.map((t) => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...t })));
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }

  write(tasks) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2));
    fs.renameSync(tmp, this.file);
  }

  list() {
    return this.read();
  }

  create(input) {
    const task = validate(input, true);
    const now = new Date().toISOString();
    const full = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...task };
    const tasks = this.read();
    tasks.push(full);
    this.write(tasks);
    return full;
  }

  update(id, input) {
    const tasks = this.read();
    const i = tasks.findIndex((t) => t.id === id);
    if (i === -1) return null;
    tasks[i] = { ...tasks[i], ...validate(input, false), updatedAt: new Date().toISOString() };
    this.write(tasks);
    return tasks[i];
  }

  remove(id) {
    const tasks = this.read();
    const left = tasks.filter((t) => t.id !== id);
    if (left.length === tasks.length) return false;
    this.write(left);
    return true;
  }
}

class ValidationError extends Error {}

// Returns a clean copy of the allowed fields, or throws ValidationError.
function validate(input, isNew) {
  if (!input || typeof input !== 'object') throw new ValidationError('body must be a JSON object');
  const out = {};
  if (isNew || 'title' in input) {
    const title = String(input.title || '').trim();
    if (!title) throw new ValidationError('title is required');
    if (title.length > 120) throw new ValidationError('title must be 120 characters or less');
    out.title = title;
  }
  if ('description' in input) out.description = String(input.description || '').slice(0, 500);
  if (isNew || 'status' in input) {
    const status = input.status || 'backlog';
    if (!STATUSES.includes(status)) throw new ValidationError(`status must be one of ${STATUSES.join(', ')}`);
    out.status = status;
  }
  if (isNew || 'priority' in input) {
    const priority = input.priority || 'medium';
    if (!PRIORITIES.includes(priority)) throw new ValidationError(`priority must be one of ${PRIORITIES.join(', ')}`);
    out.priority = priority;
  }
  for (const key of ['tag', 'assignee', 'due']) {
    if (key in input) out[key] = String(input[key] || '').slice(0, 60);
  }
  return out;
}

module.exports = { TaskStore, ValidationError, STATUSES, PRIORITIES };
