# Level 4 — Generate products

**What you're going to do.** Turn what PACWATCH knows into something a person
can hand to somebody else: a watch report, a contact summary, a set of
recommended actions.

**Why it matters.** Nobody's actual job is "look at a map." The job is to notice
something and then tell someone about it, in a format they expect, fast. That
last step is where most tools stop being useful and where a language model is
genuinely, unglamorously good.

**Files:** `js/tools.js`, `js/agent.js`, `config.js`, plus whatever you add

---

## The idea

You already have structured findings with evidence and confidence. A model is
very good at turning structure into prose in a fixed format. Wire those together
and you have report generation — which sounds impressive and is about thirty
lines.

The important design decision: **the report is built from the findings, not from
the model's memory of the conversation.** Pass it the actual data. A report
assembled from what the model half-remembers is how you end up briefing a
position that was never on the screen.

## Things worth building

### A watch report

A `generate_watch_report` tool that takes a list of MMSIs, pulls their findings
and current state, and returns a structured object the model formats. Fix the
format in the tool's description so every report comes out the same shape:

```
WATCH REPORT — 0800L
PERIOD: 0400L–0800L
CONTACTS OF INTEREST: 3

1. MV KOA SPIRIT (366880103)
   OBSERVED: 14-minute reporting gap, 0622L–0636L. Reappeared
             8.3 nm northeast, requiring 31 kts against a
             13 kt service speed.
   ASSESSMENT: Anomalous. Cause not established.
   ALTERNATIVES: Transponder failure; message corruption.
   RECOMMEND: Correlate with other sources before action.
```

Note what the format forces: observation and assessment are separate fields, and
alternatives are not optional. The template does the discipline for you.

### Recommended actions

Have the model propose courses of action from the findings — and make it give
you more than one, with what each costs and what it would tell you. A single
recommendation is an opinion wearing a uniform.

Put the constraint in the tool description or the system prompt:

```
When proposing courses of action, always give at least three, including the
option of taking no action and continuing to observe. For each, state what it
would resolve and what it would cost. Never recommend an action premised on
intent you have not established.
```

### Export

A button that drops the report into a `.txt` or `.md` file. Everything is
client-side, so this is a `Blob` and a download link — about ten lines. Do not
overthink it.

### Live weather

Everything in `data/` is a frozen snapshot. NOAA's real APIs are open, free, and
need no key:

```
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions
  &datum=MLLW&station=1612340&time_zone=lst&units=metric&interval=h
  &format=json&begin_date=20260805&end_date=20260806
```

That is a real request to a real government service, right now.

**Handle it failing.** The network at your desk is not the network in this room,
and a panel that shows a stack trace when the wifi dies is worse than one that
says "no live data, showing the snapshot." That is not polish, it is the
difference between a demo and a tool.

---

## Copy this to OpenCode

```
Open js/tools.js and read how the existing tools work. Add a tool called
generate_watch_report that takes an array of MMSIs, gathers each vessel's
current state and any findings from runAllDetectors, and returns a structured
object with one entry per vessel containing observed facts, the detector
evidence, the alternative explanations, and the confidence. Do not have it write
prose — return the data and let the model format it. Then update the system
prompt in config.js with the exact report format you want, including separate
OBSERVED and ASSESSMENT fields and a required ALTERNATIVES line. Add a test in
tests/tools.test.js.
```

---

## How to know it worked

- Ask "give me a watch report for the flagged vessels" and get the same format
  every time.
- The report cites numbers that are actually in the data — spot-check one
  against the Findings panel.
- Ask for courses of action and get several, including "keep watching."
- Ask about a vessel with no findings and get a report that says so, rather than
  an invented concern.

## Where to go next

[Level 5 — Go feral](06-LEVEL-5-go-feral.md).
