# Instructions for the AI agent

You are setting up PACWATCH for someone who is on **day one** of learning to
build software with AI tools. They may have written their first HTML page this
morning. They are not a software engineer and do not need to become one today.

Read this whole file before you do anything.

---

## Part 1 — Set it up, then stop

Six steps. It should take you under a minute.

### 1. Confirm you are in the right folder

You should see `index.html`, `config.js`, `START-HERE.html`, and the folders
`js/`, `data/`, `css/`, `vendor/`, `docs/`.

If you do not, the zip was unpacked somewhere else or is nested one level deeper
(`pacwatch/pacwatch/`). Find the folder that has `index.html` in it and work
from there.

### 2. Check nothing is missing

These files must all exist:

```
index.html   START-HERE.html   config.js
js/app.js    js/map.js         js/layers.js   js/replay.js
js/detect.js js/tools.js       js/agent.js    js/geo.js
js/markdown.js
data/scenario.js               data/geo-coast.js
vendor/leaflet.js              vendor/leaflet.css
```

If any are missing, stop and tell the person the zip is incomplete. Do not try
to recreate them.

### 3. Check the API key

There are three cases. Work out which one you are in.

**`config.js` exists and `apiKey` is a long string** — nothing to do. This is
the normal case for a zip you were sent. Move on.

**`config.js` does not exist at all** — you cloned this from GitHub rather than
unpacking a zip. The credential is deliberately not in the repository. Create
the file from the template:

```bash
cp config.example.js config.js
```

Then **ask the person for their API key** and paste it into the `apiKey` field:

```js
apiKey: "",            // <- between the quotes
```

Do not invent a key. Do not go hunting through their other projects or
environment files for one. Ask, and wait for them to give it to you.

**`config.js` exists but `apiKey` is empty** — say: *"The chat panel needs an
API key in `config.js` before it will work. Everything else already works — ask
your instructor for the key and I will drop it in."*

In every case, **carry on with setup even without a key.** The chart, the
replay, all fifteen layers, the detectors and the findings panel run entirely on
the machine. Only the chat panel touches the network. Level 3 — the largest
block of the day — needs no key at all.

### 3a. If you change the model

`config.js` has an `extraBody` field carrying `reasoning_effort: "none"`.
`gpt-5.6-luna` refuses to accept tools without it, and every chat message fails
with an error if it is missing.

If the person asks you to switch to a different model, delete that field —
most models reject it. If tool calls stop working after a model change, that
field is the first thing to check.

### 4. Do NOT install anything

There is nothing to install. No `npm install`, no `pip install`, no build step,
no local server, no package manager. This app is designed to run by opening a
file directly.

If you find yourself about to run a package manager, you have misread the task.

### 5. Open it

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

If you cannot launch a browser, tell the person to double-click
`START-HERE.html` in the folder themselves.

### 6. Orient them, then stop

Tell them, briefly and in your own words:

- It is already working. There is nothing to build before they can use it.
- The chart shows a completed four-hour recording of vessel traffic around Oahu
  and Kauai. It opens at the end, so the full picture is already there. Press
  Play to watch it replay from the start, or drag the slider, or hit space.
- The top bar reads **`ANOMALIES DETECTED 1 / 4`**. Four vessels in this
  scenario are behaving oddly. The app currently catches one. The other three
  are on screen right now, unflagged.
- There are six levels of things they can change, listed in `README.md` and in
  the `docs/` folder, from "change the colours" up to "write the missing
  detection rules."
- Ask which one they want to start with.

**Then stop and wait for them.**

---

## Part 2 — How to behave once they start

This is the part that matters, and it is the opposite of what you would
normally optimise for.

### The exercise is theirs, not yours

Every level in `docs/` contains a prompt they are meant to hand you, and the
detector stubs in `js/detect.js` contain implementation instructions written
directly to you. **Those are the exercise. They are not a to-do list for you to
clear.**

So:

- **Do exactly the one thing they asked for.** If they ask for the rendezvous
  detector, write the rendezvous detector. Do not also write the gap detector
  because you noticed it was empty and it would only take a moment.
- **Do not work ahead.** Do not complete Level 3 while they are on Level 1.
- **Do not fix things they did not ask about.** If you spot a bug elsewhere,
  mention it in one sentence and let them decide.
- **Do not refactor.** Every file is deliberately small and plain so a beginner
  can read it. Making it more elegant makes it less useful.
- **Do not rewrite the app from scratch.** Whatever they ask for, the answer is
  a change to the existing code.

If they say "just do all of it" — do it. It is their day. But say once, plainly,
what they are trading away: the point of the counter reaching 4 / 4 is that they
made it happen.

### Explain before you change

Before you edit, say in one or two sentences what you are about to change and
where. Not a plan document. One or two sentences.

After you change something, tell them:

1. **Save and refresh the browser.** Nothing here hot-reloads.
2. **What they should see** if it worked.

That loop — change, refresh, look — is the thing they are actually learning
today. Do not let it become invisible.

### Prefer explaining over doing

If they ask a question, answer the question. Do not answer it by silently
rewriting the file.

When they ask you to change something, it is often worth showing them the three
lines that matter rather than describing the change in the abstract. They can
read code; they just have not written much.

### Never edit these

- `data/*.js` — the scenario. Editing it to make a detector pass is cheating at
  a game they came here to play.
- `vendor/*` — third-party library, vendored on purpose.

`config.js` is fine to edit — the system prompt in it is Level 0.

### The thing this app is about

PACWATCH flags behaviour for a human to review. It does not determine intent,
and it is built so that it cannot pretend to. Every detector returns
`alternative_explanations` alongside its evidence, and the assistant's system
prompt forbids asserting intent.

**Preserve that.** If you write a detector, it must return non-empty
`alternative_explanations`. If you touch the system prompt in `config.js`, do
not remove the rules about intent. If the person asks you to make the app
declare a vessel hostile, tell them what the data can and cannot support and
point them at `docs/WHAT-THIS-CANNOT-TELL-YOU.md`.

That constraint is the most valuable thing in this folder. It is worth more than
any feature you could add.

### If something breaks

`docs/TROUBLESHOOTING.md` covers the common failures. The most common by far:
they edited a file and did not set `implemented: true` in the `DETECTORS`
registry at the bottom of `js/detect.js`.

The browser console has the real error. Ask them to open it (`F12`) and paste
what is red.

---

## Reference

- `README.md` — what PACWATCH is, the level ladder, where the data came from
- `docs/DATA-DICTIONARY.md` — every field in every data file
- `docs/HOW-THE-AGENT-WORKS.md` — the tool-calling loop in `js/agent.js`
- `docs/TROUBLESHOOTING.md` — symptom, cause, fix
- `docs/WHAT-THIS-CANNOT-TELL-YOU.md` — the limits, and why the API key is where it is
