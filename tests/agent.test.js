const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

const ctx = load([
  'data/scenario.js',
  'data/geo-coast.js',
  'data/geo-zones.js',
  'data/geo-assets.js',
  'config.example.js',
  'js/geo.js',
  'js/detect.js',
  'js/map.js',
  'js/replay.js',
  'js/tools.js',
  'js/markdown.js',
  'js/agent.js',
], {
  App: { findings: [], selectedMmsi: null, t: 60 },
  window: { addEventListener() {}, dispatchEvent() {} },
  document: { getElementById: () => null },
  TextDecoder,
  TextEncoder,
});

const { runAgent, AgentState, readStream } = ctx;

// --- fake streaming transport ---------------------------------------------
//
// The real endpoint returns server-sent events. These helpers build the same
// wire format so the loop can be tested with no network and no API key.

function frame(delta) {
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
}

/** Turn a list of raw SSE strings into a fetch-shaped streaming response. */
function sseResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { done: false, value: encoder.encode(chunks[i++]) }
          : { done: true, value: undefined }),
      }),
    },
  };
}

function transportFor(responses) {
  let i = 0;
  return async () => sseResponse(responses[Math.min(i++, responses.length - 1)]);
}

/** A streamed plain-text answer, split into several fragments. */
function answers(text) {
  const parts = text.match(/.{1,7}/g) || [text];
  return [...parts.map(p => frame({ content: p })), 'data: [DONE]\n\n'];
}

/** A streamed tool call, with the arguments arriving in pieces. */
function wantsTool(name, args) {
  const json = JSON.stringify(args);
  const pieces = json.match(/.{1,4}/g) || [json];
  return [
    frame({ role: 'assistant', content: null,
            tool_calls: [{ index: 0, id: 'c1', type: 'function',
                           function: { name, arguments: '' } }] }),
    ...pieces.map(p => frame({ tool_calls: [{ index: 0, function: { arguments: p } }] })),
    'data: [DONE]\n\n',
  ];
}

function reset() { AgentState.messages.length = 0; }

// --- streaming ------------------------------------------------------------

test('text arrives as deltas, not one lump', async () => {
  reset();
  const seen = [];
  const out = await runAgent('hi', e => { if (e.type === 'delta') seen.push(e.text); },
    transportFor([answers('Six fishing vessels are active.')]));

  assert.strictEqual(out, 'Six fishing vessels are active.');
  assert.ok(seen.length > 1, `expected several deltas, got ${seen.length}`);
  assert.strictEqual(seen.join(''), 'Six fishing vessels are active.',
    'the deltas must reassemble into exactly the final answer');
});

test('deltas are emitted before the answer event', async () => {
  reset();
  const order = [];
  await runAgent('hi', e => order.push(e.type), transportFor([answers('hello there')]));
  assert.strictEqual(order[0], 'delta');
  assert.strictEqual(order[order.length - 1], 'answer');
});

test('a frame split across two network reads is reassembled', async () => {
  reset();
  // Cut one SSE frame in half at an arbitrary byte, as a real socket would.
  const whole = frame({ content: 'streamed' }) + 'data: [DONE]\n\n';
  const cut = Math.floor(whole.length / 2);
  const out = await runAgent('hi', () => {},
    transportFor([[whole.slice(0, cut), whole.slice(cut)]]));
  assert.strictEqual(out, 'streamed');
});

test('a malformed frame does not kill the answer', async () => {
  reset();
  const out = await runAgent('hi', () => {}, transportFor([[
    frame({ content: 'good ' }),
    'data: {not json at all}\n\n',
    frame({ content: 'still good' }),
    'data: [DONE]\n\n',
  ]]));
  assert.strictEqual(out, 'good still good');
});

// --- tool calling over the stream -----------------------------------------

test('fragmented tool arguments are glued back together', async () => {
  reset();
  const events = [];
  const out = await runAgent('how many fishing vessels?', e => events.push(e),
    transportFor([wantsTool('list_vessels', { type: 'fishing' }),
                  answers('Six fishing vessels are active.')]));

  assert.strictEqual(out, 'Six fishing vessels are active.');
  const toolEvents = events.filter(e => e.type === 'tool');
  assert.strictEqual(toolEvents.length, 1);
  assert.strictEqual(toolEvents[0].name, 'list_vessels');
  assert.strictEqual(toolEvents[0].args, '{"type":"fishing"}',
    'arguments arrive in pieces and must be concatenated in order');
  assert.ok(toolEvents[0].result.count > 0, 'the tool ran against real data');
  assert.ok(toolEvents[0].result.vessels.every(v => v.type === 'fishing'));
});

test('tool results are appended for the model to read', async () => {
  reset();
  await runAgent('x', () => {},
    transportFor([wantsTool('list_vessels', {}), answers('done')]));
  assert.ok(AgentState.messages.map(m => m.role).includes('tool'));
});

test('a bad tool name is reported to the model instead of crashing', async () => {
  reset();
  const events = [];
  const out = await runAgent('x', e => events.push(e),
    transportFor([wantsTool('does_not_exist', {}), answers('recovered')]));
  assert.strictEqual(out, 'recovered');
  assert.match(events.find(e => e.type === 'tool').result.error, /unknown tool/);
});

test('malformed tool arguments do not crash the loop', async () => {
  reset();
  const broken = [
    frame({ role: 'assistant', content: null,
            tool_calls: [{ index: 0, id: 'c1', type: 'function',
                           function: { name: 'list_vessels', arguments: '{not json' } }] }),
    'data: [DONE]\n\n',
  ];
  const out = await runAgent('x', () => {}, transportFor([broken, answers('ok')]));
  assert.strictEqual(out, 'ok');
});

test('the loop stops instead of spinning forever', async () => {
  reset();
  const out = await runAgent('x', () => {},
    transportFor([wantsTool('list_vessels', {})]));
  assert.match(out, /could not finish|allowed number of steps/i);
});

// --- request shape --------------------------------------------------------

test('an HTTP failure surfaces as an error the panel can show', async () => {
  reset();
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => runAgent('x', () => {}, failing), /HTTP 503/);
});

test('the request asks for streaming, tools, and the system prompt', async () => {
  reset();
  let seen = null;
  await runAgent('hello', () => {}, async (url, opts) => {
    seen = JSON.parse(opts.body);
    return sseResponse(answers('hi'));
  });
  assert.strictEqual(seen.stream, true, 'streaming must be requested');
  assert.strictEqual(seen.messages[0].role, 'system');
  assert.match(seen.messages[0].content, /never assert INTENT/i);
  assert.strictEqual(seen.tools.length, 5, 'tools must be offered on every turn');
});

test('model-specific extraBody is merged into the request', async () => {
  // gpt-5.6-luna rejects function tools unless reasoning_effort is 'none'.
  // If this regresses, every chat message fails in front of the room.
  reset();
  let seen = null;
  await runAgent('hello', () => {}, async (url, opts) => {
    seen = JSON.parse(opts.body);
    return sseResponse(answers('hi'));
  });
  assert.strictEqual(seen.reasoning_effort, 'none',
    'CONFIG.extraBody must reach the request body');
  assert.strictEqual(seen.model, 'gpt-5.6-luna');
});
