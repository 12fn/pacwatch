const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

// Load the real app files against the real generated data, in the same order
// index.html does. `App` normally comes from app.js, which also touches the
// DOM, so we seed it here instead.
const ctx = load([
  'data/scenario.js',
  'data/geo-coast.js',
  'data/geo-zones.js',
  'data/geo-assets.js',
  'js/geo.js',
  'js/detect.js',
  'js/map.js',
  'js/replay.js',
  'js/tools.js',
], {
  App: { findings: [], selectedMmsi: null, t: 60 },
  window: { addEventListener() {}, dispatchEvent() {} },
  document: { getElementById: () => null },
});

const { TOOLS, callTool, toolSchemas, SCENARIO } = ctx;

test('five tools ship', () => {
  assert.strictEqual(TOOLS.length, 5);
});

test('every schema is a valid function-calling shape', () => {
  for (const s of toolSchemas()) {
    assert.strictEqual(s.type, 'function');
    assert.ok(s.function.name, 'tool needs a name');
    assert.ok(s.function.description && s.function.description.length > 20,
      `${s.function.name} needs a description the model can act on`);
    assert.strictEqual(s.function.parameters.type, 'object');
  }
});

test('list_vessels returns every vessel with no filter', () => {
  const r = callTool('list_vessels', {});
  assert.strictEqual(r.count, SCENARIO.vessels.length);
});

test('list_vessels filters by type', () => {
  const r = callTool('list_vessels', { type: 'fishing' });
  assert.ok(r.vessels.length > 0, 'the scenario should contain fishing vessels');
  assert.ok(r.vessels.every(v => v.type === 'fishing'));
});

test('list_vessels filters by speed', () => {
  const r = callTool('list_vessels', { max_sog: 3 });
  assert.ok(r.vessels.every(v => v.sog === null || v.sog <= 3));
});

test('list_vessels never dumps full tracks into the prompt', () => {
  const blob = JSON.stringify(callTool('list_vessels', {}));
  assert.ok(!blob.includes('"track"'), 'summary rows only');
  assert.ok(blob.length < 8000, `result is ${blob.length} bytes; too big for a prompt`);
});

test('get_vessel_track returns rows and reports gaps', () => {
  const mmsi = SCENARIO.vessels[0].mmsi;
  const r = callTool('get_vessel_track', { mmsi, minutes: 30 });
  assert.ok(r.rows.length > 0);
  assert.ok(Array.isArray(r.gaps));
  assert.strictEqual(r.columns.length, 5);
});

test('get_vessel_track reports a clear error for an unknown vessel', () => {
  const r = callTool('get_vessel_track', { mmsi: 1 });
  assert.match(r.error, /no vessel/);
});

test('find_nearby returns contacts sorted by closest approach', () => {
  const mmsi = SCENARIO.vessels[0].mmsi;
  const r = callTool('find_nearby', { mmsi, radius_m: 50000, minutes: 60 });
  const seps = r.contacts.map(c => c.min_sep_m);
  assert.deepStrictEqual([...seps], [...seps].sort((a, b) => a - b));
});

test('check_zone reports which zones a vessel touched', () => {
  const mmsi = SCENARIO.vessels[0].mmsi;
  const r = callTool('check_zone', { mmsi });
  assert.ok(Array.isArray(r.intersections));
});

test('run_detectors says what is implemented and what is not', () => {
  const r = callTool('run_detectors', {});
  assert.ok(r.implemented.includes('loitering'));
  assert.strictEqual(r.not_implemented.length, 3);
});

test('every finding the assistant can see carries its innocent explanations', () => {
  const r = callTool('run_detectors', {});
  for (const f of r.findings) {
    assert.ok(f.alternative_explanations.length > 0,
      'the model must never receive a finding without the other side of it');
    assert.ok(f.evidence.length > 0);
  }
});

test('unknown tool throws rather than returning nonsense', () => {
  assert.throws(() => callTool('nope', {}), /unknown tool/);
});

test('had_gaps finds vessels that went dark earlier but report now', () => {
  // The failure this guards against: at the end of the replay the gap vessel
  // is transmitting again, so a "not reporting right now" filter returns
  // nothing and the honest answer to "who stopped reporting?" becomes a
  // confident, wrong "nobody".
  const all = callTool('list_vessels', {});
  assert.ok(all.vessels.every(v => typeof v.gaps_in_replay === 'number'),
    'every summary row must carry gaps_in_replay');

  const gapped = callTool('list_vessels', { had_gaps: true });
  assert.ok(gapped.count > 0, 'the scenario contains at least one gap');
  assert.ok(gapped.vessels.every(v => v.gaps_in_replay > 0));

  // And it is findable at the end of the replay, when it is reporting again.
  const names = gapped.vessels.map(v => v.name);
  assert.ok(names.includes('MV KOA SPIRIT'), `expected the gap vessel, got ${names}`);
});
