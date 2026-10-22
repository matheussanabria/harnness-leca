const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-code-highlight.js")).href);

test("highlight colore HTML, CSS e JS com as classes tk-* e escapa o resto", async () => {
  const { highlight } = await load();
  const h = highlight('<div class="a">x < y</div><!-- c -->', "html");
  assert.match(h, /<span class="tk-t">&lt;div<\/span>/);
  assert.match(h, /<span class="tk-s">"a"<\/span>/);
  assert.match(h, /<span class="tk-c">&lt;!-- c --&gt;<\/span>/);
  assert.match(highlight(".a { color: #fff; }", "css"), /tk-n">#fff/);
  const js = highlight("import { a } from 'x'; // oi", "js");
  assert.match(js, /tk-k">import/);
  assert.match(js, /tk-c">\/\/ oi/);
  assert.equal(highlight("<b>&", "plain"), "&lt;b&gt;&amp;");
});

test("highlight nunca deixa HTML solto do código passar", async () => {
  const { highlight } = await load();
  for (const lang of ["html", "css", "js", "plain"]) {
    const out = highlight('<img src=x onerror=alert(1)><script>alert(1)</script>', lang);
    assert.ok(!/<img|<script/i.test(out.replace(/<span class="[^"]*">/g, "").replace(/<\/span>/g, "")), lang);
  }
});

test("highlight de CSS colore o nome inteiro da propriedade e o número com a unidade", async () => {
  const { highlight } = await load();
  const h = highlight(".a { margin-bottom: -1px; width: 100%; }", "css");
  assert.match(h, /<span class="tk-a">margin-bottom<\/span>: <span class="tk-n">-1px<\/span>/);
  assert.match(h, /<span class="tk-a">width<\/span>: <span class="tk-n">100%<\/span>/);
});
