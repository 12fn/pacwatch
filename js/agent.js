// ==========================================================================
// THE AGENT LOOP
//
// This is the part everyone means when they say "agentic", and it is sixty
// lines of ordinary JavaScript. There is no magic in here. Read it once and
// you will know how every AI agent you have heard of actually works.
//
// The loop:
//
//   1. Send the conversation, plus the list of tools, to the model.
//   2. If the model replies with text, we are done. Show it.
//   3. If the model instead asks to call a tool, run that tool right here in
//      the browser, append the result to the conversation, and go back to 1.
//   4. Stop after a few rounds so a confused model cannot spin forever.
//
// That is it. "The agent decided to check the zone" means step 3 happened.
// ==========================================================================

const AgentState = {
  messages: [],
  busy: false,
};

async function runAgent(userText, onEvent, transport) {
  const send = transport || ((url, opts) => fetch(url, opts));

  AgentState.messages.push({ role: 'user', content: userText });

  for (let round = 0; round < CONFIG.maxToolIterations; round++) {
    const res = await send(CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.apiKey,
      },
      body: JSON.stringify(Object.assign({
        model: CONFIG.model,
        messages: [{ role: 'system', content: CONFIG.systemPrompt }, ...AgentState.messages],
        tools: toolSchemas(),
        stream: true,
      }, CONFIG.extraBody || {})),
    });

    if (!res.ok) throw new Error('model request failed: HTTP ' + res.status);

    const msg = await readStream(res, onEvent);
    AgentState.messages.push(msg);

    // No tool calls means the model is answering. We are done.
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      onEvent({ type: 'answer', text: msg.content || '' });
      return msg.content || '';
    }

    // Otherwise: run what it asked for and hand back the results.
    for (const call of msg.tool_calls) {
      let result;
      try {
        result = callTool(call.function.name, JSON.parse(call.function.arguments || '{}'));
      } catch (err) {
        // A bad tool call is information, not a crash. Tell the model what
        // went wrong and let it try something else — which it usually does.
        result = { error: String(err.message) };
      }
      onEvent({
        type: 'tool',
        name: call.function.name,
        args: call.function.arguments,
        result,
      });
      AgentState.messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  const bail = 'I could not finish that within the allowed number of steps. ' +
               'Try asking for one thing at a time.';
  onEvent({ type: 'answer', text: bail });
  return bail;
}

// --------------------------------------------------------------------------
// READING THE STREAM
//
// We ask for `stream: true`, so the answer does not arrive as one lump of
// JSON. It arrives as a series of small "server-sent events" — one per
// fragment of text — which is why you see the reply typing itself out instead
// of appearing all at once. The model is not faster; you are just watching it
// work rather than waiting for it to finish.
//
// Each frame looks like:
//
//   data: {"choices":[{"delta":{"content":" two"}}]}
//
// and the last one is literally `data: [DONE]`.
//
// The fiddly part is tool calls. Those stream too, and the arguments arrive in
// pieces — `{"` then `type` then `":"` then `fishing` — each tagged with the
// index of the call it belongs to. So we cannot act on them until the stream
// ends; we glue the fragments back together first.
// --------------------------------------------------------------------------

async function readStream(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const message = { role: 'assistant', content: '', tool_calls: [] };
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line. Anything after the last blank
    // line is a partial frame — keep it for the next read.
    const frames = buffer.split('\n\n');
    buffer = frames.pop();

    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let delta;
      try {
        delta = JSON.parse(payload).choices[0].delta;
      } catch {
        continue;   // a malformed frame is not worth killing the answer over
      }
      if (!delta) continue;

      if (delta.content) {
        message.content += delta.content;
        onEvent({ type: 'delta', text: delta.content });
      }

      for (const part of (delta.tool_calls || [])) {
        const slot = message.tool_calls[part.index] ||
          (message.tool_calls[part.index] =
            { id: '', type: 'function', function: { name: '', arguments: '' } });
        if (part.id) slot.id = part.id;
        if (part.function && part.function.name) slot.function.name = part.function.name;
        if (part.function && part.function.arguments) {
          slot.function.arguments += part.function.arguments;
        }
      }
    }
  }

  message.tool_calls = message.tool_calls.filter(Boolean);
  if (!message.tool_calls.length) delete message.tool_calls;
  return message;
}

// --------------------------------------------------------------------------
// The chat panel
// --------------------------------------------------------------------------

const OPENERS = [
  'What is the current picture?',
  'Which vessels are not reporting right now?',
  'Any vessels worth a closer look?',
];

function initAgent() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const log = document.getElementById('chat-log');

  addNotice(
    `Ask about the traffic. The assistant can only see what it looks up with ` +
    `its tools — every lookup is shown below so you can check its work.`,
    OPENERS);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || AgentState.busy) return;

    input.value = '';
    addMessage('user', text);
    setBusy(true);

    const thinking = document.createElement('div');
    thinking.className = 'thinking';
    thinking.textContent = 'Working';
    log.appendChild(thinking);
    scrollChat();

    try {
      await runAgent(text, (ev) => {
        // The first token is the signal that it has stopped thinking.
        if (ev.type === 'delta' || ev.type === 'tool') thinking.remove();

        if (ev.type === 'delta') appendDelta(ev.text);
        if (ev.type === 'tool') { endStream(); addToolCall(ev); }
        if (ev.type === 'answer') endStream(ev.text);
      });
    } catch (err) {
      endStream();
      addNotice(
        `<strong>No answer from the model.</strong> ${escapeHtml(String(err.message))}<br>` +
        `The chart, the replay and the detectors all still work — those run entirely ` +
        `on your machine. Only this panel needs the network.`);
    } finally {
      thinking.remove();
      setBusy(false);
    }
  });
}

function setBusy(busy) {
  AgentState.busy = busy;
  document.getElementById('chat-send').disabled = busy;
}

// The bubble currently being typed into, and the raw markdown behind it.
let streamingEl = null;
let streamingText = '';

// Called once per fragment as it arrives off the wire. We re-render the whole
// reply each time rather than appending, because markdown is only meaningful
// once its closing marker shows up — a half-written `**` has to sit there as
// two asterisks until its partner arrives, then become bold.
function appendDelta(text) {
  if (!streamingEl) {
    streamingEl = document.createElement('div');
    streamingEl.className = 'msg msg--bot msg--streaming';
    document.getElementById('chat-log').appendChild(streamingEl);
    streamingText = '';
  }
  streamingText += text;
  streamingEl.innerHTML = renderMarkdown(streamingText);
  scrollChat();
}

// Close off the bubble: drop the caret, render the authoritative final text,
// and make MMSIs clickable. Linking only now keeps us from rebuilding
// handlers on every single token.
function endStream(finalText) {
  if (!streamingEl) {
    if (finalText) addMessage('bot', finalText);
    return;
  }
  const el = streamingEl;
  streamingEl = null;
  el.classList.remove('msg--streaming');
  if (finalText) el.innerHTML = renderMarkdown(finalText);
  linkifyMmsi(el);
}

function addMessage(who, text) {
  const log = document.getElementById('chat-log');
  const el = document.createElement('div');
  el.className = `msg msg--${who === 'user' ? 'user' : 'bot'}`;

  if (who === 'user') {
    el.textContent = text;               // never render the user's own markdown
  } else {
    el.innerHTML = renderMarkdown(text);
    linkifyMmsi(el);
  }
  log.appendChild(el);
  scrollChat();
}

// Make MMSIs clickable so an answer connects back to the chart.
//
// This walks the rendered text nodes rather than running a regex over the
// HTML string — a regex would happily match the digits inside an attribute
// and shred the markup.
function linkifyMmsi(root) {
  const texts = [];
  (function walk(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) texts.push(child);
      else if (child.nodeType === 1 && child.tagName !== 'CODE') walk(child);
    }
  })(root);

  for (const node of texts) {
    if (!/\b\d{9}\b/.test(node.nodeValue)) continue;
    const holder = document.createElement('span');
    holder.innerHTML = escapeHtml(node.nodeValue)
      .replace(/\b(\d{9})\b/g, '<span class="mmsi" data-mmsi="$1">$1</span>');
    node.parentNode.replaceChild(holder, node);
  }

  root.querySelectorAll('.mmsi').forEach(node => {
    node.addEventListener('click', () => selectVessel(Number(node.dataset.mmsi)));
  });
}

function addToolCall(ev) {
  const log = document.getElementById('chat-log');
  const el = document.createElement('details');
  el.className = 'toolcall';

  let args = ev.args || '{}';
  try { args = JSON.stringify(JSON.parse(args)); } catch { /* leave as-is */ }

  el.innerHTML =
    `<summary class="toolcall__head">${escapeHtml(ev.name)}` +
    `<span class="toolcall__args">${escapeHtml(args)}</span></summary>` +
    `<pre class="toolcall__body">${escapeHtml(JSON.stringify(ev.result, null, 1))}</pre>`;
  log.appendChild(el);
  scrollChat();
}

function addNotice(html, suggestions) {
  const log = document.getElementById('chat-log');
  const el = document.createElement('div');
  el.className = 'notice';
  el.innerHTML = html;

  if (suggestions) {
    for (const s of suggestions) {
      const b = document.createElement('div');
      b.className = 'msg--bot';
      b.style.cssText = 'margin-top:7px;cursor:pointer;color:#7fd4c1;font-size:12px';
      b.textContent = '› ' + s;
      b.addEventListener('click', () => {
        document.getElementById('chat-input').value = s;
        document.getElementById('chat-form')
          .dispatchEvent(new Event('submit', { cancelable: true }));
      });
      el.appendChild(b);
    }
  }
  log.appendChild(el);
  scrollChat();
}

function scrollChat() {
  const log = document.getElementById('chat-log');
  log.scrollTop = log.scrollHeight;
}

// escapeHtml lives in js/markdown.js — same shared global scope.
