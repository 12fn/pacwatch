const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

// layers.js only *references* Leaflet and the data globals inside build()
// callbacks, so the registry itself can be inspected without either.
const ctx = load(['js/layers.js'], { window: { addEventListener() {} } });
const { LAYERS } = ctx;

test('fifteen layers are registered', () => {
  assert.strictEqual(LAYERS.length, 15);
});

test('exactly coast and vessels ship enabled', () => {
  // Note: values come back from the VM realm, so compare as a string rather
  // than with deepStrictEqual, which also checks the Array prototype.
  const on = LAYERS.filter(l => l.enabled).map(l => l.id).sort().join(',');
  assert.strictEqual(on, 'coast,vessels',
    'the barebones default is what makes turning a layer on feel like something');
});

test('every layer has an id, a label, and a build function', () => {
  for (const l of LAYERS) {
    assert.ok(l.id && typeof l.id === 'string', `bad id: ${JSON.stringify(l)}`);
    assert.ok(l.label && typeof l.label === 'string', `bad label on ${l.id}`);
    assert.strictEqual(typeof l.build, 'function', `bad build on ${l.id}`);
    assert.strictEqual(typeof l.enabled, 'boolean', `bad enabled on ${l.id}`);
  }
});

test('layer ids are unique', () => {
  const ids = LAYERS.map(l => l.id);
  assert.strictEqual(ids.length, new Set(ids).size);
});

test('labels are human sentences, not identifiers', () => {
  for (const l of LAYERS) {
    assert.ok(!/_/.test(l.label), `${l.id} label looks like code: ${l.label}`);
    assert.match(l.label, /^[A-Z]/, `${l.id} label should start capitalised`);
  }
});
