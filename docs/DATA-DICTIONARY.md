# Data dictionary

Every field in every data file.

All nine files in `data/` have the same shape: a `.js` file that assigns one
global, loaded by a `<script>` tag in `index.html`.

**Why `.js` and not `.json`:** browsers block `fetch()` from `file://` for
security. A JSON file would work from a web server and fail when you
double-click the HTML. Assigning a global from a `<script>` tag works
everywhere, with nothing installed. That one decision is what makes this app
run from a USB stick.

---

## `SCENARIO` — `data/scenario.js`

The vessel traffic. The main event.

### `SCENARIO.meta`

| Field | Example | Meaning |
|---|---|---|
| `name` | `"PACWATCH Replay — Oahu / Kauai"` | Human label |
| `bbox` | `[-160, 20.8, -157, 22.4]` | `[west, south, east, north]` in degrees |
| `start_epoch` | `1754402400` | Unix seconds UTC at step 0 |
| `step_seconds` | `120` | Seconds between reports |
| `steps` | `121` | Number of steps, so `t` runs `0..120` |
| `tz_offset_hours` | `-10` | Hawaii, no daylight saving |
| `provenance` | string | Where the traffic patterns came from |

Wall-clock time for a step: `start_epoch + t * step_seconds`.
Step 0 is **0400 local**. Step 120 is **0800 local**.

### `SCENARIO.vessels[]`

| Field | Example | Meaning |
|---|---|---|
| `mmsi` | `351410001` | Maritime Mobile Service Identity. Unique. First three digits are the issuing country. |
| `name` | `"MV ISLAND TRADER"` | Broadcast name. Typed by a human. Not verified. |
| `callsign` | `"W10001"` | Radio callsign |
| `type` | `"cargo"` | One of `cargo` `tanker` `fishing` `tug` `passenger` `sailing` `research` `other` |
| `flag` | `"PA"` | ISO-3166 alpha-2. Declared, not verified. |
| `length_m` | `176` | Metres, integer |
| `beam_m` | `27` | Metres, integer |
| `draft_m` | `9.2` | Metres, one decimal |
| `destination` | `"HONOLULU"` | Free text, typed by the crew. Frequently stale or wrong. |
| `nav_status` | `"under way using engine"` | Declared status |
| `track` | array | Position reports — see below |
| `amendments` | array, **optional** | Present only on vessels whose broadcast details changed mid-replay |

> **Which of these are measured, and which are claimed?**
> `track` is measured. Everything else is typed in by a person and broadcast
> without verification. When the two disagree, believe the track. That is the
> entire basis of the identity detector.

### `vessel.track[]` — read this bit carefully

Each row is an array, not an object, to keep the file small enough to read:

```js
[t, lat, lon, sog, cog]
[47, 21.53211, -158.11234, 11.4, 272]
```

| Index | Name | Type | Meaning |
|---|---|---|---|
| 0 | `t` | integer | Step index, `0..120` |
| 1 | `lat` | float | Degrees north, 5 decimals (about 1 m) |
| 2 | `lon` | float | Degrees east — negative here, western hemisphere |
| 3 | `sog` | float | Speed over ground, **knots**, 1 decimal |
| 4 | `cog` | integer | Course over ground, **degrees true**, `0..359` |

Rows are sorted ascending by `t`.

**Gaps are missing rows.** There is no `null`, no `-1`, no flag. If a vessel
stopped transmitting between `t=72` and `t=78`, those rows simply are not in the
array — you go straight from `t=71` to `t=79`.

That is how real AIS behaves: a receiver that hears nothing records nothing.
Detecting a gap means comparing each row's `t` to the previous row's, and it is
the whole basis of the reporting-gap detector.

In the app, `positionAt(vessel, t)` in `js/map.js` handles this: it returns the
last known position and sets `stale: true`. Those contacts draw hollow and
dashed on the chart.

### `vessel.amendments[]` — optional

```js
amendments: [
  { t: 62, field: "destination", from: "HONOLULU", to: "LAHAINA" },
  { t: 62, field: "length_m",    from: 180,        to: 138 }
]
```

Present only on vessels that changed their broadcast static data mid-replay.
Ordinary vessels do not have the field at all — check with
`if (vessel.amendments)`.

---

## Geography

All are standard GeoJSON `FeatureCollection` objects.

| Global | File | Geometry | Properties |
|---|---|---|---|
| `GEO_COAST` | `geo-coast.js` | Polygon | `name` on the main islands only |
| `GEO_BATHY` | `geo-bathy.js` | LineString | `depth_m`: `200`, `1000` or `3000` |
| `GEO_ZONES` | `geo-zones.js` | Polygon | `name`, `kind`, `synthetic` |
| `GEO_ASSETS` | `geo-assets.js` | Point | `name`, `kind`: `port` \| `installation` \| `landmark` |
| `GEO_CABLES` | `geo-cables.js` | LineString | `name`, `synthetic` |
| `GEO_LANES` | `geo-lanes.js` | LineString | `name` |

**GeoJSON coordinates are `[lon, lat]`.** Leaflet uses `[lat, lon]`. This will
catch you at least once; when something plots in the Southern Ocean, that is
why.

`GEO_ZONES` kinds: `exercise`, `restricted`, `eez`. The `synthetic` flag marks
zones that do not exist in reality — Exercise Area BRAVO is invented for this
exercise and says so.

---

## Environment

### `ENV_TIDES` — `env-tides.js`

Real NOAA CO-OPS predictions for station **1612340, Honolulu**.

```js
{ station: "1612340", name: "Honolulu", lat, lon,
  series: [[t, height_m], ...],   // 121 entries, one per step
  synthetic: false }
```

`synthetic` is `true` if the build could not reach NOAA and fell back to a
computed tide curve. Check it before you describe the number as measured.

### `ENV_BUOYS` — `env-buoys.js`

NDBC station **positions are real** (51201 Waimea Bay, 51202 Mokapu Point,
51207 Kaneohe Bay, 51211 Barbers Point). The **observations are generated** —
live values would be from the wrong date.

Properties: `station`, `name`, `wave_height_m`, `wind_kts`, `wind_dir`, and
`series` of `[t, wave_height_m, wind_kts, wind_dir]`.

### `ENV_WEATHER` — `env-weather.js`

**Entirely synthetic**, and `ENV_WEATHER.synthetic === true` says so.

```js
{
  grid: { lat0: 20.8, lon0: -160, dlat: 0.2, dlon: 0.25, nlat: 9, nlon: 13 },
  frames: [ { t: 0, wind: [[[u,v], ...], ...], vis_km: [[...]], sea_state: [[...]] }, ... ],
  synthetic: true
}
```

Cell `[row][col]` sits at `lat0 + row*dlat`, `lon0 + col*dlon`.
Wind is `[u, v]` in knots — eastward and northward components.

**Frames are every 10 steps (20 minutes), not every step.** Weather does not
change on a two-minute timescale, and storing 121 frames cost 348 KB to say
almost nothing. Use the nearest frame; `weatherFrameAt(t)` in `js/layers.js`
does this.

---

## Provenance summary

| Real | Synthetic |
|---|---|
| Coastline (OpenStreetMap) | All 40 vessels |
| Depth contours (GMRT) | Weather, sea state, visibility |
| Tide predictions (NOAA CO-OPS) | Buoy observations (positions are real) |
| Buoy station positions (NOAA NDBC) | Exercise Area BRAVO |
| Port and installation positions | Submarine cable routes |
| Traffic *patterns* (Marine Cadastre AIS) | Pearl Harbor restricted area outline |

Nothing here is classified, controlled, or operational. Every source is public
domain or free-use.

Knowing which pixels on your display are measured and which are modelled is a
habit worth keeping after today.
