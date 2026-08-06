// ==========================================================================
// THE LAYER MENU
//
// Every entry below is a layer PACWATCH already knows how to draw.
// Two are switched on. Thirteen are switched off.
//
// To turn one on: change `enabled: false` to `enabled: true`, save the file,
// and refresh the browser. That is the whole operation.
//
// Start with `bathy`. Then `zones`. Then `assets`. Then see how much you can
// turn on before the display stops being useful — knowing when to stop adding
// is the actual skill, and nobody can teach it to you in a slide.
// ==========================================================================

const LAYERS = [

  // --- on by default ------------------------------------------------------

  {
    id: 'coast',
    label: 'Coastline & land',
    enabled: true,
    build: () => L.geoJSON(GEO_COAST, {
      style: { color: '#7a6743', weight: 1, fillColor: '#2b2519', fillOpacity: 1 },
      interactive: false,
      onEachFeature: (f, layer) => {
        if (f.properties && f.properties.name) {
          const c = layer.getBounds().getCenter();
          addChartLabel(c.lat, c.lng, f.properties.name);
        }
      },
    }),
  },

  {
    id: 'vessels',
    label: 'Vessel traffic',
    enabled: true,
    // Vessels are drawn by the replay clock rather than as a static layer,
    // so this entry just reports whether they should be visible at all.
    build: () => L.layerGroup(),
  },

  // --- switched off -------------------------------------------------------

  {
    id: 'bathy',
    label: 'Depth contours',
    enabled: false,
    build: () => L.geoJSON(GEO_BATHY, {
      style: (f) => ({
        color: '#2c5170',
        weight: f.properties.depth_m === 200 ? 0.9 : 0.6,
        opacity: f.properties.depth_m === 200 ? 0.85 : 0.5,
      }),
      interactive: false,
    }),
  },

  {
    id: 'zones',
    label: 'Exercise & restricted areas',
    enabled: false,
    build: () => L.geoJSON(GEO_ZONES, {
      style: { color: '#e8368f', weight: 1, dashArray: '5,4',
               fillColor: '#e8368f', fillOpacity: 0.06 },
      onEachFeature: (f, layer) => {
        const c = layer.getBounds().getCenter();
        addChartLabel(c.lat, c.lng, f.properties.name, 'chart-label--zone');
        layer.bindTooltip(
          `${f.properties.name}${f.properties.synthetic ? ' (fictional)' : ''}`);
      },
    }),
  },

  {
    id: 'assets',
    label: 'Ports & installations',
    enabled: false,
    build: () => L.geoJSON(GEO_ASSETS, {
      pointToLayer: (f, latlng) => {
        const isPort = f.properties.kind === 'port';
        return L.circleMarker(latlng, {
          radius: 3.5,
          color: isPort ? '#7fd4c1' : '#d8a33c',
          weight: 1.2,
          fillOpacity: 0.6,
        });
      },
      onEachFeature: (f, layer) => {
        layer.bindTooltip(f.properties.name);
        const c = f.geometry.coordinates;
        addChartLabel(c[1], c[0], f.properties.name);
      },
    }),
  },

  {
    id: 'cables',
    label: 'Submarine cables',
    enabled: false,
    build: () => L.geoJSON(GEO_CABLES, {
      style: { color: '#5a4a6e', weight: 1, dashArray: '1,3', opacity: 0.8 },
      onEachFeature: (f, layer) => layer.bindTooltip(f.properties.name),
    }),
  },

  {
    id: 'lanes',
    label: 'Shipping lanes',
    enabled: false,
    build: () => L.geoJSON(GEO_LANES, {
      style: { color: '#33556e', weight: 6, opacity: 0.18 },
      interactive: false,
    }),
  },

  {
    id: 'eez',
    label: 'EEZ reference line',
    enabled: false,
    build: () => L.geoJSON(GEO_ZONES, {
      filter: (f) => f.properties.kind === 'eez',
      style: { color: '#8d2456', weight: 1.5, dashArray: '10,6', fill: false },
      interactive: false,
    }),
  },

  {
    id: 'buoys',
    label: 'NDBC buoys',
    enabled: false,
    build: () => L.geoJSON(ENV_BUOYS, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 4, color: '#e0c86a', weight: 1.2, fillOpacity: 0.25,
      }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindTooltip(
          `${p.station} ${p.name || ''}<br>${p.wave_height_m} m seas, ${p.wind_kts} kts`);
      },
    }),
  },

  {
    id: 'wind',
    label: 'Wind field',
    enabled: false,
    build: () => buildWindLayer(),
  },

  {
    id: 'seastate',
    label: 'Sea state',
    enabled: false,
    build: () => buildGridLayer('sea_state', '#3d6a8a', 0.4, 3.5),
  },

  {
    id: 'visibility',
    label: 'Visibility',
    enabled: false,
    build: () => buildGridLayer('vis_km', '#6b5b7a', 20, 2),
  },

  {
    id: 'tides',
    label: 'Tide at Honolulu',
    enabled: false,
    build: () => buildTideMarker(),
  },

  {
    id: 'terminator',
    label: 'Day / night line',
    enabled: false,
    build: () => buildTerminator(),
  },

  {
    id: 'density',
    label: 'Traffic density',
    enabled: false,
    build: () => buildDensityLayer(),
  },

];

// --------------------------------------------------------------------------
// Layer builders that need more than one line
// --------------------------------------------------------------------------

// The nearest weather frame to the current replay step. Weather is stored
// every 20 minutes, not every 2 — it does not change fast enough to justify
// the file size.
function weatherFrameAt(t) {
  let best = ENV_WEATHER.frames[0];
  for (const f of ENV_WEATHER.frames) {
    if (Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
  }
  return best;
}

function gridLatLon(row, col) {
  const g = ENV_WEATHER.grid;
  return [g.lat0 + row * g.dlat, g.lon0 + col * g.dlon];
}

function buildWindLayer() {
  const group = L.layerGroup();
  const redraw = () => {
    group.clearLayers();
    const frame = weatherFrameAt(App.t);
    const g = ENV_WEATHER.grid;
    for (let r = 0; r < g.nlat; r++) {
      for (let c = 0; c < g.nlon; c++) {
        const [lat, lon] = gridLatLon(r, c);
        const [u, v] = frame.wind[r][c];
        const speed = Math.hypot(u, v);
        const scale = 0.02 + speed * 0.0035;
        L.polyline([[lat, lon], [lat + v * scale * 0.05, lon + u * scale * 0.05]], {
          color: '#4a7fa0', weight: 1, opacity: 0.55, interactive: false,
        }).addTo(group);
      }
    }
  };
  redraw();
  window.addEventListener('pacwatch:time', redraw);
  return group;
}

// A translucent square per grid cell, shaded by one scalar field.
function buildGridLayer(field, color, maxValue, weight) {
  const group = L.layerGroup();
  const redraw = () => {
    group.clearLayers();
    const frame = weatherFrameAt(App.t);
    const g = ENV_WEATHER.grid;
    for (let r = 0; r < g.nlat; r++) {
      for (let c = 0; c < g.nlon; c++) {
        const [lat, lon] = gridLatLon(r, c);
        const value = frame[field][r][c];
        L.rectangle([[lat - g.dlat / 2, lon - g.dlon / 2],
                     [lat + g.dlat / 2, lon + g.dlon / 2]], {
          stroke: false, fillColor: color,
          fillOpacity: Math.max(0, Math.min(0.35, (value / maxValue) * 0.3)),
          interactive: false,
        }).addTo(group);
      }
    }
  };
  redraw();
  window.addEventListener('pacwatch:time', redraw);
  return group;
}

function buildTideMarker() {
  const group = L.layerGroup();
  const redraw = () => {
    group.clearLayers();
    const row = ENV_TIDES.series.find(r => r[0] === App.t) || ENV_TIDES.series[0];
    L.marker([ENV_TIDES.lat, ENV_TIDES.lon], {
      interactive: false,
      icon: L.divIcon({
        className: '',
        html: `<div class="vessel-label" style="color:#7fd4c1">` +
              `TIDE ${row[1].toFixed(2)} m</div>`,
        iconSize: [0, 0],
      }),
    }).addTo(group);
  };
  redraw();
  window.addEventListener('pacwatch:time', redraw);
  return group;
}

// Sub-solar point and the great circle 90 degrees from it. Costs no bytes at
// all — it is computed from the clock.
function buildTerminator() {
  const group = L.layerGroup();
  const redraw = () => {
    group.clearLayers();
    const epoch = SCENARIO.meta.start_epoch + App.t * SCENARIO.meta.step_seconds;
    const d = new Date(epoch * 1000);
    const dayOfYear = Math.floor((d - new Date(d.getUTCFullYear(), 0, 0)) / 86400000);
    const decl = -23.44 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365);
    const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60;
    const sunLon = 180 - utcHours * 15;

    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const h = (lon - sunLon) * Math.PI / 180;
      const lat = Math.atan(-Math.cos(h) / Math.tan(decl * Math.PI / 180)) * 180 / Math.PI;
      pts.push([lat, lon]);
    }
    L.polyline(pts, { color: '#d8a33c', weight: 1, opacity: 0.4,
                      dashArray: '6,6', interactive: false }).addTo(group);
  };
  redraw();
  window.addEventListener('pacwatch:time', redraw);
  return group;
}

// Where has traffic been across the whole replay? Static, so it is built once.
function buildDensityLayer() {
  const group = L.layerGroup();
  const cell = 0.02;
  const counts = {};
  for (const v of SCENARIO.vessels) {
    for (const row of v.track) {
      const key = `${Math.round(row[1] / cell)},${Math.round(row[2] / cell)}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const max = Math.max(...Object.values(counts));
  for (const [key, n] of Object.entries(counts)) {
    const [r, c] = key.split(',').map(Number);
    L.rectangle([[r * cell, c * cell], [(r + 1) * cell, (c + 1) * cell]], {
      stroke: false, fillColor: '#7fd4c1',
      fillOpacity: Math.min(0.4, (n / max) * 0.5), interactive: false,
    }).addTo(group);
  }
  return group;
}

// --------------------------------------------------------------------------
// Wiring
// --------------------------------------------------------------------------

const LayerState = { built: {} };

function setLayerEnabled(id, on) {
  const entry = LAYERS.find(l => l.id === id);
  if (!entry) return;
  entry.enabled = on;

  if (id === 'vessels') {
    if (on) MapState.vesselLayer.addTo(MapState.map);
    else MapState.map.removeLayer(MapState.vesselLayer);
    return;
  }

  if (on) {
    // Heavy layers are built the first time they are asked for, not at boot.
    if (!LayerState.built[id]) LayerState.built[id] = entry.build();
    LayerState.built[id].addTo(MapState.map);
  } else if (LayerState.built[id]) {
    MapState.map.removeLayer(LayerState.built[id]);
  }
}

function initLayers() {
  const list = document.getElementById('layer-list');

  for (const entry of LAYERS) {
    if (entry.enabled) {
      try {
        setLayerEnabled(entry.id, true);
      } catch (err) {
        console.error(`layer "${entry.id}" failed to build:`, err);
      }
    }

    const row = document.createElement('label');
    row.className = 'layer' + (entry.enabled ? ' layer--on' : '');
    row.innerHTML = `<input type="checkbox"${entry.enabled ? ' checked' : ''}>` +
                    `<span>${entry.label}</span>`;
    row.querySelector('input').addEventListener('change', (e) => {
      try {
        setLayerEnabled(entry.id, e.target.checked);
        row.classList.toggle('layer--on', e.target.checked);
      } catch (err) {
        console.error(`layer "${entry.id}" failed:`, err);
        e.target.checked = false;
        entry.enabled = false;
      }
      updateLayerCount();
    });
    list.appendChild(row);
  }

  updateLayerCount();
}

function updateLayerCount() {
  const on = LAYERS.filter(l => l.enabled).length;
  document.getElementById('layer-count').textContent = `${on} of ${LAYERS.length}`;
}
