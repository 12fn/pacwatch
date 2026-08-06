# What this cannot tell you

PACWATCH identifies **anomalous activity for a human to review**. That sentence
is doing a lot of work, and this page is about what it rules out.

---

## 1. It cannot tell you what anyone intends

This is not a limitation of our version. It is a limitation of the data.

A position report contains where a vessel is, how fast, and which way. It does
not contain cargo, crew, orders, or purpose. No amount of processing recovers
information that was never in the signal. A model that tells you a vessel is
"hostile" from a track has not analysed anything — it has produced a word that
fits the tone of the question.

So the system is built so that it cannot do that:

- Every detector returns `alternative_explanations`, and the function will not
  produce a finding without them.
- The findings panel renders those alternatives at the **same visual weight** as
  the evidence. Not smaller, not collapsed, not below the fold.
- The assistant's standing orders in `config.js` forbid asserting intent and
  require citing specific observations.

Ask it whether a vessel is hostile. It will tell you what was observed, that
this does not establish intent, and what else you would need to know.

That answer is the most portable thing in this folder. Everything else here is
a teaching exercise about maritime traffic. That is a habit that applies to
every intelligence product you will ever touch.

## 2. Anomalous is not the same as guilty

Every pattern in this scenario has a boring explanation, and in the real world
the boring explanation is usually the correct one:

| What you see | What it usually is |
|---|---|
| Sitting still for an hour offshore | Engine trouble, or waiting for a berth |
| Two vessels meeting at sea | A transfer, a repair, a sick crewman |
| Going dark for fifteen minutes | A bad antenna. AIS drops out constantly. |
| Declared details that do not match | Somebody typed it in wrong |

That last one deserves emphasis. Real AIS static data is full of errors —
wrong dimensions, stale destinations, misconfigured transponders. If you build
a detector that flags every inconsistency, you will flag a large fraction of
honest traffic.

## 3. Base rates will ruin your day

Suppose you build a detector that is 95% accurate. That sounds good.

Run it against 40 vessels of which 4 are genuinely of interest:

- Of the 4 real ones, it catches about 4.
- Of the 36 ordinary ones, it wrongly flags about 2.

So six alerts, four real. Two out of three, which is workable.

Now run the same detector against a real day's traffic — say 2,000 vessels, of
which 4 are of interest:

- It still catches about 4.
- And it wrongly flags about **100**.

Same detector. Same accuracy. Now 4% of your alerts are real, and the watch
stops reading them by Thursday.

Nothing changed except how rare the thing you are looking for is. **Test your
detector against the ordinary traffic, not just against the vessel you built it
to catch.** That is why there are decoys in this scenario.

## 4. It cannot tell you what it does not have

The chart shows fourteen layers and forty vessels. It does not show:

- Vessels that are not transmitting AIS at all. Smaller vessels are not required
  to, and anyone who does not want to be seen simply switches it off. **The most
  interesting thing in your area of responsibility may be the thing that is not
  on your screen** — and a clean display can feel like reassurance when it is
  really an absence of data.
- Anything below the surface.
- Anything above it.
- Whatever your sensors did not cover.

A display's confidence comes from its styling, not from its coverage. Yours
looks authoritative because we styled it that way.

## 5. The API key in this folder

Open `config.js`. There is an API key sitting in plain text.

**That is wrong, we did it on purpose, and here is what is wrong with it.**

Anything in a browser is public. Not "hard to find" — public. Anyone with the
folder has the key. Anyone who opens developer tools has the key. If this ever
went on a web server, anyone who visited the page would have the key, and
automated scanners would find it within hours. Keys leaked this way get used to
run up bills on somebody else's account, and the first sign is usually the
invoice.

It is acceptable here for exactly three reasons: it is a burner, it is scoped to
nothing else, and it gets revoked at the end of today.

**What you would actually do:**

1. The key lives on a server you control. The browser never receives it.
2. The browser calls *your* endpoint. Your server adds the key and forwards the
   request.
3. Your server enforces who may call it and how often.
4. The key rotates on a schedule, and you can revoke it in one action.
5. The key is in a secret manager, never in source control. Add it to
   `.gitignore` before you write it down, not after.

That is Level 5 in [Go feral](06-LEVEL-5-go-feral.md), rated ★★, and it is
probably the most directly useful thing on this course.

## 6. What it is genuinely good for

None of the above means the system is useless. It means it is a particular kind
of useful:

- Making a large amount of position data reviewable by one person.
- Applying a consistent rule where a tired human would apply an inconsistent one.
- Explaining, in numbers, why something was flagged.
- Answering questions faster than you could look them up yourself.
- Producing the same report format every time.

Those are real. They are worth building. They are just not the same thing as
knowing what somebody is up to, and the gap between the two is where people get
into trouble.
