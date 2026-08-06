# Level 5 — Go feral

No structure here. A menu of genuinely open extensions, with honest difficulty
ratings, so you can pick something you will actually finish.

**Before you start anything on this page: copy the whole folder.** Work on the
copy. You have something that runs, and you should still have it at 1700.

---

## Difficulty is in hours, not in ego

**★ — under an hour.** You will finish it today.
**★★ — a couple of hours.** Finishable if you skip Level 4.
**★★★ — the rest of the day.** You may not finish. Start anyway; the interesting
part is early.

---

## Make the data yours

**★ Your own vessel.** Add one to `data/scenario.js` by hand. 121 rows of
`[t, lat, lon, sog, cog]`. Give it a behaviour and see whether your detectors
catch it. The fastest way to understand a data format is to write some.

**★★ A second scenario.** Copy `tools/gen_scenario.py`, change the geography to
water you actually care about, regenerate. The pipeline takes a bounding box —
`tools/fetch_coastline.py` and `tools/fetch_bathymetry.py` will pull real
coastline and real depths for anywhere on earth. Needs Python with `numpy`,
`matplotlib` and `shapely`.

**★★★ Real AIS.** Historical AIS for US waters is public domain, from Marine
Cadastre (BOEM / NOAA / USCG). Download a slice, normalise it to the schema in
`docs/DATA-DICTIONARY.md`, and replay genuine traffic. Your detectors will
immediately start finding things, and most of them will be wrong, and finding
out why is the most educational thing on this page.

## Make the system bigger

**★★ Move the key to a server.** The right fix for the thing
`docs/WHAT-THIS-CANNOT-TELL-YOU.md` complains about. A tiny Node or Python
service that holds the API key and forwards chat requests; the browser talks to
your service and never sees a credential. This is the single most useful thing
on this page for your actual job.

**★★ Persist state.** Save selections, notes on contacts, and completed reports
to `localStorage` so a watch handover survives a page reload.

**★★★ A live feed.** Replace the frozen replay with a WebSocket that streams
positions. Start by having a server replay `scenario.js` in real time — same
data, live plumbing — before you go looking for a real source.

**★★★ Multiple analysts.** Two browsers, one shared picture, contacts you can
assign. This is a genuinely hard distributed-state problem and you will learn
more from failing at it than from finishing most of this list.

## Make the analysis better

**★★ Tune against the decoys.** There are two vessels in the data engineered to
sit just under the thresholds. Move the thresholds until you catch them, then
count how many false positives you bought. Plot that trade-off. That curve is
the entire conversation about detection thresholds, and now you have measured
one instead of arguing about it.

**★★ Confidence that means something.** Right now confidence is a formula
somebody made up. Make it defensible: what would it take to say 0.9 rather than
0.7, and would you sign your name under the difference?

**★★★ Fuse the detectors.** A vessel that trips two rules is more interesting
than two vessels that trip one each. Build a combined score, then work out how
to explain it — a score nobody can explain will not survive contact with a
watch floor.

**★★★ Let the assistant propose a rule.** Ask it to look at a vessel you find
suspicious and write a detector that catches it. Then check the rule against the
other 39 vessels. Watch how often a rule that perfectly describes one contact is
useless as a rule. This is the most important thing on this page and almost
nobody gets to it.

## Make it defensible

**★★ Provenance on screen.** Every displayed value carries a source. Hover
anything and see whether it was measured, predicted, or invented. Sounds dull.
Try demoing a system without it to somebody whose signature goes on the product.

**★★ An audit trail.** Log every question asked of the assistant, every tool it
called, and every answer. Export it. If a system like this ever informs a real
decision, someone will ask what it was asked and what it said.

**★★★ Break your own system.** Add a vessel designed to defeat your detectors —
loiter for 29 minutes, pass 310 metres away, gap for 9 steps. Then decide
whether to move the thresholds. There is not a right answer, and understanding
why there is not a right answer is roughly the whole discipline.

---

## Copy this to OpenCode

```
Read the whole project: README.md, the files in js/, and docs/DATA-DICTIONARY.md.
Describe the architecture back to me in about ten lines, then propose three ways
to extend it that would take about two hours each, given that it currently has
no backend and runs from the filesystem. For each, tell me what would be hard
and what would break.
```

Then argue with it.

---

## If you build something good

The whole thing is a folder. Zip it and send it to somebody. That is the entire
deployment story, and for a lot of real problems it is enough.
