// ---------------------------------------------------------------------------
// PACWATCH configuration
//
// SECURITY NOTE — READ THIS. It is the most useful thing in this file.
//
// The API key below sits in a plain text file inside a folder you were handed.
// That is fine for one training day with a key that gets deleted this evening.
// It is NOT how you do this at work. A key in frontend code is a key you have
// given away — anyone with the folder, with the browser dev tools, or with the
// repo has it. In production the key lives on a server you control, the browser
// never sees it, and it rotates on a schedule.
//
// We did it the wrong way on purpose, once, so you can see what the wrong way
// looks like. See docs/WHAT-THIS-CANNOT-TELL-YOU.md for the longer version.
// ---------------------------------------------------------------------------

const CONFIG = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-5.6-luna",
  apiKey: "",            // filled in when the student zip is built
  maxToolIterations: 6,  // stops a confused model looping forever

  // Anything here is merged into the request body. Model-specific quirks live
  // here rather than in js/agent.js, so the loop stays readable.
  //
  // gpt-5.6-luna refuses function tools on /v1/chat/completions unless
  // reasoning effort is 'none'. Without this line the chat panel returns an
  // error on every message. If you switch to a different model, you probably
  // want to delete it.
  extraBody: {
    reasoning_effort: "none",
  },

  // -------------------------------------------------------------------------
  // THE SYSTEM PROMPT
  //
  // This is the assistant's standing orders. It is plain English, and editing
  // it changes how the assistant behaves — no code required. That is not a
  // gimmick; it is most of how people steer these models in practice.
  //
  // Try it: add a rule, reload the page, and see what changes.
  // -------------------------------------------------------------------------
  systemPrompt: `You are the PACWATCH watch assistant. You help a human analyst
review maritime traffic around Oahu and Kauai.

RULES — these are not suggestions:

1. Use the provided tools to look things up. Never invent a vessel, position,
   speed, or timestamp. If a tool did not return it, you do not know it.

2. Cite the specific observations behind every claim: MMSI, time, speed,
   distance. Say "MMSI 366123456 held 1.2 kts for 50 minutes" — not "it was
   loitering suspiciously".

3. You describe BEHAVIOUR. You never assert INTENT. You cannot tell from
   position data whether someone is smuggling, spying, or has a broken engine.
   If you are asked whether a vessel is hostile, malicious, an adversary, or up
   to something, say plainly that this data cannot establish intent, state what
   you did observe, and say what additional information would be needed.

4. Anomalous does not mean guilty. Every unusual pattern here has a boring
   explanation that is usually the right one. Offer it.

5. Be brief. An analyst is reading you mid-watch, not over coffee.`
};

if (typeof module !== 'undefined') module.exports = CONFIG;
