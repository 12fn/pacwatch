// ==========================================================================
// PACWATCH — boot and wiring
//
// This file does no real work. It starts the other pieces in the right order
// and keeps the one bit of shared state everything reads: App.
// ==========================================================================

const App = {
  scenario: null,
  findings: [],
  selectedMmsi: null,
  t: 0,
};

function boot() {
  App.scenario = SCENARIO;

  initMap();
  renderLegend();
  refreshFindings();     // before layers, so flagged vessels draw ringed
  initLayers();
  initReplay();
  initAgent();
}

// --------------------------------------------------------------------------
// Findings
//
// Run every implemented detector, update the rack, and render the results.
// Call this again from the console after you edit js/detect.js if you do not
// want to reload the page.
// --------------------------------------------------------------------------
function refreshFindings() {
  App.findings = runAllDetectors(SCENARIO);
  renderRack();
  renderFindings(App.findings);
  if (MapState.map) renderVesselsAt(App.t);
}

function renderRack() {
  const slots = document.getElementById('rack-slots');
  const fired = {};
  for (const f of App.findings) {
    fired[f.detector] = (fired[f.detector] || 0) + 1;
  }

  slots.innerHTML = DETECTORS.map(d => {
    const hits = fired[d.id] || 0;
    // A detector counts as working when it has been implemented AND found
    // something. An implemented rule that fires on nothing is not yet done.
    return hits > 0
      ? `<div class="slot slot--filled" data-hits="${hits}">${d.label}</div>`
      : `<div class="slot slot--empty">${d.label}</div>`;
  }).join('');

  const working = DETECTORS.filter(d => (fired[d.id] || 0) > 0).length;
  document.getElementById('anomaly-count').textContent = `${working} / ${DETECTORS.length}`;
}

function renderFindings(findings) {
  const list = document.getElementById('finding-list');
  const count = document.getElementById('finding-count');
  if (!list) return;

  count.textContent = String(findings.length);

  if (findings.length === 0) {
    list.innerHTML =
      `<p class="empty">Nothing flagged. Either the traffic is clean or the ` +
      `rules that would catch it have not been written yet — three of the four ` +
      `are still empty in <code>js/detect.js</code>.</p>`;
    return;
  }

  list.innerHTML = findings.map((f, i) => {
    const v = SCENARIO.vessels.find(x => x.mmsi === f.mmsi);
    const label = (DETECTORS.find(d => d.id === f.detector) || {}).label || f.detector;
    return `
      <article class="finding" data-i="${i}">
        <div class="finding__top">
          <span class="finding__kind">${label}</span>
          <span class="finding__when">${formatClock(f.t_start)}–${formatClock(f.t_end)}
            &middot; conf ${f.confidence}</span>
        </div>
        <div class="finding__vessel">${v ? v.name : 'unknown'} &middot; ${f.mmsi}</div>
        <ul class="finding__list finding__evidence">
          ${f.evidence.map(e => `<li>${e}</li>`).join('')}
        </ul>
        <div class="finding__alt">
          <span class="label">Could also be</span>
          <ul class="finding__list">
            ${f.alternative_explanations.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
      </article>`;
  }).join('');

  // Clicking a finding takes you to the vessel at the moment it started.
  list.querySelectorAll('.finding').forEach(card => {
    card.addEventListener('click', () => {
      const f = findings[Number(card.dataset.i)];
      pause();
      setT(f.t_start);
      App.selectedMmsi = null;
      selectVessel(f.mmsi);
    });
  });
}

window.addEventListener('DOMContentLoaded', boot);
