# How the agent works

Everything people mean by "agentic AI" is in `js/agent.js`, and it is about
sixty lines. This page explains them, assuming you have never seen this before.

---

## The problem

A language model predicts text. It has no access to your data, and if you ask it
about your data it will produce something that reads like an answer. Ask it how
many fishing vessels are on the display and it will say "six" with total
confidence, having counted nothing.

You could paste all the data into the prompt. For forty vessels with 121
positions each that is about 170 KB of numbers, on every single message. Slow,
expensive, and it makes the answers *worse* — the model has to find the needle
itself instead of asking someone who knows where it is.

## The fix: give it a phone, not a filing cabinet

Instead of sending the data, you send **a list of questions it is allowed to
ask.** That list is the tool schemas in `js/tools.js`:

```js
{
  name: 'list_vessels',
  description: 'List vessels currently on the display, with optional filters.',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'cargo, tanker, fishing, ...' },
      max_sog: { type: 'number', description: 'maximum speed in knots' },
    },
  },
}
```

That is a menu. The model reads it and works out that if it wants fishing
vessels it should call `list_vessels` with `{"type": "fishing"}`.

**The description is not documentation, it is instruction.** It is the only
thing the model knows about your tool. A vague description produces a model that
calls the wrong tool with the wrong arguments, and the fix is almost always to
write a better sentence rather than to write more code.

## The loop

```
   ┌──────────────────────────────────────────┐
   │  send: conversation + tool menu          │
   └──────────────────┬───────────────────────┘
                      ▼
              did it ask for a tool?
                  │           │
                 no          yes
                  │           │
                  ▼           ▼
             show the    run the function
              answer     in the browser
                              │
                              ▼
                    append the result to
                     the conversation
                              │
                              └──── go back to the top
```

Four steps. In code:

```js
for (let round = 0; round < CONFIG.maxToolIterations; round++) {
  const msg = await askTheModel(AgentState.messages);

  if (!msg.tool_calls) {            // it answered
    return msg.content;
  }

  for (const call of msg.tool_calls) {              // it asked
    const result = callTool(call.function.name,
                            JSON.parse(call.function.arguments));
    AgentState.messages.push({ role: 'tool', content: JSON.stringify(result) });
  }
}
```

That is the whole thing. "The agent decided to check the zone" means the second
branch happened. There is no planner, no reasoning engine, no memory system.
There is a loop.

## Watch it happen

Ask the assistant:

> Has any vessel stopped reporting, and if so did it happen near a restricted
> area?

Two boxes appear before the answer. Expand them. You will see it call
`list_vessels` with `{"not_reporting": true}`, read the result, then call
`check_zone` with the MMSI it just learned about — an argument it could not have
known when it started.

That is the part worth understanding. The model is not executing a script you
wrote. It is choosing what to look up next based on what it just found out.

## Why the answer types itself out

We send `stream: true`, so the reply does not come back as one lump of JSON. It
arrives as a series of small frames, one per fragment of text:

```
data: {"choices":[{"delta":{"content":"Six"}}]}
data: {"choices":[{"delta":{"content":" fishing"}}]}
data: [DONE]
```

`readStream` in `js/agent.js` stitches those back together and hands each piece
to the chat panel as it lands. **The model is not any faster this way** — you
are just watching it work instead of staring at a spinner until it finishes.

Tool calls stream too, and this is the part that catches people out. The
arguments arrive in pieces, each tagged with the index of the call it belongs
to:

```
{"tool_calls":[{"index":0,"function":{"arguments":"{\""}}]}
{"tool_calls":[{"index":0,"function":{"arguments":"type"}}]}
{"tool_calls":[{"index":0,"function":{"arguments":"\":\"fishing\"}"}}]}
```

You cannot act on a half-arrived argument, so we glue the fragments together
and only run the tool once the stream ends. If you ever build one of these
yourself, that is the bug you will hit.

## Why the loop has a limit

`CONFIG.maxToolIterations` is 6. Without it, a model that has misunderstood the
question can call tools forever, and you will find out when you read your bill.

Any agent you deploy needs a stop condition. Ours is a counter, which is the
crudest one that works.

## Why tool results are small

`list_vessels` returns summary rows — never full tracks. Everything the tool
returns goes into the conversation and gets re-sent on every subsequent turn, so
a chatty tool costs you on every message afterwards, not just once.

Design tools to answer questions, not to export tables.

## Errors are information

If a tool throws, we do not crash. We hand the error back:

```js
try {
  result = callTool(name, args);
} catch (err) {
  result = { error: String(err.message) };
}
```

The model reads `{"error": "no vessel with MMSI 1"}` and usually recovers on its
own — looks up the real MMSI, tries again. Crashing on a bad argument would turn
a self-correcting system into a broken one.

## What you now know

- An "AI agent" is a loop around a chat API.
- "Tools" are functions you wrote, described in a sentence.
- The model never touches your data; it asks, and your code answers.
- The interesting engineering is in the tool boundary — what you expose, what
  you return, how you describe it — not in the model.
- Everything worth controlling is controlled by ordinary code and plain English.

The next time somebody demos an agent, ask them what its tools are and what
happens when one fails. Those two questions will tell you most of what you need
to know about whether it is real.
