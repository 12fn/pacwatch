// ==========================================================================
// DETECTORS
//
// Four rules. One is written. Three are yours.
//
// A detector is an ordinary function. It takes the scenario, looks at vessel
// tracks, and returns a list of Findings. There is no machine learning here
// and there does not need to be — these are rules you can read, argue with,
// and tune. That is a feature. When someone asks "why did it flag that?" you
// can answer with a number instead of a shrug.
//
// EVERY FINDING MUST CARRY alternative_explanations. Not as a formality —
// because a vessel sitting still is far more often broken than sinister, and
// a display that forgets to say so will get someone in trouble one day.
//
// A Finding looks like this:
//
//   {
//     detector: "loitering",
//     mmsi: 366123456,
//     t_start: 34,
//     t_end: 59,
//     confidence: 0.72,
//     evidence: ["Held 1.1-2.8 kts for 50 minutes.", ...],
//     alternative_explanations: ["Mechanical trouble.", ...]
//   }
//
// ==========================================================================

// --------------------------------------------------------------------------
// DETECTOR 1 OF 4 — LOITERING   (this one is written; read it first)
//
// What we are looking for: a vessel that stops going anywhere. It slows to
// almost nothing and stays inside a small circle for a long time, in open
// water, while still claiming to be on its way somewhere.
//
// The rule, in plain English:
//   - speed stays under MAX_SOG_KTS
//   - for at least MIN_STEPS consecutive reports
//   - and every position in that run is within MAX_RADIUS_NM of their average
//     position (so a slow, steady transit does not count — only sitting)
// --------------------------------------------------------------------------

const LOITER = {
  MAX_SOG_KTS: 3.0,      // "barely moving"
  MIN_STEPS: 15,         // 15 reports x 2 minutes = 30 minutes
  MAX_RADIUS_NM: 2.0,    // stayed inside this circle
};

function detectLoitering(scenario) {
  const findings = [];
  const stepMin = (scenario.meta ? scenario.meta.step_seconds : 120) / 60;

  for (const vessel of scenario.vessels) {
    // Walk the track collecting unbroken runs of slow reports.
    let run = [];

    const closeRun = () => {
      if (run.length >= LOITER.MIN_STEPS) {
        const f = assessLoiterRun(vessel, run, stepMin);
        if (f) findings.push(f);
      }
      run = [];
    };

    for (const row of vessel.track) {
      const slow = row[3] < LOITER.MAX_SOG_KTS;
      const contiguous = run.length === 0 || row[0] === run[run.length - 1][0] + 1;
      if (slow && contiguous) {
        run.push(row);
      } else {
        closeRun();
        if (slow) run.push(row);
      }
    }
    closeRun();
  }
  return findings;
}

// Given a run of slow reports, decide whether it is actually loitering
// (staying put) rather than just a slow passage, and build the Finding.
function assessLoiterRun(vessel, run, stepMin) {
  const meanLat = run.reduce((s, r) => s + r[1], 0) / run.length;
  const meanLon = run.reduce((s, r) => s + r[2], 0) / run.length;

  let maxNm = 0;
  for (const r of run) {
    maxNm = Math.max(maxNm, GEO.haversineNm(meanLat, meanLon, r[1], r[2]));
  }
  if (maxNm > LOITER.MAX_RADIUS_NM) return null;   // moving through, not sitting

  const minutes = Math.round((run[run.length - 1][0] - run[0][0] + 1) * stepMin);
  const speeds = run.map(r => r[3]);
  const lo = Math.min(...speeds).toFixed(1);
  const hi = Math.max(...speeds).toFixed(1);

  const evidence = [
    `Speed held between ${lo} and ${hi} kts for ${minutes} minutes.`,
    `All ${run.length} positions within ${maxNm.toFixed(2)} nm of one point.`,
    `Course wandered rather than held, consistent with station-keeping.`,
  ];

  // If we know where the ports are, note how far away the stated destination is.
  if (vessel.destination && typeof GEO_ASSETS !== 'undefined') {
    const dest = (GEO_ASSETS.features || []).find(f =>
      (f.properties.name || '').toUpperCase().includes(vessel.destination.toUpperCase()));
    if (dest) {
      const c = dest.geometry.coordinates;
      const nm = GEO.haversineNm(meanLat, meanLon, c[1], c[0]);
      evidence.push(
        `Broadcast destination ${vessel.destination} is ${nm.toFixed(1)} nm away ` +
        `and the vessel is not closing on it.`);
    }
  }

  // Longer and tighter means more confident — but never certain. Nothing on
  // this display earns a 1.0.
  const durFactor = Math.min(1, run.length / (LOITER.MIN_STEPS * 2.5));
  const tightFactor = Math.min(1, (LOITER.MAX_RADIUS_NM - maxNm) / LOITER.MAX_RADIUS_NM);
  const confidence = Math.min(0.9, Number((0.45 + 0.30 * durFactor + 0.15 * tightFactor).toFixed(2)));

  return {
    detector: 'loitering',
    mmsi: vessel.mmsi,
    t_start: run[0][0],
    t_end: run[run.length - 1][0],
    confidence,
    evidence,
    alternative_explanations: [
      'Mechanical trouble — a vessel that cannot make way holds position.',
      'Waiting for a pilot, a berth, or a tide window before entering port.',
      'Legitimate fishing, survey, or diving activity.',
      'Recovering a person or object from the water.',
    ],
  };
}

// --------------------------------------------------------------------------
// DETECTOR 2 OF 4 — RENDEZVOUS   (not implemented — this one is yours)
//
// What you are looking for: two vessels that meet up at sea. They approach
// each other, both slow down at the same time, sit together for a while, then
// leave in different directions. On a chart it looks like two tracks touching.
//
// A rule that works:
//   - the two vessels come within MAX_SEP_M of each other
//   - BOTH are under MAX_SOG_KTS at the same time step
//   - that holds for at least MIN_STEPS steps in a row
//   - and it happens more than MIN_OFFSHORE_NM from land, otherwise you will
//     flag every pair of boats tied up in a harbour
//
// Return one Finding for EACH vessel involved, so both light up on the chart.
// Use GEO.haversineM() for separation. positionAt() in js/map.js gives you a
// vessel's position at a given step.
//
// COPY THIS TO OPENCODE:
//
//   Implement detectRendezvous in js/detect.js following the comment block
//   above it. Use GEO.haversineM for separation and return one Finding per
//   vessel involved, matching the shape returned by detectLoitering including
//   alternative_explanations. Then add tests in tests/detect.test.js proving
//   it fires on a real rendezvous and does NOT fire on two vessels that merely
//   pass close to each other at speed.
// --------------------------------------------------------------------------

const RENDEZVOUS = {
  MAX_SEP_M: 300,
  MAX_SOG_KTS: 2.0,
  MIN_STEPS: 5,             // 5 x 2 minutes = 10 minutes together
  MIN_OFFSHORE_NM: 3.0,
};

function detectRendezvous(scenario) {
  return [];   // <-- replace this
}

// --------------------------------------------------------------------------
// DETECTOR 3 OF 4 — REPORTING GAP IN A ZONE   (not implemented — yours)
//
// What you are looking for: a vessel that stops reporting, and where it was
// when it went quiet matters.
//
// Vessels drop off AIS all the time — bad antenna, bad power, bad weather.
// A gap on its own is noise. A gap becomes interesting when:
//   - it lasts at least MIN_GAP_STEPS steps
//   - AND the straight line between the last report and the next one crosses
//     a zone (use GEO.segmentIntersectsPolygon and GEO.polygonRings(GEO_ZONES))
//   - AND covering that distance in that time would need a speed the vessel
//     cannot actually do (compare against TYPE_MAX_KTS below)
//
// That third test is the good one. It is the difference between "we lost them
// for a bit" and "the track we are being shown is not physically possible."
//
// REMEMBER: gaps are represented as MISSING ROWS in the track array. There is
// no null and no flag. Compare each row's t to the previous row's t.
//
// COPY THIS TO OPENCODE:
//
//   Implement detectGap in js/detect.js following the comment block above it.
//   Find gaps in each vessel's track by comparing consecutive t values, check
//   whether the straight line across the gap intersects a zone in GEO_ZONES,
//   and compute the speed the crossing would have required. Return Findings
//   matching the shape from detectLoitering. Add tests in tests/detect.test.js.
// --------------------------------------------------------------------------

const GAP = {
  MIN_GAP_STEPS: 5,         // 10 minutes of silence
  SPEED_TOLERANCE: 1.3,     // 30% over the vessel's plausible max is suspicious
};

// Roughly the fastest each kind of vessel actually goes, in knots.
const TYPE_MAX_KTS = {
  cargo: 22, tanker: 16, fishing: 12, tug: 13,
  passenger: 30, sailing: 12, research: 14, other: 25,
};

function detectGap(scenario) {
  return [];   // <-- replace this
}

// --------------------------------------------------------------------------
// DETECTOR 4 OF 4 — IDENTITY INCONSISTENCY   (not implemented — yours)
//
// What you are looking for: a vessel whose paperwork does not match its
// physics.
//
// Everything a vessel broadcasts about itself — name, type, size, flag,
// destination — is typed in by a human and is never verified by anything.
// The positions and speeds, on the other hand, are measured. When the two
// disagree, believe the physics.
//
// Things worth checking:
//   - speed higher than a hull that size could ever make (TYPE_ENVELOPE)
//   - a turn too sharp for a ship that long — a 180 m vessel cannot swing 90
//     degrees in two minutes (use GEO.headingDelta on consecutive cog values)
//   - MMSI country prefix disagreeing with the declared flag (MMSI_MID below)
//   - static data that CHANGED during the replay: any vessel that altered its
//     broadcast details mid-scenario has an `amendments` array. Ordinary
//     vessels do not have that field at all.
//
// COPY THIS TO OPENCODE:
//
//   Implement detectIdentity in js/detect.js following the comment block above
//   it. Check speed and turn rate against TYPE_ENVELOPE, compare the MMSI
//   prefix against the declared flag using MMSI_MID, and flag any vessel with
//   an amendments array. Return Findings matching the shape from
//   detectLoitering, with one evidence line per check that failed. Add tests
//   in tests/detect.test.js.
// --------------------------------------------------------------------------

// Plausible limits by type: [max length m, max speed kts, max degrees of turn
// per 2-minute step for a vessel of that size].
const TYPE_ENVELOPE = {
  cargo:     { max_kts: 22, turn_per_step: 25 },
  tanker:    { max_kts: 16, turn_per_step: 20 },
  fishing:   { max_kts: 12, turn_per_step: 70 },
  tug:       { max_kts: 13, turn_per_step: 50 },
  passenger: { max_kts: 30, turn_per_step: 45 },
  sailing:   { max_kts: 12, turn_per_step: 60 },
  research:  { max_kts: 14, turn_per_step: 40 },
  other:     { max_kts: 25, turn_per_step: 60 },
};

// The first three digits of an MMSI are the Maritime Identification Digits —
// the country that issued it. A Panama-flagged ship with a Hong Kong MMSI is
// not automatically sinister, but it is worth a second look.
const MMSI_MID = {
  '366': 'US', '367': 'US', '368': 'US', '369': 'US',
  '477': 'HK', '412': 'CN', '413': 'CN',
  '351': 'PA', '352': 'PA', '353': 'PA', '354': 'PA', '370': 'PA',
  '431': 'JP', '432': 'JP', '440': 'KR', '441': 'KR',
  '538': 'MH', '563': 'SG', '564': 'SG', '565': 'SG',
};

function detectIdentity(scenario) {
  return [];   // <-- replace this
}

// ==========================================================================
// THE REGISTRY
//
// Flip `implemented` to true when you have written one. The counter in the
// top bar reads straight off this list.
// ==========================================================================

const DETECTORS = [
  { id: 'loitering',  label: 'Loitering',        fn: detectLoitering,  implemented: true  },
  { id: 'rendezvous', label: 'Rendezvous',       fn: detectRendezvous, implemented: false },
  { id: 'gap',        label: 'Gap in zone',      fn: detectGap,        implemented: false },
  { id: 'identity',   label: 'Identity',        fn: detectIdentity,   implemented: false },
];

function runAllDetectors(scenario) {
  const out = [];
  for (const d of DETECTORS) {
    if (!d.implemented) continue;
    let found = [];
    try {
      found = d.fn(scenario) || [];
    } catch (err) {
      // A broken detector must not take the whole display down with it.
      console.error(`detector "${d.id}" threw:`, err);
      continue;
    }
    for (const f of found) out.push(f);
  }
  return out;
}
