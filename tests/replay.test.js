const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

// 1754402400 is chosen so that with tz_offset_hours -10 (Hawaii, no DST)
// step 0 lands exactly on 04:00 local.
const meta = {
  start_epoch: 1754402400,
  step_seconds: 120,
  steps: 121,
  tz_offset_hours: -10,
};

const ctx = load(['js/replay.js'], { window: { addEventListener() {} } });
const { formatClock, clampT } = ctx;

test('formatClock renders local time at step 0', () => {
  assert.strictEqual(formatClock(0, meta), '04:00');
});

test('formatClock advances two minutes per step', () => {
  assert.strictEqual(formatClock(1, meta), '04:02');
  assert.strictEqual(formatClock(30, meta), '05:00');
  assert.strictEqual(formatClock(120, meta), '08:00');
});

test('clampT keeps t inside the scenario', () => {
  assert.strictEqual(clampT(-5, meta), 0);
  assert.strictEqual(clampT(999, meta), 120);
  assert.strictEqual(clampT(60, meta), 60);
});

test('clampT rounds fractional scrubbing', () => {
  assert.strictEqual(clampT(60.4, meta), 60);
  assert.strictEqual(clampT(60.6, meta), 61);
});
