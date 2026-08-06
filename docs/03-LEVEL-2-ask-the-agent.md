# Level 2 — Talk to it, then teach it

**What you're going to do.** Interrogate the watch assistant, watch how it
actually answers, and then give it a new capability it did not have.

**Why it matters.** "Agentic AI" is a phrase you will hear a great deal and it
means something very specific: the model can call functions you wrote. Once you
have added one yourself, the phrase stops being marketing and becomes a thing
you can scope, cost and argue about.

**Files:** `js/tools.js`, `js/agent.js`

---

## Part 1 — Ask it things

Start easy and get harder. After each answer, **expand the little boxes** that
appeared above it. Those are the tools the assistant chose to call and the exact
data it got back.

**1. A lookup.**
> How many fishing vessels are out right now?

One tool call. The model did not know the answer and did not guess — it asked.

**2. A lookup with a filter.**
> Which vessels are doing under 3 knots?

Same tool, different arguments. Notice it worked out the arguments from your
English.

**3. Something about one vessel.**
> Tell me about the slowest vessel on the display.

Watch it chain: find the slow ones, then pull details on one of them.

**4. Two tools.**
> Has any vessel stopped reporting, and if so did it happen anywhere near a
> restricted area?

This one needs `list_vessels` and `check_zone`, and it has to connect the
results itself.

**5. The one that matters.**
> Is any of this hostile?

Read that answer carefully. Then read rule 3 in `config.js`. You caused that
behaviour by writing a sentence in English — and it is the difference between a
tool an analyst can use and a tool that will eventually embarrass them.

## What just happened

The model **cannot see the vessel data**. Not one row. All it gets is the list
of questions it is allowed to ask, and the answers you hand back.

The whole loop is in `js/agent.js` and it is about sixty lines:

1. Send the conversation and the tool list to the model.
2. If it replies with text — done.
3. If it asks for a tool, run that function right here in the browser, append
   the result, go back to 1.
4. Stop after six rounds so a confused model cannot spin forever.

That is it. That is what an AI agent is. Read the file; it will take you three
minutes and you will stop being impressed by the word.

## Part 2 — Give it a new tool

Open `js/tools.js`. Each tool is two things: a **schema** describing what the
model may ask for, and a **function** that answers.

The schema is written for the model to read. Vague descriptions produce a model
that calls the wrong tool, so write them like you are briefing somebody who
cannot ask a follow-up question.

Some worth building:

- `get_environment` — sea state, wind and visibility near a vessel, from `ENV_WEATHER`
- `get_tide` — the tide height at Honolulu right now, from `ENV_TIDES`
- `distance_between` — range and bearing between two vessels
- `vessels_in_zone` — everyone currently inside a named area
- `closest_to_shore` — which contacts are nearest land

---

## Copy this to OpenCode

```
Open js/tools.js and read how the existing tools are built. Add a sixth tool
called get_environment that takes an mmsi and returns the wind speed and
direction, sea state and visibility at that vessel's current position, reading
from the ENV_WEATHER global. Follow the existing tool structure exactly,
including the schema description. Then add a test in tests/tools.test.js proving
it returns sensible values for a real vessel and a clear error for an unknown
MMSI.
```

Run the tests with `tools/run-tests.sh` if you have a terminal open. If you do
not, just ask the assistant to use the new tool and see whether it works.

---

## How to know it worked

- Ask "what are the sea conditions where the slowest vessel is?" and the
  assistant calls your new tool.
- The tool box in the chat shows your tool's name and the data it returned.

## Where to go next

[Level 3 — Write a detector](04-LEVEL-3-write-a-detector.md). Four vessels,
one detector, three empty slots.
