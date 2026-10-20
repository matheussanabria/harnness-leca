#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Captura o site do Design System (dis-design-system.html) já renderizado: topo, menu lateral, CSS e o HTML de
 * cada página, com todas as abas de código expandidas em painéis estáticos.
 * Requer `playwright` (e acesso à internet para o React do site, ou `--react <pasta com react e react-dom 18 UMD>`).
 *
 * Uso: node tools/ds-docs/capture-site.js --source <dis-design-system.html> --out <site-capture.json> [--width 1280] [--react <dir>]
 */
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  return args;
}

/** Roda dentro da página: troca cada bloco `.dx-code` por abas + um painel por aba. */
async function expandCodeBlocks() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const block of [...document.querySelectorAll(".dx-code")]) {
    const tabs = [...block.querySelectorAll(".dx-tab")];
    const panels = [];
    for (const tab of tabs) {
      tab.click();
      await wait(50);
      const note = block.querySelector(".dx-note");
      const pre = block.querySelector(".dx-pre");
      panels.push({ note: note ? note.innerHTML : "", pre: pre ? pre.innerHTML : "" });
    }
    block.querySelectorAll(".dx-note, .dx-pre").forEach((el) => el.remove());
    tabs.forEach((tab, index) => {
      tab.dataset.tab = String(index);
      tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
      tab.removeAttribute("id");
    });
    panels.forEach((panel, index) => {
      const hidden = index === 0 ? "" : " hidden";
      block.insertAdjacentHTML("beforeend", `<div class="dx-panel" data-panel="${index}"${hidden}>${panel.note ? `<div class="dx-note">${panel.note}</div>` : ""}<pre class="dx-pre" tabindex="0"><code>${panel.pre.replace(/^<code>|<\/code>$/g, "")}</code></pre></div>`);
    });
  }
  return document.querySelector(".dx-main").innerHTML;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source || !args.out) throw new Error("Informe --source e --out.");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: Number(args.width) || 1280, height: 900 } });
  if (args.react) {
    await page.route(/react\.production\.min\.js/, (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(args.react, "react/umd/react.production.min.js")) }));
    await page.route(/react-dom\.production\.min\.js/, (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(args.react, "react-dom/umd/react-dom.production.min.js")) }));
  }
  await page.goto(`file://${path.resolve(args.source)}`);
  await page.waitForSelector(".dx-main", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const ids = await page.evaluate(() => [...document.querySelectorAll(".dx-side a")].map((a) => (a.getAttribute("href") || "").slice(1)));
  const out = { width: Number(args.width) || 1280, ids, pages: {} };
  out.styles = await page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent));
  out.top = await page.evaluate(() => document.querySelector(".dx-top").outerHTML);
  out.side = await page.evaluate(() => document.querySelector(".dx-side").outerHTML);
  for (const id of ids) {
    await page.evaluate((hash) => { location.hash = hash; }, id);
    await page.waitForTimeout(450);
    out.pages[id] = await page.evaluate(expandCodeBlocks);
  }
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(out));
  console.log(`${ids.length} páginas capturadas em ${args.out}`);
  await browser.close();
}

main().catch((error) => { console.error(error.message); process.exit(1); });
