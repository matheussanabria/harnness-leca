const test = require("node:test");
const assert = require("node:assert/strict");
const { injectDataPidAttributes } = require("../ui/server/services/prototype-sanitizer.service");

test("data-pid goes before the slash on self-closing non-void tags (SVG)", () => {
  const out = injectDataPidAttributes('<svg><line x1="1" class="axis"/><rect a="1"/></svg>');
  assert.equal(out, '<svg data-pid="p-1"><line x1="1" class="axis" data-pid="p-2" /><rect a="1" data-pid="p-3" /></svg>');
});

test("void tags keep working, with and without the slash", () => {
  const out = injectDataPidAttributes('<br/><img src="x"><br>');
  assert.equal(out, '<br data-pid="p-1" /><img src="x" data-pid="p-2"><br data-pid="p-3">');
});

test("a path-like unquoted value ending in a slash is not treated as self-closing", () => {
  assert.equal(injectDataPidAttributes("<a href=/docs/>x</a>"), '<a href=/docs/ data-pid="p-1">x</a>');
});

test("old malformed output (slash before data-pid) is repaired and keeps its id", () => {
  const out = injectDataPidAttributes('<svg><line class="axis"/ data-pid="p-28"></svg>');
  assert.equal(out, '<svg data-pid="p-1"><line class="axis" data-pid="p-28" /></svg>');
});

test("running it twice changes nothing", () => {
  const once = injectDataPidAttributes('<div><svg><line class="a"/></svg><br/></div>');
  assert.equal(injectDataPidAttributes(once), once);
});

test("new elements skip ids the screen already has, so two layers never share a data-pid", () => {
  const out = injectDataPidAttributes('<div data-pid="p-1"><span data-pid="p-2"></span><button id="b"></button><i></i></div>');
  assert.equal(out, '<div data-pid="p-1"><span data-pid="p-2"></span><button id="b" data-pid="p-3"></button><i data-pid="p-4"></i></div>');
});

test("a repeated data-pid gets a fresh id and the first one keeps its own", () => {
  const out = injectDataPidAttributes('<main data-pid="p-1"><button data-pid="p-1" id="b">x</button><br data-pid="p-1"/></main>');
  assert.equal(out, '<main data-pid="p-1"><button id="b" data-pid="p-2">x</button><br data-pid="p-3" /></main>');
  assert.equal(injectDataPidAttributes(out), out);
});
