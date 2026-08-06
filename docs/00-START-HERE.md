# PACWATCH

You have been handed a working application. Not a tutorial, not a skeleton — a
real one, with real geography, that does something.

Your job today is to change it.

## Open it

Double-click **`START-HERE.html`** in this folder, then click **Open PACWATCH**.

That is the entire setup. No install, no terminal, no account. If a page opened
and you can see a chart, you are done with setup and every remaining minute is
yours to build with.

## What you're looking at

- **The chart.** Real coastline for Oahu and Kauai, drawn from coordinates in
  this folder. There are no map tiles, which is why it works with the network
  unplugged.
- **Forty vessels**, replaying four hours of traffic. Press **Play**, or drag
  the slider, or hit the space bar.
- **The layer list**, top right. Two layers on, thirteen off.
- **The findings panel**, middle right. What the app has flagged, with the
  evidence and — every time — the innocent explanations for the same behaviour.
- **The watch assistant**, bottom right. Ask it something. Then read the little
  boxes that appear: those are the tools it decided to call.

And in the top bar:

```
ANOMALIES DETECTED    1 / 4
```

Four vessels in this scenario are doing something a watch officer would want to
look at. The app currently catches one. The other three are on your screen
right now, unremarked, because nobody has written the rules that would find
them.

That is Level 3. It is the good part.

## The ladder

| | | |
|---|---|---|
| **0** | [Make it yours](01-LEVEL-0-make-it-yours.md) | Colours, names, and the assistant's standing orders |
| **1** | [Turn on layers](02-LEVEL-1-turn-on-layers.md) | Depth, cables, restricted areas, weather, tides |
| **2** | [Talk to it, then teach it](03-LEVEL-2-ask-the-agent.md) | Interrogate the assistant, then give it a new tool |
| **3** | [Write a detector](04-LEVEL-3-write-a-detector.md) | Get to 4 / 4 |
| **4** | [Generate products](05-LEVEL-4-generate-products.md) | Watch reports, TacReps, courses of action |
| **5** | [Go feral](06-LEVEL-5-go-feral.md) | Whatever you want |

Go as far as you feel like going. Every level is a stopping point that leaves
you with something finished.

## How to work

You are not here to type JavaScript. You are here to point an AI coding tool at
a real codebase and get it to do what you want. That is the skill, and it is the
one that transfers to your actual job on Monday.

So: **every level ends with a prompt you can copy into OpenCode.** Use them.
Then start changing them, because the moment you want something slightly
different from what the doc suggested is the moment you are actually learning.

Two habits worth picking up today:

**Ask it to explain before you ask it to change.** "Read js/detect.js and tell
me how the loitering detector decides" costs you thirty seconds and saves you
from approving a change you did not understand.

**Check the work.** The app tells you when a detector fires. The chat panel
shows you every tool call. Look at those instead of trusting the summary.

## One thing before you start

There is an API key sitting in plain text in `config.js` in this folder.

That is deliberate, it is wrong, and we did it anyway so that you would see it.
It is a burner key that gets deleted at the end of today. Putting a real key in
frontend code means giving it away to anybody who has the folder, the browser
dev tools, or the repo.

[What this cannot tell you](WHAT-THIS-CANNOT-TELL-YOU.md) covers what you would
do instead, along with the more important limits of a system like this one.

Now go open it.
