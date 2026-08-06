const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('config.example.js exports a CONFIG with required keys', () => {
  const CONFIG = require('../config.example.js');
  for (const k of ['endpoint', 'model', 'apiKey', 'systemPrompt', 'maxToolIterations']) {
    assert.ok(k in CONFIG, `missing key: ${k}`);
  }
  assert.strictEqual(CONFIG.apiKey, '', 'committed example config must have an empty key');
});

test('system prompt forbids asserting intent', () => {
  const CONFIG = require('../config.example.js');
  assert.match(CONFIG.systemPrompt, /never assert INTENT/i);
});

test('config.js is gitignored so no live key can be committed', () => {
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.ok(ignore.split('\n').includes('config.js'), 'config.js must be gitignored');
});

test('instructor material is gitignored', () => {
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.ok(ignore.includes('instructor/'), 'instructor/ must be gitignored');
});
