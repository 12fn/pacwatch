# Level 0 — Make it yours

**What you're going to do.** Change how PACWATCH looks and how its assistant
behaves. Nothing here is hard, and everything here is visible immediately.

**Why it matters.** Two of these edits are cosmetic and one is not: rewriting
the assistant's standing orders in plain English changes what the AI does. No
code, no retraining, no configuration. That technique is most of how people
actually steer these models at work.

**Files:** `css/style.css`, `config.js`, `js/map.js`

---

## 1. The palette

Open `css/style.css`. The first block is every colour in the app:

```css
--water-deep:   #050d18;
--land:         #2b2519;
--caution:      #e8368f;
--own-data:     #7fd4c1;
```

Change one. Save. Refresh the browser. That is the loop.

Worth knowing before you go wild: those colours are not arbitrary. They follow
nautical chart convention — buff land, graded blue water, and magenta for
anything regulatory or cautionary. That is why alerts here are magenta rather
than red. On a chart red means something else entirely, and a display that
misuses it is a display that will be misread at 0300 by someone tired.

Change it anyway if you want. Just make the choice on purpose.

## 2. The name and the area

`index.html`, near the top:

```html
<span class="bar__mark">PACWATCH</span>
<span class="bar__area">Oahu / Kauai</span>
```

Call it whatever your shop would call it.

## 3. The vessel symbols

`js/map.js`, the `TYPE_COLORS` block. One colour per vessel type. The legend at
the bottom left builds itself from whatever you put there, so it will not go
stale on you.

## 4. The assistant's standing orders ← *the one that matters*

Open `config.js` and find `systemPrompt`. It is a paragraph of English. It is
also the single biggest lever you have over the assistant's behaviour.

Read the rules that are already in there, particularly rules 3 and 4. Then try
adding one of your own and see what changes:

```
6. Always give distances in nautical miles and never in kilometres.
```

```
6. Start every answer with a one-line BLUF, then the detail.
```

```
6. If you are less than 70% sure, say so in the first sentence.
```

Ask the assistant the same question before and after. The difference is the
lesson.

---

## Copy this to OpenCode

```
Open css/style.css and config.js in this project. First tell me what the colour
variables control and where the assistant's system prompt is used. Then change
the palette to a warmer scheme with amber vessels on a near-black chart, and add
a rule to the system prompt telling the assistant to open every answer with a
one-line BLUF. Do not change anything else.
```

---

## How to know it worked

- The chart looks different.
- The legend colours match the vessels.
- The assistant's answers are shaped differently than they were before.

## Where to go next

[Level 1 — Turn on layers](02-LEVEL-1-turn-on-layers.md). There are thirteen
more layers already built and sitting switched off.
