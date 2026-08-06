const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('./load.js');

const { renderMarkdown, escapeHtml } = load(['js/markdown.js']);

// --- safety ---------------------------------------------------------------
//
// These are the tests that actually matter. Everything the model writes goes
// through innerHTML, so anything that escapes here becomes script execution.

test('HTML in the model reply is escaped, not executed', () => {
  const out = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!out.includes('<script'), `raw script tag survived: ${out}`);
  assert.ok(out.includes('&lt;script&gt;'));
});

test('an img onerror payload cannot reach the DOM', () => {
  const out = renderMarkdown('<img src=x onerror="alert(1)">');
  assert.ok(!out.includes('<img'), out);
  assert.ok(!/onerror=/.test(out.replace(/&quot;/g, '')) || out.includes('&lt;img'));
});

test('javascript: links are left as plain text', () => {
  const out = renderMarkdown('[click](javascript:alert(1))');
  assert.ok(!out.includes('<a '), `a javascript: URL became a link: ${out}`);
});

test('http links are allowed and open safely', () => {
  const out = renderMarkdown('[NOAA](https://tidesandcurrents.noaa.gov)');
  assert.ok(out.includes('<a href="https://tidesandcurrents.noaa.gov"'));
  assert.ok(out.includes('rel="noopener noreferrer"'));
});

test('quotes and ampersands survive escaping', () => {
  assert.strictEqual(escapeHtml('a & "b" < c'), 'a &amp; &quot;b&quot; &lt; c');
});

// --- formatting -----------------------------------------------------------

test('bold renders and the asterisks disappear', () => {
  const out = renderMarkdown('Speed was **13 kts** at the time.');
  assert.ok(out.includes('<strong>13 kts</strong>'), out);
  assert.ok(!out.includes('**'), 'no literal asterisks may remain');
});

test('italic renders without eating bold', () => {
  const out = renderMarkdown('**bold** and *italic*');
  assert.ok(out.includes('<strong>bold</strong>'), out);
  assert.ok(out.includes('<em>italic</em>'), out);
});

test('bullet lists become real lists', () => {
  const out = renderMarkdown('Findings:\n- one\n- two\n- three');
  assert.ok(out.includes('<ul class="md-list">'), out);
  assert.strictEqual((out.match(/<li>/g) || []).length, 3);
  assert.ok(!out.includes('- one'));
});

test('numbered lists become ordered lists', () => {
  const out = renderMarkdown('1. first\n2. second');
  assert.ok(out.includes('<ol class="md-list">'), out);
  assert.strictEqual((out.match(/<li>/g) || []).length, 2);
});

test('inline code renders', () => {
  const out = renderMarkdown('Edit `js/detect.js` to fix it.');
  assert.ok(out.includes('<code class="md-code">js/detect.js</code>'), out);
});

test('code fences render and are not mangled by other rules', () => {
  const out = renderMarkdown('Try:\n```\nconst a = **b**;\n```');
  assert.ok(out.includes('<pre class="md-pre">'), out);
  assert.ok(out.includes('const a = **b**;'),
    'markdown rules must not reach inside a code fence');
});

test('headings render as a heading, not a hash', () => {
  const out = renderMarkdown('## Watch report');
  assert.ok(out.includes('<div class="md-h">Watch report</div>'), out);
  assert.ok(!out.includes('##'));
});

test('paragraphs are separated', () => {
  const out = renderMarkdown('First para.\n\nSecond para.');
  assert.strictEqual((out.match(/<p>/g) || []).length, 2, out);
});

// --- streaming behaviour --------------------------------------------------

test('a half-arrived bold marker renders as plain text, then bolds', () => {
  // This is what the panel sees mid-stream, token by token.
  const partial = renderMarkdown('Speed was **13 kt');
  assert.ok(!partial.includes('<strong>'), 'must not bold until it closes');
  assert.ok(partial.includes('**13 kt'), partial);

  const complete = renderMarkdown('Speed was **13 kts**.');
  assert.ok(complete.includes('<strong>13 kts</strong>'));
});

test('rendering is stable when called repeatedly on growing input', () => {
  const full = 'Contact **MV KOA SPIRIT** had a gap.\n- entered BRAVO\n- 16 minutes';
  for (let i = 1; i <= full.length; i++) {
    assert.doesNotThrow(() => renderMarkdown(full.slice(0, i)),
      `threw on prefix of length ${i}`);
  }
});

test('an unterminated code fence does not throw', () => {
  assert.doesNotThrow(() => renderMarkdown('here you go:\n```\nconst a = 1;'));
});

test('empty input is safe', () => {
  assert.strictEqual(renderMarkdown('').trim(), '');
});
