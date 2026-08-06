# Troubleshooting

Symptoms in roughly the order you will hit them.

---

## The page is blank or white

Almost always a typo in a file you just edited. One missing bracket stops every
script on the page.

**Open the developer console** — that is where the answer is:

| Browser | How |
|---|---|
| Chrome / Edge | `F12`, or `Cmd`+`Option`+`J` (Mac) / `Ctrl`+`Shift`+`J` |
| Firefox | `F12`, or `Cmd`+`Option`+`K` / `Ctrl`+`Shift`+`K` |
| Safari | Enable Develop menu in Settings → Advanced, then `Cmd`+`Option`+`C` |

Look for the first red line. It names the file and the line number. That is
your problem — and the errors below it are usually just consequences of it.

Paste the error into OpenCode along with the file you edited. It will find it
faster than you will.

## The chart is grey or empty but the panels work

Leaflet loaded, the geography did not.

- Check the console for `GEO_COAST is not defined`. That means `data/geo-coast.js`
  is missing or was edited into invalid JavaScript.
- Check you did not delete a `<script>` line from `index.html`. The order in
  there matters: data files must load before the code that reads them.

## The chart is there but no vessels

- Is `vessels` still `enabled: true` in `js/layers.js`?
- Did you edit `data/scenario.js` by hand? Run
  `node -e "require('./data/scenario.js')"` — if it prints an error, the file is
  broken.
- Is the replay slider at the far right? Some vessels finish their tracks.

## The chat says "No answer from the model"

The rest of the app is fine — the chart, replay and detectors all run on your
machine. Only this panel needs the network.

In order of likelihood:

1. **The network is down or blocked.** Try loading any website.
2. **The key expired.** These keys are burners and get revoked at the end of the
   day. If it is 1730, this is your answer.
3. **`config.js` got edited.** Check `apiKey`, `endpoint` and `model` are intact.
4. **Rate limited.** Forty people on one key. Wait fifteen seconds and retry.

The exact error is in the panel and in the console. `401` means the key,
`429` means slow down, `404` means the endpoint or model name.

## The chat does nothing at all

- Did the Send button grey out and stay that way? A request is stuck. Reload.
- Console error mentioning `CONFIG`? `config.js` is missing. Copy
  `config.example.js` to `config.js` and put the key back in.

## My detector does not fire

1. Did you set `implemented: true` in the `DETECTORS` registry at the bottom of
   `js/detect.js`? This is the most common one by a wide margin.
2. Reload the page. Detectors run at load.
3. Test it directly from the console:
   ```js
   detectGap(SCENARIO)
   ```
   An empty array means your rule is not matching. Loosen a threshold and try
   again to confirm the plumbing works, then tighten it back.
4. If it throws, the app catches it and logs it rather than dying — so check the
   console. A broken detector will not take the display down.

## My detector fires on everything

Your thresholds are too loose. Read
[what this cannot tell you](WHAT-THIS-CANNOT-TELL-YOU.md#3-base-rates-will-ruin-your-day)
— this is the expected failure, not a bug in your code.

Tighten one threshold at a time and watch the count.

## "I broke it and I do not know how"

You have two ways back.

**Undo, if you have not closed the editor:** `Cmd`+`Z` / `Ctrl`+`Z`.

**Fresh copy:** delete your folder and copy PACWATCH again from the USB stick or
the share. You lose your changes, you get a working app, and you are back in the
exercise in thirty seconds.

*Before you start Level 5, copy the whole folder somewhere safe.* Then "restore
from backup" is a thing you can do.

## Nothing happens when I edit a file

- Did you save it?
- Did you refresh the browser? Nothing here hot-reloads.
- Hard refresh to skip the cache: `Cmd`+`Shift`+`R` / `Ctrl`+`Shift`+`R`.
- Are you editing the file in the folder you actually opened? If you copied the
  folder, it is easy to end up editing one copy and viewing the other.

## Everything is slow

Turn off `wind`, `visibility`, `seastate` and `density` in `js/layers.js`. Those
redraw a grid on every replay step. On an older laptop, running all four at 60×
will crawl.

## It works on my machine but not on the projector

Different screen width. The layout collapses to a single column under 1080px
wide and the chart gets shorter. Zoom out with `Cmd`+`-` / `Ctrl`+`-`.

---

## Still stuck

Ask OpenCode, and give it three things:

1. What you were trying to do.
2. What you changed.
3. **The exact error from the console**, pasted, not paraphrased.

That third one is worth more than the other two together.
