// ==========================================================================
// THE REPLAY CLOCK
//
// The scenario is four hours of traffic recorded every two minutes: 121
// snapshots, numbered 0 to 120. Everything in this app refers to time by that
// step number, not by a date. Step 0 is 0400 local.
//
// Playing the replay just means counting upwards and telling everyone else.
// ==========================================================================

const ReplayState = {
  playing: false,
  speed: 4,          // steps per real second
  timer: null,
};

// Step index -> "HH:MM" local time.
function formatClock(t, meta) {
  const m = meta || SCENARIO.meta;
  const epoch = m.start_epoch + t * m.step_seconds;
  const local = epoch + (m.tz_offset_hours || 0) * 3600;
  const hh = Math.floor(local / 3600) % 24;
  const mm = Math.floor(local / 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function clampT(t, meta) {
  const m = meta || SCENARIO.meta;
  return Math.max(0, Math.min(m.steps - 1, Math.round(t)));
}

function setT(t) {
  App.t = clampT(t);

  renderVesselsAt(App.t);
  renderVesselDetail();

  const clock = document.getElementById('replay-clock');
  const slider = document.getElementById('replay-slider');
  if (clock) clock.textContent = formatClock(App.t);
  if (slider && Number(slider.value) !== App.t) slider.value = String(App.t);

  // Anything that depends on time — wind, tides, the day/night line — listens
  // for this instead of replay.js having to know those layers exist.
  window.dispatchEvent(new CustomEvent('pacwatch:time', { detail: { t: App.t } }));
}

function play() {
  if (ReplayState.playing) return;

  // Pressing play at the end rewinds, the way every media player does.
  if (App.t >= SCENARIO.meta.steps - 1) setT(0);

  ReplayState.playing = true;
  document.getElementById('replay-play').textContent = 'Pause';

  const tick = () => {
    if (!ReplayState.playing) return;
    if (App.t >= SCENARIO.meta.steps - 1) { pause(); return; }
    setT(App.t + 1);
    ReplayState.timer = setTimeout(tick, 1000 / ReplayState.speed);
  };
  tick();
}

function pause() {
  ReplayState.playing = false;
  clearTimeout(ReplayState.timer);
  const btn = document.getElementById('replay-play');
  if (btn) btn.textContent = 'Play';
}

function initReplay() {
  const slider = document.getElementById('replay-slider');
  slider.max = String(SCENARIO.meta.steps - 1);

  document.getElementById('replay-play').addEventListener('click', () => {
    ReplayState.playing ? pause() : play();
  });

  slider.addEventListener('input', (e) => {
    pause();
    setT(Number(e.target.value));
  });

  document.getElementById('replay-speed').addEventListener('change', (e) => {
    ReplayState.speed = Number(e.target.value);
  });

  // Space bar plays and pauses, because it always should.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      ReplayState.playing ? pause() : play();
    }
  });

  // Open at the END of the recording, not the beginning.
  //
  // This is a four-hour recording of something that already happened. Opening
  // at t=0 means nothing has happened yet: the assistant's tools are anchored
  // to replay time, so the first question anyone asks — "which vessels are not
  // reporting?" — truthfully returns nothing, which reads as a broken feature.
  //
  // Opening at the end means the whole picture is there from the first second.
  // Press play to watch how it got that way.
  setT(SCENARIO.meta.steps - 1);
}
