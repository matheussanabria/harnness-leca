#!/usr/bin/env node
// @ts-check
// E2E for the React island foundation (ADR-011, story 16.00): builds the islands when needed, starts its own UI server
// on a spare port, opens #/lab in headless Edge and checks mount, props, state, unmount on leave and remount.
//   npm run e2e:web            (needs Microsoft Edge; uses playwright-core, already a devDependency)
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.E2E_PORT) || 4399;
const BASE = `http://localhost:${PORT}`;

function ensureBuild() {
  if (fs.existsSync(path.join(ROOT, "ui/public/dist/islands.js"))) return;
  const r = spawnSync("npm", ["run", "build:web"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error("npm run build:web failed");
}

async function waitForServer(timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(BASE + "/")).ok) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`UI server did not answer on ${BASE}`);
}

/** @param {boolean} ok @param {string} label */
function check(ok, label) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  ensureBuild();
  const server = spawn(process.execPath, ["ui/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  /** @type {import("playwright-core").Browser | null} */
  let browser = null;
  try {
    await waitForServer();
    const { chromium } = require("playwright-core");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/#/lab/alpha/beta`);
    await page.waitForSelector("[data-testid=lab-count]", { timeout: 15000 });
    check((await page.textContent("[data-testid=lab-params]")) === "alpha / beta", "route params reach the island");
    check(((await page.textContent("[data-testid=lab-slug]")) || "").length > 0, "project slug reaches the island");

    await page.click(".lab-island__counter");
    await page.click(".lab-island__counter");
    check((await page.textContent("[data-testid=lab-count]")) === "2", "island keeps React state across clicks");

    await page.evaluate(() => { location.hash = "#/chats"; });
    await page.waitForFunction(() => document.getElementById("islandHost")?.hidden === true, null, { timeout: 5000 });
    check((await page.$(".lab-island")) === null, "leaving the route unmounts the island");

    await page.goBack();
    await page.waitForSelector("[data-testid=lab-count]", { timeout: 5000 });
    check((await page.textContent("[data-testid=lab-count]")) === "0", "Back remounts a fresh island");

    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  } finally {
    await browser?.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
