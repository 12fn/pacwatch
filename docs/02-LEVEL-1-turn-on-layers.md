# Level 1 — Turn on layers

**What you're going to do.** PACWATCH ships knowing how to draw fifteen layers.
Two are on. You are going to switch on the other thirteen, one at a time, and
then decide which ones you actually want.

**Why it matters.** Every operational display you will ever use has this
problem: the data is available, screen space is not, and somebody has to decide
what earns a place on it. Today you get to be that somebody.

**File:** `js/layers.js`

---

## The menu

Open `js/layers.js`. Every entry looks like this:

```js
{
  id: 'bathy',
  label: 'Depth contours',
  enabled: false,          // <- change this to true
  build: () => L.geoJSON(GEO_BATHY, { ... }),
},
```

Change `false` to `true`, save, refresh. That is the whole operation. There is
nothing else to do and nothing you can break — a boolean cannot cause a syntax
error.

## What's in the box

| id | What it shows |
|---|---|
| `bathy` | Depth contours at 200 m, 1000 m and 3000 m — real bathymetry |
| `zones` | Exercise and restricted areas, including one fictional one |
| `assets` | Pearl Harbor, Hickam, Kaneohe Bay, PMRF Barking Sands, the commercial ports |
| `cables` | Submarine cable routes (representative, not actual) |
| `lanes` | The shipping lanes traffic actually follows |
| `eez` | Exclusive economic zone reference line |
| `buoys` | NOAA NDBC buoy stations with sea state |
| `wind` | Wind field, updates as the replay runs |
| `seastate` | Sea state shading |
| `visibility` | Visibility, with a patch of weather that moves |
| `tides` | Live tide height at Honolulu, from real NOAA predictions |
| `terminator` | The day/night line — watch it sweep during playback |
| `density` | Where traffic has been across the whole four hours |

Start with `bathy`. Then `zones`. Then `assets`. Those three together turn an
abstract picture into a place.

## The actual exercise

Turn on all thirteen.

Look at it. It is unusable — a wall of colour with vessels lost somewhere
underneath.

Now turn off everything that is not helping you find four suspicious ships, and
write down why you kept what you kept. That list is a design decision, and
defending it is a more useful skill than any amount of syntax.

## While you're in here

The checkboxes in the app toggle layers at runtime too. Those are for
exploring. The file is the source of truth — reload and you are back to what
`layers.js` says. Set the file to the loadout you actually want.

---

## Copy this to OpenCode

```
Open js/layers.js. Turn on the bathy, zones and assets layers. Then add a
sixteenth layer with id "anchorages" that draws three circles of radius 1
nautical mile off Honolulu Harbor, Barbers Point and Nawiliwili, styled like the
zones layer but in a different colour, with a tooltip naming each one. Follow
the shape of the existing layer entries exactly.
```

---

## How to know it worked

- Depth contours ring the islands, tighter on the north shore where the shelf
  drops away fast.
- Exercise Area BRAVO shows up west of Kauai as a magenta dashed box.
- Kaneohe Bay and PMRF are labelled on the chart.
- The layer count in the panel header goes up.

## Where to go next

[Level 2 — Talk to it, then teach it](03-LEVEL-2-ask-the-agent.md).
