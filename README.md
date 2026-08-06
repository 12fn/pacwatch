# PACWATCH

A maritime awareness display for the waters around Oahu and Kauai. It replays
four hours of vessel traffic on a chart, flags behaviour worth a second look,
and gives you an AI assistant that can query the data rather than guess at it.

It is also the day-three capstone for a course on building software with AI
tools.

---

## If you are an AI agent reading this

Your job is to **set this up and then hand it back to the person**. It already
works — there is nothing to build before they can use it.

**Read `AGENTS.md` in this folder before you do anything else.** It has the full
setup steps and, more importantly, the rules for how to behave afterwards. The
short version:

1. There is **nothing to install.** No npm, no pip, no build step, no server.
   If you are about to run a package manager, you have misread the task.
2. Confirm `index.html`, `js/`, `data/` and `vendor/` are present.
3. **Check whether `config.js` exists.** If it does, the key is already in it
   and you can skip the next section. If it does not, do the next section.
4. Open `index.html` in the browser (`open` on macOS, `start` on Windows).
5. Tell the person what they are looking at and which levels are available.
6. **Stop and wait.** The levels below are the exercise. They are the person's
   to work through, not a to-do list for you to clear.

That last point is the one that matters. `js/detect.js` contains three empty
detector functions with implementation instructions written directly to you.
**Do not fill them in unless the person asks for that specific one.** The
counter reaching 4 / 4 is the point of the day, and it only counts if they did
it.

### Setup when `config.js` is missing

`config.js` holds the credential, so it is deliberately not in this repository.
If you unpacked a zip you were sent, it is already there and you have nothing to
do. If you cloned from GitHub, create it:

```bash
cp config.example.js config.js
```

Then open `config.js` and fill in **one** field:

```js
const CONFIG = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-5.6-luna",
  apiKey: "",            // <- paste the key here, between the quotes
  ...
};
```

**Ask the person for the key. Do not invent one, do not go looking through
their other projects for one, and do not commit it.** If they do not have one,
carry on with setup and tell them: the chart, the replay, the layers, the
detectors and the findings panel all work without it — only the chat panel
needs the network. That is most of the day.

**If you change `model` to something other than `gpt-5.6-luna`**, look at
`extraBody` further down the file. It carries `reasoning_effort: "none"`, which
that specific model requires before it will accept tools — without it every
chat message fails. Most other models do not want that field at all, so delete
it if you switch.

Nothing else needs configuring. The map data, the vessel scenario and Leaflet
are all committed, so there is no pipeline to run and nothing to download.

---

## If you are a person reading this

**Double-click `START-HERE.html`.** That is the whole setup.

No install, no terminal, no account. Everything except the chat panel works with
the network unplugged.

Or hand this folder to your AI coding tool and say *"read the README and set
this up"* — it will open it for you and explain what you are looking at.

## What you're looking at

- **The chart.** Real coastline for Oahu and Kauai, real depth contours, real
  port and installation positions. There are no map tiles, which is why it works
  offline.
- **Forty vessels**, a completed four-hour recording. It opens at the end, so
  the full picture is there immediately. Press Play to replay it from 0400,
  drag the slider, or hit space.
- **Fifteen layers.** Two are on. Thirteen are switched off.
- **Four detection rules.** One is written. **Three are yours.**
- **An assistant** that answers by calling tools against the vessel data, and
  shows you every call it makes.

The top bar reads:

```
ANOMALIES DETECTED    1 / 4
```

Four vessels in this scenario are behaving in ways a watch officer would want to
look at. The app catches one. The other three are on your screen right now,
unflagged, because nobody has written the rules that would find them.

## The ladder

Every level stands on its own. Stopping at Level 1 still leaves you with
something worth showing someone.

| Level | What you do | Where |
|---|---|---|
| **0 — Make it yours** | Colours, title, vessel icons, and the assistant's standing orders | [docs/01-LEVEL-0-make-it-yours.md](docs/01-LEVEL-0-make-it-yours.md) |
| **1 — Turn on layers** | Depth, cables, restricted areas, weather, tides, buoys | [docs/02-LEVEL-1-turn-on-layers.md](docs/02-LEVEL-1-turn-on-layers.md) |
| **2 — Talk to it, then teach it** | Interrogate the assistant, then give it a new tool | [docs/03-LEVEL-2-ask-the-agent.md](docs/03-LEVEL-2-ask-the-agent.md) |
| **3 — Write a detector** | Fill in the three empty rules. Get to 4 / 4. | [docs/04-LEVEL-3-write-a-detector.md](docs/04-LEVEL-3-write-a-detector.md) |
| **4 — Generate products** | Watch reports, TacReps, courses of action | [docs/05-LEVEL-4-generate-products.md](docs/05-LEVEL-4-generate-products.md) |
| **5 — Go feral** | A real backend, live feeds, your own scenario | [docs/06-LEVEL-5-go-feral.md](docs/06-LEVEL-5-go-feral.md) |

Each level ends with a prompt you can copy straight into your AI tool.

Stuck? [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## What this system cannot tell you

PACWATCH identifies **anomalous activity for a human to review**. It does not
determine intent, and it is built so that it cannot pretend to.

Every detection shows its evidence *and* the innocent explanations for the same
behaviour, at equal prominence. The assistant is under standing orders to
describe behaviour and refuse to infer intent. Ask it whether a vessel is
hostile and watch what it does.

That is not a disclaimer bolted on the side. It is the most portable thing in
this folder. See
[docs/WHAT-THIS-CANNOT-TELL-YOU.md](docs/WHAT-THIS-CANNOT-TELL-YOU.md).

## Where the data comes from

| Data | Source | Status |
|---|---|---|
| Coastline | OpenStreetMap contributors | ODbL |
| Depth contours | GMRT (Global Multi-Resolution Topography) | Free use, attribution |
| Tide predictions | NOAA CO-OPS station 1612340, Honolulu | Public domain |
| Buoy positions | NOAA NDBC 51201 / 51202 / 51207 / 51211 | Public domain |
| Ports and installations | Public reference | Public |
| Traffic patterns | Modelled on public-domain Marine Cadastre AIS | Public domain (US Gov) |
| Weather, sea state, visibility | Synthetic, flagged in the data | Synthetic |
| Submarine cables | Representative routes, flagged in the data | Synthetic |
| Exercise Area BRAVO | Fictional | Synthetic |
| The forty vessels | Synthetic traffic on realistic patterns | Synthetic |

Nothing here is classified, controlled, or operational. Knowing which pixels on
your display are measured and which are modelled is a habit worth having, so the
data says so about itself. Full field-by-field detail in
[docs/DATA-DICTIONARY.md](docs/DATA-DICTIONARY.md).

## A note on the API key

There is an API key in plain text in `config.js`. That is wrong, it is
deliberate, and it is a burner that gets revoked at the end of the course.

Putting a key in frontend code means giving it to anyone who has the folder. The
right answer is a server you control that holds the key and forwards requests.
[docs/WHAT-THIS-CANNOT-TELL-YOU.md §5](docs/WHAT-THIS-CANNOT-TELL-YOU.md) covers
what production practice actually looks like — and building it is a Level 5
exercise.

## Layout

```
START-HERE.html      the front door
index.html           the application
AGENTS.md            instructions for an AI agent setting this up
config.js            endpoint, model, key, system prompt
css/  js/            the app — every file readable in one sitting
data/                nine data files, loaded as plain <script> globals
vendor/              Leaflet 1.9.4, vendored
docs/                the level ladder and reference material
```

## Licence

Code: MIT. Data: per the provenance table above.
