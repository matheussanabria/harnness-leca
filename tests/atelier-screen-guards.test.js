"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateScreenHtml } = require("../ui/server/services/atelier-screen-guards.service");
const { injectDataPidAttributes } = require("../ui/server/services/prototype-sanitizer.service");

test("injection leaves script bodies untouched and repairs leaked data-pid", () => {
  const out = injectDataPidAttributes("<div><script>if(a>=0&&b.length>1){x()}</script></div>");
  assert.equal(out, '<div data-pid="p-1"><script data-pid="p-2">if(a>=0&&b.length>1){x()}</script></div>');
  const fixed = injectDataPidAttributes('<script>k(economia data-pid="p-67">=0)</script>');
  assert.ok(fixed.includes("k(economia>=0)"));
});

test("guard rejects leaked <tool> tags", () => {
  assert.match(validateScreenHtml('<div>x</div><tool name="atelier_write_screen"><div></div>'), /<tool>/);
});

test("guard rejects duplicated lp-app roots", () => {
  assert.match(validateScreenHtml('<div class="lp-app"></div><div class="lp-app"></div>'), /duplicado/);
});

test("guard rejects inline scripts with syntax errors and accepts valid ones", () => {
  assert.match(validateScreenHtml("<script>var a = 'x</script>"), /sintaxe/);
  assert.equal(validateScreenHtml('<div class="lp-app"></div><script>var a=1;</script>'), null);
});

test("guard rejects direct localStorage use but accepts the LPS wrapper", () => {
  assert.match(validateScreenHtml("<script>localStorage.setItem('a','b')</script>"), /sandbox/);
  assert.match(validateScreenHtml("<script>var s=sessionStorage.getItem('a')</script>"), /sandbox/);
  const wrapped =
    "<script>window.LPS=window.LPS||(function(){var ls=null;try{ls=window.localStorage;ls.getItem('x')}catch(e){ls=null}" +
    "return{getItem:function(k){return null}}})();LPS.getItem('a')</script>";
  assert.equal(validateScreenHtml(wrapped), null);
});
