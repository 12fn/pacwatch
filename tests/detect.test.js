const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

const ctx = load(['js/geo.js', 'js/detect.js']);
const { GEO, detectLoitering, DETECTORS, runAllDetectors } = ctx;

// --- geo helpers ----------------------------------------------------------

test('haversineNm: one minute of latitude is one nautical mile', () => {
  const d = GEO.haversineNm(21.0, -158.0, 21.0 + 1 / 60, -158.0);
  assert.ok(Math.abs(d - 1.0) < 0.01, `got ${d}`);
});

test('haversineM converts to metres', () => {
  const m = GEO.haversineM(21.0, -158.0, 21.0 + 1 / 60, -158.0);
  assert.ok(Math.abs(m - 1852) < 20, `got ${m}`);
});

test('bearingDeg: due east is 090', () => {
  const b = GEO.bearingDeg(21.0, -158.0, 21.0, -157.9);
  assert.ok(Math.abs(b - 90) < 1, `got ${b}`);
});

test('headingDelta wraps through north', () => {
  assert.strictEqual(GEO.headingDelta(350, 10), 20);
  assert.strictEqual(GEO.headingDelta(10, 350), 20);
  assert.strictEqual(GEO.headingDelta(0, 180), 180);
});

test('pointInPolygon: inside and outside a square', () => {
  const ring = [[-158.5, 21.0], [-158.0, 21.0], [-158.0, 21.5], [-158.5, 21.5], [-158.5, 21.0]];
  assert.strictEqual(GEO.pointInPolygon(21.25, -158.25, ring), true);
  assert.strictEqual(GEO.pointInPolygon(21.25, -157.5, ring), false);
});

test('segmentIntersectsPolygon catches a line crossing with both ends outside', () => {
  const ring = [[-158.5, 21.0], [-158.0, 21.0], [-158.0, 21.5], [-158.5, 21.5], [-158.5, 21.0]];
  assert.strictEqual(GEO.segmentIntersectsPolygon([21.25, -158.9], [21.25, -157.6], ring), true);
  assert.strictEqual(GEO.segmentIntersectsPolygon([20.5, -158.9], [20.5, -157.6], ring), false);
});

// --- loitering ------------------------------------------------------------

function vesselHolding(mmsi, from, to) {
  const track = [];
  for (let t = 0; t <= 120; t++) {
    if (t >= from && t <= to) {
      track.push([t, 21.62 + Math.sin(t) * 0.004, -158.30 + Math.cos(t) * 0.004,
                  1.8, (t * 37) % 360]);
    } else {
      track.push([t, 21.40 + t * 0.004, -158.60 + t * 0.004, 14.0, 45]);
    }
  }
  return { mmsi, name: 'TEST', type: 'cargo', destination: 'HONOLULU',
           length_m: 120, flag: 'US', track };
}

const meta = { step_seconds: 120, steps: 121 };

test('detectLoitering fires on a 50-minute hold', () => {
  const f = detectLoitering({ meta, vessels: [vesselHolding(1, 34, 59)] });
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].detector, 'loitering');
  assert.strictEqual(f[0].mmsi, 1);
  assert.strictEqual(f[0].t_start, 34);
  assert.strictEqual(f[0].t_end, 59);
});

test('detectLoitering does NOT fire on a 20-minute hold', () => {
  const f = detectLoitering({ meta, vessels: [vesselHolding(2, 34, 43)] });
  assert.strictEqual(f.length, 0, 'must not fire under the duration threshold');
});

test('detectLoitering does NOT fire on a slow steady transit', () => {
  // Under the speed threshold the whole time, but going somewhere.
  const track = [];
  for (let t = 0; t <= 120; t++) track.push([t, 21.0 + t * 0.01, -158.0, 2.5, 0]);
  const f = detectLoitering({ meta, vessels: [{ mmsi: 9, name: 'CRAWLER', type: 'tug', track }] });
  assert.strictEqual(f.length, 0, 'a slow passage is not loitering');
});

test('every finding carries evidence, alternatives, and a sane confidence', () => {
  const f = detectLoitering({ meta, vessels: [vesselHolding(3, 34, 59)] })[0];
  assert.ok(f.evidence.length > 0);
  assert.ok(f.alternative_explanations.length > 0,
    'a finding with no innocent explanation violates the core lesson');
  assert.ok(f.confidence > 0 && f.confidence <= 0.9, 'nothing here earns certainty');
});

test('evidence quotes real numbers from the data', () => {
  const f = detectLoitering({ meta, vessels: [vesselHolding(4, 34, 59)] })[0];
  assert.match(f.evidence[0], /1\.8 kts for 52 minutes/);
});

// --- registry -------------------------------------------------------------

test('three of four detectors ship unimplemented', () => {
  assert.strictEqual(DETECTORS.length, 4);
  assert.strictEqual(DETECTORS.filter(d => !d.implemented).length, 3);
});

test('runAllDetectors only runs implemented detectors', () => {
  const found = runAllDetectors({ meta, vessels: [vesselHolding(5, 34, 59)] });
  assert.deepStrictEqual([...new Set(found.map(f => f.detector))], ['loitering']);
});

test('a detector that throws does not take down the others', () => {
  const broken = { id: 'broken', label: 'Broken', implemented: true,
                   fn: () => { throw new Error('boom'); } };
  DETECTORS.push(broken);
  try {
    const found = runAllDetectors({ meta, vessels: [vesselHolding(6, 34, 59)] });
    assert.strictEqual(found.length, 1, 'loitering should still report');
  } finally {
    DETECTORS.pop();
  }
});
