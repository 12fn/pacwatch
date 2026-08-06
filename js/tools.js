// ==========================================================================
// TOOLS
//
// This is what makes the assistant useful instead of confidently wrong.
//
// The model cannot see the vessel data. Not one row of it. What it gets is
// the list of questions it is allowed to ask — the schemas below — and the
// answers we return. If it wants to know how many fishing vessels are out, it
// has to call list_vessels and read the reply, the same as you would.
//
// That is the whole trick. A model with tools looks things up. A model without
// them guesses, and a guess about a vessel's position is worse than no answer.
//
// Notice that every tool returns a SUMMARY. list_vessels never sends full
// tracks. Dumping the database into the prompt would be slower, cost more, and
// make the answers worse — the model would have to find the needle itself
// instead of asking us to.
//
// ADDING A TOOL IS LEVEL 2. Copy an entry, change the schema, write the
// function. The assistant can use it immediately — no retraining, no config.
// ==========================================================================

// How far is this position from the nearest land? Used to keep harbour
// activity from looking like something happening out at sea.
function distanceFromLandNm(lat, lon) {
  let best = 999;
  for (const f of (GEO_COAST.features || [])) {
    const polys = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const pt of poly[0]) {
        const d = GEO.haversineNm(lat, lon, pt[1], pt[0]);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

function vesselByMmsi(mmsi) {
  return SCENARIO.vessels.find(v => String(v.mmsi) === String(mmsi));
}

// How many times did this vessel stop reporting across the whole replay?
// Gaps are missing rows, so this is just counting non-consecutive t values.
function gapCount(v) {
  let gaps = 0;
  for (let i = 1; i < v.track.length; i++) {
    if (v.track[i][0] !== v.track[i - 1][0] + 1) gaps++;
  }
  return gaps;
}

// A compact one-line summary of a vessel at the current replay time.
//
// `reporting` is about NOW. `gaps_in_replay` is about the whole four hours.
// Keeping both matters: a vessel that went dark at 0620 and came back is
// reporting normally by 0800, and without the second field the honest answer
// to "who stopped reporting?" would be a false "nobody".
function summarise(v, t) {
  const p = positionAt(v, t);
  return {
    mmsi: v.mmsi,
    name: v.name,
    type: v.type,
    flag: v.flag,
    destination: v.destination,
    lat: p ? p.lat : null,
    lon: p ? p.lon : null,
    sog: p ? p.sog : null,
    cog: p ? p.cog : null,
    reporting: p ? !p.stale : false,
    gaps_in_replay: gapCount(v),
  };
}

const TOOLS = [

  {
    schema: {
      name: 'list_vessels',
      description: 'List vessels on the display with optional filters. Each row ' +
                   'gives the vessel\'s state at the current replay time, plus ' +
                   'gaps_in_replay: how many times it stopped reporting at any ' +
                   'point during the whole four hours. Use had_gaps to find ' +
                   'vessels that went dark earlier but are reporting again now. ' +
                   'Returns summary rows only — call get_vessel_track for positions.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'cargo, tanker, fishing, tug, passenger, sailing, research, other' },
          min_sog: { type: 'number', description: 'minimum speed over ground in knots' },
          max_sog: { type: 'number', description: 'maximum speed over ground in knots' },
          flag: { type: 'string', description: 'two-letter flag state, e.g. US' },
          not_reporting: { type: 'boolean', description: 'only vessels with no position report right now' },
          had_gaps: { type: 'boolean', description: 'only vessels that stopped reporting at some point during the replay, whether or not they are reporting now' },
        },
      },
    },
    fn: (a = {}) => {
      let rows = SCENARIO.vessels.map(v => summarise(v, App.t));
      if (a.type) rows = rows.filter(r => r.type === a.type);
      if (a.flag) rows = rows.filter(r => r.flag === a.flag);
      if (a.min_sog != null) rows = rows.filter(r => r.sog != null && r.sog >= a.min_sog);
      if (a.max_sog != null) rows = rows.filter(r => r.sog != null && r.sog <= a.max_sog);
      if (a.not_reporting) rows = rows.filter(r => !r.reporting);
      if (a.had_gaps) rows = rows.filter(r => r.gaps_in_replay > 0);
      return { count: rows.length, at_time: formatClock(App.t), vessels: rows };
    },
  },

  {
    schema: {
      name: 'get_vessel_track',
      description: 'Position history for one vessel over the last N minutes. ' +
                   'Also reports any gaps where the vessel stopped transmitting.',
      parameters: {
        type: 'object',
        properties: {
          mmsi: { type: 'number', description: 'the vessel MMSI' },
          minutes: { type: 'number', description: 'how far back to look, default 60' },
        },
        required: ['mmsi'],
      },
    },
    fn: (a) => {
      const v = vesselByMmsi(a.mmsi);
      if (!v) return { error: `no vessel with MMSI ${a.mmsi}` };
      const rows = trackSince(v, App.t, a.minutes || 60);

      const gaps = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] !== rows[i - 1][0] + 1) {
          gaps.push({
            from_t: rows[i - 1][0], to_t: rows[i][0],
            minutes: (rows[i][0] - rows[i - 1][0]) * SCENARIO.meta.step_seconds / 60,
          });
        }
      }
      return {
        mmsi: v.mmsi, name: v.name, type: v.type,
        columns: ['t', 'lat', 'lon', 'sog_kts', 'cog_deg'],
        rows, gaps,
      };
    },
  },

  {
    schema: {
      name: 'find_nearby',
      description: 'Find other vessels that came close to a given vessel, with the ' +
                   'closest separation reached and when.',
      parameters: {
        type: 'object',
        properties: {
          mmsi: { type: 'number' },
          radius_m: { type: 'number', description: 'search radius in metres, default 1000' },
          minutes: { type: 'number', description: 'how far back to look, default 60' },
        },
        required: ['mmsi'],
      },
    },
    fn: (a) => {
      const v = vesselByMmsi(a.mmsi);
      if (!v) return { error: `no vessel with MMSI ${a.mmsi}` };
      const radius = a.radius_m || 1000;
      const rows = trackSince(v, App.t, a.minutes || 60);

      const contacts = [];
      for (const other of SCENARIO.vessels) {
        if (other.mmsi === v.mmsi) continue;
        let best = null;
        for (const row of rows) {
          const p = positionAt(other, row[0]);
          if (!p || p.stale) continue;
          const sep = GEO.haversineM(row[1], row[2], p.lat, p.lon);
          if (sep <= radius && (!best || sep < best.min_sep_m)) {
            best = {
              mmsi: other.mmsi, name: other.name, type: other.type,
              min_sep_m: Math.round(sep), at_t: row[0], at_time: formatClock(row[0]),
              their_sog: p.sog, our_sog: row[3],
            };
          }
        }
        if (best) contacts.push(best);
      }
      contacts.sort((x, y) => x.min_sep_m - y.min_sep_m);
      return { mmsi: v.mmsi, name: v.name, radius_m: radius, contacts };
    },
  },

  {
    schema: {
      name: 'check_zone',
      description: 'Check whether a vessel has entered any exercise or restricted area, ' +
                   'including crossings inferred across a reporting gap.',
      parameters: {
        type: 'object',
        properties: { mmsi: { type: 'number' } },
        required: ['mmsi'],
      },
    },
    fn: (a) => {
      const v = vesselByMmsi(a.mmsi);
      if (!v) return { error: `no vessel with MMSI ${a.mmsi}` };

      const zones = GEO.polygonRings(GEO_ZONES).filter(z => z.props.kind !== 'eez');
      const hits = [];

      for (const z of zones) {
        const inside = [];
        let crossedDuringGap = false;

        for (let i = 0; i < v.track.length; i++) {
          const r = v.track[i];
          if (GEO.pointInPolygon(r[1], r[2], z.ring)) inside.push(r[0]);
          if (i > 0) {
            const prev = v.track[i - 1];
            if (r[0] !== prev[0] + 1 &&
                GEO.segmentIntersectsPolygon([prev[1], prev[2]], [r[1], r[2]], z.ring)) {
              crossedDuringGap = true;
            }
          }
        }
        if (inside.length || crossedDuringGap) {
          hits.push({
            zone: z.props.name,
            kind: z.props.kind,
            fictional: !!z.props.synthetic,
            reported_inside_from_t: inside.length ? inside[0] : null,
            reported_inside_to_t: inside.length ? inside[inside.length - 1] : null,
            entered_during_reporting_gap: crossedDuringGap,
          });
        }
      }
      return { mmsi: v.mmsi, name: v.name, intersections: hits };
    },
  },

  {
    schema: {
      name: 'run_detectors',
      description: 'Run the implemented anomaly detectors and return their findings, ' +
                   'each with supporting evidence and the innocent explanations for the ' +
                   'same behaviour.',
      parameters: {
        type: 'object',
        properties: {
          mmsi: { type: 'number', description: 'optional: only findings for this vessel' },
        },
      },
    },
    fn: (a = {}) => {
      let findings = runAllDetectors(SCENARIO);
      if (a.mmsi) findings = findings.filter(f => String(f.mmsi) === String(a.mmsi));
      const named = findings.map(f => {
        const v = vesselByMmsi(f.mmsi);
        return Object.assign({}, f, {
          vessel_name: v ? v.name : null,
          from_time: formatClock(f.t_start),
          to_time: formatClock(f.t_end),
        });
      });
      return {
        implemented: DETECTORS.filter(d => d.implemented).map(d => d.id),
        not_implemented: DETECTORS.filter(d => !d.implemented).map(d => d.id),
        findings: named,
      };
    },
  },

];

// The schemas in the shape the chat API wants them.
function toolSchemas() {
  return TOOLS.map(t => ({ type: 'function', function: t.schema }));
}

function callTool(name, args) {
  const tool = TOOLS.find(t => t.schema.name === name);
  if (!tool) throw new Error('unknown tool: ' + name);
  return tool.fn(args || {});
}
