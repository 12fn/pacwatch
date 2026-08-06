// Test helper. Not shipped to students.
//
// PACWATCH files are plain browser scripts that share one global scope — no
// imports, no exports, no bundler. That is deliberate: it is what lets the app
// run by double-clicking an HTML file.
//
// To test them in Node we recreate that arrangement: evaluate the requested
// files in a single shared VM context, in the same order index.html loads
// them, and hand back the resulting globals. The app files themselves stay
// completely free of test scaffolding.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/**
 * Evaluate PACWATCH files in one shared context.
 *
 * @param {string[]} files  Paths relative to the repo root, in load order.
 * @param {object}   seed   Extra globals to define before evaluation
 *                          (stub data, fake DOM, etc.)
 * @returns {object} The context, with every global the files defined.
 */
function load(files, seed = {}) {
  const context = vm.createContext(Object.assign({
    console,
    Math,
    JSON,
    Date,
    setTimeout,
    clearTimeout,
    fetch: undefined,
  }, seed));

  const declared = new Set();

  for (const rel of files) {
    const full = path.join(ROOT, rel);
    const code = fs.readFileSync(full, 'utf8');
    vm.runInContext(code, context, { filename: full });

    // `const` and `let` at the top level of a script live in the global
    // LEXICAL scope, which is reachable from other scripts (exactly as in a
    // browser) but never appears as a property of the context object. Collect
    // those names so tests can read them like ordinary properties.
    for (const m of code.matchAll(/^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      declared.add(m[1]);
    }
  }

  for (const name of declared) {
    try {
      context[name] = vm.runInContext(name, context);
    } catch {
      /* declared inside a conditional that did not run — fine to skip */
    }
  }

  return context;
}

/** Load a generated data file (data/*.js) and return its single global. */
function loadData(rel, globalName) {
  const ctx = load([rel]);
  return ctx[globalName];
}

module.exports = { load, loadData, ROOT };
