// ==========================================================================
// THE CHART
//
// There are no map tiles in this application. Nothing is downloaded. The
// coastline and the depth contours are drawn from coordinates in data/, which
// is why this works with the network unplugged and why it looks like a chart
// instead of a street map.
//
// Colours come from css/style.css. Change them there, not here.
// ==========================================================================

const MapState = {
  map: null,
  vesselLayer: null,
  trackLayer: null,
  markers: {},        // mmsi -> Leaflet layer
};

// One colour per vessel type. These are read off the stylesheet so that
// changing the palette in one place changes it everywhere.
const TYPE_COLORS = {
  cargo:     '#7fd4c1',
  tanker:    '#d8a33c',
  fishing:   '#8fb8e0',
  tug:       '#b79ce0',
  passenger: '#e0c86a',
  sailing:   '#9fe0a8',
  research:  '#6fb3d0',
  other:     '#8a9bab',
};

// Sea areas worth labelling. Chart labels are letterspaced small caps —
// that is the convention on a real chart, not a decoration.
const SEA_LABELS = [
  { name: 'Kauai Channel',   lat: 21.85, lon: -158.85 },
  { name: 'Kaiwi Channel',   lat: 21.22, lon: -157.55 },
  { name: 'Kaieie Waho',     lat: 21.98, lon: -159.30 },
  { name: 'Penguin Bank',    lat: 21.05, lon: -157.55 },
];

function initMap() {
  const bbox = SCENARIO.meta.bbox;   // [w, s, e, n]

  MapState.map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    zoomSnap: 0.25,
    minZoom: 7,
    maxZoom: 13,
  });

  MapState.map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [12, 12] });

  MapState.map.attributionControl.setPrefix('');
  MapState.map.attributionControl.addAttribution(
    'Coastline: Natural Earth &middot; Depths: GMRT &middot; Tides: NOAA CO-OPS');

  MapState.trackLayer = L.layerGroup().addTo(MapState.map);
  MapState.vesselLayer = L.layerGroup().addTo(MapState.map);

  for (const s of SEA_LABELS) addChartLabel(s.lat, s.lon, s.name, 'chart-label--sea');

  MapState.map.on('click', () => selectVessel(null));
}

// A text-only marker, used for geographic names.
function addChartLabel(lat, lon, text, extraClass) {
  return L.marker([lat, lon], {
    interactive: false,
    icon: L.divIcon({
      className: '',
      html: `<div class="chart-label ${extraClass || ''}">${text}</div>`,
      iconSize: [0, 0],
    }),
  }).addTo(MapState.map);
}

// --------------------------------------------------------------------------
// POSITION AT A GIVEN TIME
//
// This is the one piece of real logic in this file, and your detectors will
// want it.
//
// Tracks are lists of reports, not continuous lines. If a vessel has not
// reported at step t, we show its last known position and mark it STALE.
// That is what a real display does — the contact does not vanish, it goes
// grey and starts aging. A vessel that stays stale for a while is exactly
// what Detector 3 is looking for.
// --------------------------------------------------------------------------
function positionAt(vessel, t) {
  let last = null;
  for (const row of vessel.track) {
    if (row[0] > t) break;
    last = row;
  }
  if (!last) return null;
  return {
    lat: last[1], lon: last[2], sog: last[3], cog: last[4],
    reported_t: last[0],
    stale: last[0] !== t,
    age_steps: t - last[0],
  };
}

// Every report within the last `minutes`, oldest first.
function trackSince(vessel, t, minutes) {
  const stepMin = SCENARIO.meta.step_seconds / 60;
  const from = t - Math.round(minutes / stepMin);
  return vessel.track.filter(r => r[0] >= from && r[0] <= t);
}

// --------------------------------------------------------------------------
// Drawing vessels
// --------------------------------------------------------------------------
function renderVesselsAt(t) {
  if (!MapState.vesselLayer) return;
  MapState.vesselLayer.clearLayers();
  MapState.markers = {};

  const flagged = new Set((App.findings || []).map(f => f.mmsi));

  for (const v of SCENARIO.vessels) {
    const p = positionAt(v, t);
    if (!p) continue;

    const color = TYPE_COLORS[v.type] || TYPE_COLORS.other;
    const selected = App.selectedMmsi === v.mmsi;

    // The hull symbol. Hollow and dashed means we have lost the contact.
    const dot = L.circleMarker([p.lat, p.lon], {
      radius: selected ? 7 : 5,
      color: p.stale ? '#d8a33c' : color,
      weight: p.stale ? 1.5 : 1,
      opacity: 1,
      fillColor: color,
      fillOpacity: p.stale ? 0 : 0.75,
      dashArray: p.stale ? '2,2' : null,
      interactive: true,
    });
    dot.on('click', (e) => { L.DomEvent.stop(e); selectVessel(v.mmsi); });
    dot.addTo(MapState.vesselLayer);
    MapState.markers[v.mmsi] = dot;

    // Heading vector: longer when faster. A stopped vessel has no vector,
    // which is itself readable at a glance.
    if (p.sog > 0.5) {
      const nm = Math.min(2.5, p.sog / 8);
      const rad = p.cog * Math.PI / 180;
      const endLat = p.lat + (nm / 60) * Math.cos(rad);
      const endLon = p.lon + (nm / 60) * Math.sin(rad) / Math.cos(p.lat * Math.PI / 180);
      L.polyline([[p.lat, p.lon], [endLat, endLon]], {
        color, weight: 1, opacity: 0.65, interactive: false,
      }).addTo(MapState.vesselLayer);
    }

    // A flagged contact gets a magenta ring — chart magenta means "caution",
    // never "confirmed".
    if (flagged.has(v.mmsi)) {
      L.circleMarker([p.lat, p.lon], {
        radius: 13, color: '#e8368f', weight: 1.5, fill: false,
        opacity: 0.9, interactive: false,
      }).addTo(MapState.vesselLayer);
    }

    if (selected || flagged.has(v.mmsi)) {
      L.marker([p.lat, p.lon], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div class="vessel-label" style="margin-left:16px;margin-top:-7px">${v.name}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(MapState.vesselLayer);
    }
  }

  drawSelectedTrack(t);
}

// The trailing hour of the selected vessel, drawn as a fading line with a
// visible break wherever it stopped reporting.
function drawSelectedTrack(t) {
  MapState.trackLayer.clearLayers();
  if (!App.selectedMmsi) return;

  const v = SCENARIO.vessels.find(x => x.mmsi === App.selectedMmsi);
  if (!v) return;

  const rows = trackSince(v, t, 60);
  const color = TYPE_COLORS[v.type] || TYPE_COLORS.other;

  // Split into runs of consecutive reports so a gap shows as an actual gap.
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      L.polyline(run.map(r => [r[1], r[2]]), {
        color, weight: 1.5, opacity: 0.55, interactive: false,
      }).addTo(MapState.trackLayer);
    }
    run = [];
  };
  for (const r of rows) {
    if (run.length && r[0] !== run[run.length - 1][0] + 1) {
      const prev = run[run.length - 1];
      flush();
      // A dashed line across the silence, so the gap reads as a gap and not
      // as a vessel that simply was not there.
      L.polyline([[prev[1], prev[2]], [r[1], r[2]]], {
        color: '#d8a33c', weight: 1, opacity: 0.5,
        dashArray: '4,6', interactive: false,
      }).addTo(MapState.trackLayer);
    }
    run.push(r);
  }
  flush();
}

function selectVessel(mmsi) {
  App.selectedMmsi = (mmsi === App.selectedMmsi) ? null : mmsi;
  renderVesselsAt(App.t);
  renderVesselDetail();
}

function renderVesselDetail() {
  const el = document.getElementById('vessel-panel');
  if (!el) return;

  if (!App.selectedMmsi) { el.hidden = true; el.innerHTML = ''; return; }

  const v = SCENARIO.vessels.find(x => x.mmsi === App.selectedMmsi);
  const p = positionAt(v, App.t);
  if (!v || !p) { el.hidden = true; return; }

  const stepMin = SCENARIO.meta.step_seconds / 60;
  const rows = [
    ['Speed', `${p.sog.toFixed(1)} kts`],
    ['Course', `${String(p.cog).padStart(3, '0')}&deg;`],
    ['Position', `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`],
    ['Type', v.type],
    ['Flag', v.flag],
    ['Length', `${v.length_m} m`],
    ['Destination', v.destination || '—'],
    ['Status', p.stale ? `No report (${Math.round(p.age_steps * stepMin)} min)` : 'Reporting'],
  ];

  el.hidden = false;
  el.innerHTML = `
    <button class="detail__close" aria-label="Close">&times;</button>
    <h3 class="detail__name">${v.name}</h3>
    <p class="detail__sub">MMSI ${v.mmsi} &middot; ${v.callsign || ''}</p>
    <dl class="detail__grid">
      ${rows.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('')}
    </dl>
    ${v.amendments ? `<div class="detail__flag">Broadcast details changed mid-replay:
      ${v.amendments.map(a => `${a.field} ${a.from} &rarr; ${a.to}`).join('; ')}</div>` : ''}
  `;
  el.querySelector('.detail__close').addEventListener('click', () => selectVessel(null));
}

// The legend is generated from the types actually present, so it never lies
// about what is on the chart.
function renderLegend() {
  const el = document.getElementById('chart-legend');
  if (!el) return;
  const present = [...new Set(SCENARIO.vessels.map(v => v.type))].sort();
  el.innerHTML = present.map(t => `
    <span class="legend__item">
      <span class="legend__dot" style="background:${TYPE_COLORS[t] || TYPE_COLORS.other}"></span>${t}
    </span>`).join('') + `
    <span class="legend__item">
      <span class="legend__dot" style="border:1px dashed #d8a33c"></span>no report
    </span>
    <span class="legend__item">
      <span class="legend__dot" style="border:1px solid #e8368f"></span>flagged
    </span>`;
}
