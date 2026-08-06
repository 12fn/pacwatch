# Level 3 — Write a detector

**What you're going to do.** Four vessels in this scenario are behaving in ways
a watch officer would want to look at. PACWATCH catches one. You are going to
write the three rules that catch the rest, and take the counter from 1 / 4 to
4 / 4.

**Why it matters.** This is the whole job in miniature: you have data, you have
a suspicion, and you have to turn the suspicion into something explicit enough
that a machine can apply it and a human can argue with it. The arguing part is
not a side effect. It is the point.

**File:** `js/detect.js`

---

## Read the one that works first

Open `js/detect.js` and read `detectLoitering` before you write anything. It is
about forty lines and it establishes the pattern the other three follow:

```js
const LOITER = {
  MAX_SOG_KTS: 3.0,      // "barely moving"
  MIN_STEPS: 15,         // 15 reports x 2 minutes = 30 minutes
  MAX_RADIUS_NM: 2.0,    // stayed inside this circle
};
```

Thresholds first, as named constants, at the top. Not buried as magic numbers
three levels into an `if`. When somebody asks "why did it flag that one and not
this one," you want to be able to point at a line.

Then it returns a **Finding**:

```js
{
  detector: 'loitering',
  mmsi: 366880101,
  t_start: 34, t_end: 59,
  confidence: 0.72,
  evidence: [ 'Speed held between 1.2 and 2.6 kts for 52 minutes.', ... ],
  alternative_explanations: [ 'Mechanical trouble...', ... ]
}
```

Two things about that shape are deliberate.

**`evidence` quotes real numbers.** Not "vessel was loitering" — the speeds, the
duration, the radius. An analyst can check your work. A number is falsifiable;
an adjective is not.

**`alternative_explanations` is required and must not be empty.** You cannot
write a detector in this codebase without writing down the boring reason for the
same behaviour. That is not decoration and it is not humility theatre — a vessel
sitting still is far more often broken than sinister, and a display that forgets
to say so will eventually get somebody in trouble.

## The three empty ones

Each stub in `js/detect.js` has a comment block above it explaining what to look
for, suggested thresholds, and a prompt you can hand straight to OpenCode.

**`detectRendezvous`** — two vessels meet at sea. They approach, both slow at the
same time, sit together, then leave separately.
*Skill: geometry between two tracks.*

**`detectGap`** — a vessel stops reporting, and where it was when it went quiet
matters. Gaps are common and boring. A gap becomes interesting when the vessel
would have had to travel impossibly fast to be where it turns up.
*Skill: geofencing plus a physical plausibility check.*

**`detectIdentity`** — a vessel whose paperwork disagrees with its physics.
Everything a ship broadcasts about itself is typed in by a human and verified by
nothing. The positions and speeds are measured. When the two disagree, believe
the physics.
*Skill: data validation.*

## Two vessels that must NOT fire

There are decoys in the data, on purpose.

One fishing vessel slows to 2 knots for twenty minutes — under the loitering
duration threshold. One pair of ships passes about 500 metres apart at full
speed — close, but neither slows, so it is not a meeting.

If your detector flags those, it is too loose. **A rule that catches everything
catches nothing**, and an analyst who gets four false alarms a shift stops
reading the fourth one. Getting to 4 / 4 with no extras is the actual exercise.

## Working order

Do `detectGap` first. It is the most satisfying — the vessel is already visible
on your chart as a hollow dashed contact, aging, and you have probably already
wondered about it.

Then `detectRendezvous`. Then `detectIdentity`, which is the fiddliest.

---

## Copy this to OpenCode

```
Open js/detect.js and read detectLoitering and the comment block above
detectGap. Implement detectGap following that comment: find gaps by comparing
consecutive t values in each vessel's track, check whether the straight line
across the gap intersects a zone from GEO_ZONES using
GEO.segmentIntersectsPolygon, and work out the speed that crossing would have
required. Flag it only if that speed is implausible for the vessel's declared
type, using the TYPE_MAX_KTS table already in the file. Return Findings in
exactly the shape detectLoitering returns, including alternative_explanations.
Then set implemented: true for the gap detector in the DETECTORS registry, and
add a test in tests/detect.test.js that proves it fires on a vessel with an
impossible gap and does not fire on a vessel with an ordinary one.
```

Then reload the browser. The counter should read 2 / 4.

---

## How to know it worked

- The counter goes up and a dashed slot in the top bar lights magenta.
- A new card appears in the Findings panel with your evidence lines in it.
- Clicking it jumps the replay to the moment it started and selects the vessel.
- Ask the assistant "which vessels deserve a closer look?" — it calls
  `run_detectors` and your finding is in the answer.
- `tools/run-tests.sh` passes, including your new test.

## When you get to 4 / 4

Ask the assistant this, out loud, in front of somebody:

> Vessel MV KOA SPIRIT went dark inside Exercise Area BRAVO and came back
> somewhere it could not physically have reached. Is it hostile?

Read the answer carefully. You built every part of the system that produced it.

## Where to go next

[Level 4 — Generate products](05-LEVEL-4-generate-products.md).
