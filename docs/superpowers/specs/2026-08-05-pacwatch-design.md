# PACWATCH — Design Spec

**Date:** 2026-08-05
**Author:** Finn (design), Claude (drafting)
**Status:** Approved design, pending implementation plan

---

## 1. Purpose

PACWATCH is the Tier 3 capstone artifact for a one-day "intro to coding with AI"
course delivered to approximately 40 Marines.

The day's progression:

- **Tier 1** — Google AI Studio. Render an HTML page. "I made a thing."
- **Tier 2** — OpenCode installed locally. Generate a CSV, render it as HTML, produce a report.
- **Tier 3** — PACWATCH. Take a working operational application and extend it.

Tier 3's teaching goal is not "write JavaScript." It is: **direct an AI coding agent at a
real, existing codebase to add real capability.** The code is the medium; prompting a model
against a repository is the skill.

### Design constraints that drove everything

1. **Time.** Two hours of universal attention; up to six hours for students who stay engaged.
2. **Headcount.** One instructor, ~40 students. Anything that needs per-student debugging fails.
3. **Network.** Base wifi is unreliable. Bulk downloads (npm, map tiles) are assumed to fail.
4. **Machines.** OpenCode is installed. Nothing else may be assumed. No admin rights assumed.
5. **Range.** The disengaged student must still finish with something they demoed.
   The obsessed student must not run out of runway.

### Consequences

- The app **ships working.** It is not an assignment with missing parts; it is a product
  with a documented upgrade ladder.
- **Zero install.** No Node, no npm, no Python, no build step, no local server.
- **Zero network** for every feature except the chat panel.
- Distribution is a **zip on USB sticks or a local share**, not a download.

---

## 2. Architecture

### 2.1 Runtime model

A static web application opened directly from the filesystem (`file://`).

The single hard constraint this imposes: **`fetch()` against `file://` is blocked by CORS.**
Therefore *no data file is ever fetched.* Every data file is a `.js` file that assigns a
global and is pulled in with a `<script>` tag. This is the design decision that makes
zero-install genuinely work rather than almost work.

```js
// data/scenario.js
const SCENARIO = { meta: {...}, vessels: [...] };
```

### 2.2 Directory layout

```
pacwatch/
├── START-HERE.html          # Launcher page. Explains what to do. Links to index.html.
├── index.html               # The application.
├── config.js                # API key, endpoint, model. The only file with a secret.
├── css/
│   └── style.css
├── js/
│   ├── app.js               # Boot + wiring. Target ~150 lines.
│   ├── map.js               # Leaflet init, vessel rendering, tracks, heading vectors.
│   ├── layers.js            # THE MENU. 15 layers; 2 enabled, 13 commented out.
│   ├── replay.js            # Time scrubber, play/pause, speed control.
│   ├── agent.js             # Tool-calling loop. Target ~60 lines.
│   ├── tools.js             # Tool schemas + local implementations.
│   └── detect.js            # Anomaly rules. 1 implemented, 3 stubbed.
├── data/
│   ├── scenario.js          # Vessel tracks + metadata.
│   ├── geo-coast.js         # Natural Earth coastline, clipped + simplified.
│   ├── geo-bathy.js         # GEBCO-derived isobaths (200m, 1000m, 3000m).
│   ├── geo-cables.js        # Submarine cable routes (representative).
│   ├── geo-zones.js         # Exercise/restricted areas (synthetic), EEZ boundary.
│   ├── geo-assets.js        # Ports, harbors, installations.
│   ├── env-weather.js       # Wind field, sea state, visibility (time-varying grid).
│   ├── env-tides.js         # NOAA Honolulu tide prediction curve.
│   └── env-buoys.js         # NDBC station locations + observations.
├── vendor/
│   ├── leaflet.js
│   └── leaflet.css
├── docs/
│   ├── 00-START-HERE.md
│   ├── 01-LEVEL-0-make-it-yours.md
│   ├── 02-LEVEL-1-turn-on-layers.md
│   ├── 03-LEVEL-2-ask-the-agent.md
│   ├── 04-LEVEL-3-write-a-detector.md
│   ├── 05-LEVEL-4-generate-products.md
│   ├── 06-LEVEL-5-go-feral.md
│   ├── DATA-DICTIONARY.md
│   ├── HOW-THE-AGENT-WORKS.md
│   ├── WHAT-THIS-CANNOT-TELL-YOU.md
│   └── TROUBLESHOOTING.md
└── instructor/              # NOT included in the student zip
    ├── RUN-OF-SHOW.md
    ├── ANSWER-KEY.md
    ├── DEMO-SCRIPT.md
    └── KEY-ROTATION.md
```

Every source file is intended to be readable in a single sitting. Students must be able to
open any file and understand what it does; the app must never feel like a black box, because
the entire exercise is modifying it.

### 2.3 Map rendering — no tiles

The map is rendered from **vector GeoJSON**, not raster tiles.

Rationale:
- Raster tiles for the region would be megabytes and require network or a bundled tile cache.
- Vector coastline for the same area is ~50KB.
- The resulting dark-ocean/bright-coastline display reads as an operational picture rather
  than a street map, which better matches the exercise framing.

Leaflet is retained as the map engine (pan/zoom/layers/markers) with GeoJSON layers rather
than a tile layer.

### 2.4 The agent loop

Client-side, in `agent.js`, against an OpenAI-compatible `/v1/chat/completions` endpoint:

1. Send conversation + tool schemas.
2. If the response contains `tool_calls`, execute the corresponding JavaScript function in
   `tools.js` against the in-memory scenario data.
3. Append tool results to the conversation, resend.
4. Repeat until the model returns prose.

Target: ~60 lines, no framework, fully legible. This visibility is the point — students see
that "agentic" means a loop, a schema, and some ordinary functions.

**Tools shipped:**

| Tool | Purpose |
|---|---|
| `list_vessels(filters)` | Filter by type, speed, status, flag, area |
| `get_vessel_track(mmsi, minutes)` | Position history |
| `find_nearby(mmsi, radius_m, minutes)` | Proximity / CPA search |
| `check_zone(mmsi)` | Zone intersection test |
| `run_detectors(mmsi?)` | Invoke rules from `detect.js` |

Adding a sixth tool is a Level 2 exercise.

### 2.5 Credentials

A shared burner API key ships in `config.js`.

This is a deliberate, documented tradeoff for a one-day offline training zip. It is
mitigated and taught rather than hidden:

- The key is burner-scoped and **rotated/killed at end of day** (`instructor/KEY-ROTATION.md`).
- `config.js` carries a prominent comment, and `docs/00-START-HERE.md` states plainly:
  *this key is in this folder because it is a one-day training zip; this is exactly what you
  must never do in production, and here is what you would do instead* (server-side proxy,
  secret manager, per-user tokens, rotation).

Given a federal-facing audience on day one, modeling the correct reasoning about a knowingly
insecure shortcut is more valuable than silently taking it.

---

## 3. The difficulty ladder

The repository is a product with a documented upgrade path, not a partially-built assignment.

| Level | Activity | Files | Est. time |
|---|---|---|---|
| **L0 — Make it yours** | Colors, title, ship icons, agent system prompt | `css/style.css`, `config.js` | ~15 min |
| **L1 — Turn on layers** | Uncomment layers: bathymetry, cables, zones, weather, tides | `js/layers.js` | ~20 min |
| **L2 — Talk to it, then teach it** | Interrogate the agent; add a new tool | `js/tools.js` | ~30 min |
| **L3 — Write a detector** | Implement the three stubs; find all four vessels | `js/detect.js` | ~45 min |
| **L4 — Generate products** | COA and TacRep generation, report export, live NOAA feed | new files | remainder |
| **L5 — Go feral** | Real backend, WebSocket replay, new datasets, anything | anywhere | remainder |

L0–L3 fills the two-hour universal block. L4–L5 absorbs the remaining four hours for
engaged students.

### 3.1 The hook

The UI displays a persistent counter:

```
ANOMALIES DETECTED: 1 / 4
```

It ships at 1/4 because only the loitering detector is implemented. The other three vessels
are present in the data and visible on the map, undetected. Each stub implemented increments
the counter.

This converts Level 3 from an assignment into a game with immediate, unambiguous feedback,
and gives the instructor a one-glance read on room progress.

### 3.2 The bridge to AI coding

**Every level document ends with a copy-paste prompt for OpenCode.** This is the mechanism
that connects "read the doc" to "do the thing." Students are not being taught to type
JavaScript; they are being taught to aim a model at a codebase and evaluate what comes back.

---

## 4. Scenario design

### 4.1 Geography

Oahu and Kauai. Bounding box approximately **160.0°W–157.0°W, 20.8°N–22.4°N**.

Named features rendered: Pearl Harbor, Hickam, **MCB Hawaii Kaneohe Bay**, Honolulu Harbor,
Barbers Point/Kalaeloa, Kaena Point, Diamond Head, Nawiliwili Harbor, **PMRF Barking Sands**,
the Kauai Channel, the Kaiwi Channel.

Including Kaneohe Bay is intentional — it is a location the audience may personally know.

### 4.2 Traffic

- **~40 vessels**, 36 ordinary and 4 of interest.
- **4 hours** of replay at **2-minute cadence** = 120 positions per vessel, ~4,800 points total.
- Window set **0400–0800 local**, so the day/night terminator layer visibly sweeps during
  playback.
- Composition reflects real Hawaii traffic: container/cargo on Matson-style lanes, the
  Honolulu longline fishing fleet, inter-island tug and barge, Waikiki tour boats, tankers to
  Barbers Point, survey vessels.

Position data is stored as readable JSON arrays with a documented schema — **not**
delta-encoded or quantized. Compression would save ~150KB and cost the ability of a beginner
to open the file and recognize it as numbers. That tradeoff is not worth taking.

### 4.3 The four vessels

Each maps to exactly one detector, exercises a distinct analytic skill, and carries a
plausible innocent explanation.

**1 — Loitering** *(ships implemented; the worked example)*
Remains within a ~1.5nm box off Kaena Point for ~50 minutes at 1–3 kts while broadcasting
destination `HONOLULU`.
- *Rule:* sustained low speed + tight position cluster + not within a charted anchorage.
- *Skill:* time-series thresholds.
- *Innocent explanation:* engine trouble, waiting for a pilot, fishing.

**2 — Rendezvous** *(stub)*
Converges with a longline fishing vessel in the Kaiwi Channel ~14nm offshore. Both drop from
~11 kts to under 1 kt, hold ~22 minutes at ~180m separation, then separate.
- *Rule:* closest point of approach + simultaneous speed reduction + duration + distance from shore.
- *Skill:* geometry between two tracks.
- *Innocent explanation:* medical transfer, gear handoff.

**3 — Reporting gap inside a zone** *(stub)*
Approaches synthetic Exercise Area BRAVO west of Kauai. Final report on the boundary, ~14
minutes of silence, reappears on the far side. Implied transit speed ~31 kts against a
declared coastal freighter profile.
- *Rule:* gap duration + implied speed vs declared type envelope + segment intersects polygon.
- *Skill:* geofencing plus kinematic plausibility.
- *Innocent explanation:* transponder fault, which is genuinely common.

**4 — Identity inconsistency** *(stub)*
Declares cargo, 180m LOA, then performs 24-knot bursts and 90° turns in ~40 seconds —
physically impossible for that hull. MMSI country prefix conflicts with declared flag.
Reported dimensions change once mid-replay.
- *Rule:* cross-field validation against a physical envelope.
- *Skill:* data validation — trusting the declared field versus trusting the physics.
- *Innocent explanation:* data-entry error, rampant in real AIS.

### 4.4 The limits lesson, enforced structurally

The system identifies **anomalous activity for analyst review**. It does not determine intent.
This is enforced by three mechanisms rather than asserted on a slide:

1. **Every detector returns `confidence` and an `alternative_explanations` array.** The
   function signature makes it impossible to write a detector without articulating the
   innocent reading.
2. **The agent system prompt** forbids asserting intent and requires citing the specific
   observations supporting any claim. When challenged live ("so is this vessel hostile?"),
   the system declines and explains what additional information would be required.
3. **`docs/WHAT-THIS-CANNOT-TELL-YOU.md`.**

Mechanism 2 is the closing demonstration of the day and is expected to carry more weight
than any instructor statement.

---

## 5. Data layers

Ships with fifteen layers. **Two enabled at boot.** Each additional layer is a single
commented line in `js/layers.js`.

**On by default:** coastline/land · vessel tracks

**Available, off:** bathymetry contours · submarine cables · ports & installations ·
exercise/restricted zones · EEZ boundary · shipping lanes · wind field · sea state ·
visibility · tide curve · NDBC buoy observations · day/night terminator (computed) ·
vessel-density heatmap

The barebones default is what makes Level 1 satisfying: uncommenting one line visibly
transforms the display.

### 5.1 Provenance

Federal-facing audience; sourcing is documented and all sources are public domain or
free-use:

| Data | Source | Status |
|---|---|---|
| Coastline, land | Natural Earth | Public domain |
| Bathymetry | GEBCO | Free use, attribution |
| Tides | NOAA CO-OPS (Honolulu station) | Public domain |
| Buoy observations | NOAA NDBC | Public domain |
| Traffic patterns | Marine Cadastre (BOEM/NOAA/USCG) | Public domain, US Gov |
| Ports, installations | Public reference | Public |
| Submarine cables | Representative routes | Synthetic, labeled |
| Exercise Area BRAVO | Synthetic | Labeled |
| The four vessels of interest | Synthetic | Labeled |

Students are told explicitly which pixels are real and which are injected. Knowing the
provenance of your own display is a habit worth handing over on day one.

### 5.2 Answer key placement

The four synthetic vessels are **not** flagged in any data file loaded by the application.
Provenance is documented in `instructor/ANSWER-KEY.md`, which is excluded from the student
zip. A `"synthetic": true` field in `scenario.js` would be greppable within minutes and would
end the exercise.

The same reasoning applies to the public GitHub repository: **`instructor/` is gitignored.**
The public repo contains the student-facing application and documentation — which is the
genuinely reusable artifact — while the answer key, run-of-show, and key-rotation procedure
stay local to the instructor. A public repo containing the answers is the same leak as an
in-data flag, just one search away instead of one grep away.

`config.js` is likewise gitignored; the repo ships `config.example.js` with an empty key.
The live burner key is inserted only when building the student zip.

---

## 6. Size budget

| Component | Raw | In zip |
|---|---|---|
| Leaflet (vendored) | 160 KB | ~50 KB |
| Application code | 60 KB | ~15 KB |
| Coastline | 60 KB | ~20 KB |
| Bathymetry (3 isobaths) | 120 KB | ~35 KB |
| Vessel scenario | 250 KB | ~40 KB |
| Remaining layers | 150 KB | ~40 KB |
| Documentation | 80 KB | ~25 KB |
| **Total** | **~880 KB** | **~225 KB** |

Target: under 1 MB unzipped. Distribution via USB or local share.

---

## 7. Documentation strategy

Every level document uses an identical template:

1. What you are going to do (2 sentences)
2. Why it matters to your actual job (1 sentence)
3. Which files are involved
4. **The OpenCode prompt** (copy-paste block)
5. How to know it worked
6. Where to go next

The fixed shape lets a student enter at any level without having read the preceding ones —
necessary because students will progress at very different rates.

Supporting documents:

- **`DATA-DICTIONARY.md`** — every field in every data file.
- **`HOW-THE-AGENT-WORKS.md`** — the tool-calling loop, explained for someone who has never
  seen one.
- **`WHAT-THIS-CANNOT-TELL-YOU.md`** — the limits lesson.
- **`TROUBLESHOOTING.md`** — load-bearing at 40:1. Covers: blank screen, chat errors, grey
  map, "I broke it, how do I reset," file:// quirks per browser.

### 7.1 Instructor kit (excluded from student zip *and* from the public repo)

- **`RUN-OF-SHOW.md`** — timings, checkpoints, what "on track" looks like at each mark.
- **`ANSWER-KEY.md`** — the four vessels, their MMSIs, their evidence trails.
- **`DEMO-SCRIPT.md`** — the closing projector sequence, ending with the intent challenge.
- **`KEY-ROTATION.md`** — issuing and killing the burner key.

---

## 8. Failure modes and mitigations

| Risk | Mitigation |
|---|---|
| `npm install` fails on locked-down laptops | Nothing to install. Only L5 touches Node, and by then the student has a working app. |
| Base wifi dies | Only the chat panel degrades. Map, data, replay, detectors all continue. Chat panel shows a clear offline state. |
| Map tiles unavailable | No tiles. Vector rendering only. |
| `fetch()` blocked by `file://` CORS | No `fetch()` for local data. All data files assign globals via `<script>`. |
| Student breaks the app irrecoverably | `TROUBLESHOOTING.md` reset procedure; re-copy from the USB. |
| Students progress at wildly different rates | Six-level ladder; every level is independently entered and independently demoable. |
| One instructor cannot unblock 40 people | Anomaly counter gives at-a-glance room state; troubleshooting doc absorbs common failures; answer key exists as an escape hatch. |
| API key leaks | Burner, rotated end of day, and used as an explicit teaching example. |
| Students conclude "the AI found the bad guy" | Structural enforcement per §4.4. |

---

## 9. Explicitly out of scope

- Live AIS ingestion (AISStream or commercial). Optional instructor-side demonstration only;
  never a dependency.
- A per-student hosted proxy service.
- Any build step, bundler, transpiler, or package manager in the default path.
- Any backend in the default path.
- Per-student API keys.
- Grading, scoring, or submission infrastructure.

---

## 10. Success criteria

1. A student who does nothing but double-click ends the day with a working operational
   display they can show someone.
2. A median student reaches 4/4 anomalies detected within the two-hour block.
3. An engaged student is still building at hour six without having exhausted the ladder.
4. Zero students blocked by installation, network, or dependency failures.
5. When challenged on the projector, the system declines to assert intent — and the room
   understands why that is the correct answer.
