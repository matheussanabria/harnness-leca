#!/usr/bin/env node
// @ts-check
// E2E of the launcher (EP-25.05, docs/features/launcher/02-bdd.feature CP-01 to CP-07): own UI server on a spare port
// with a temp projects dir and database, headless Edge, screenshots at 1440, 768 and 390 pixels.
//   npm run e2e:launcher   (needs Microsoft Edge; builds the islands when needed; SHOTS_DIR chooses where PNGs go)
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.E2E_PORT) || 4398;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), "launcher-shots");

function ensureBuild() {
  if (fs.existsSync(path.join(ROOT, "ui/public/dist/islands.js"))) return;
  if (spawnSync("npm", ["run", "build:web"], { cwd: ROOT, stdio: "inherit", shell: true }).status !== 0) throw new Error("npm run build:web failed");
}

async function waitForServer(timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(`${BASE}/funcionalidades`)).ok) return; } catch { /* not up yet */ }
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
  fs.mkdirSync(SHOTS, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-e2e-"));
  for (const slug of ["alfa", "beta"]) fs.mkdirSync(path.join(tmp, "projects", slug), { recursive: true });
  const env = { ...process.env, PORT: String(PORT), HARNESS_PROJECTS_DIR: path.join(tmp, "projects"), HARNESS_DB_PATH: path.join(tmp, "h.sqlite"), HARNESS_ENGINE_HOST: "0" };
  const server = spawn(process.execPath, ["ui/server.js"], { cwd: ROOT, env, stdio: "ignore" });
  /** @type {import("playwright-core").Browser | null} */
  let browser = null;
  try {
    await waitForServer();
    const { chromium } = require("playwright-core");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = /** @type {string[]} */ ([]);
    const headers = /** @type {string[]} */ ([]);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (req) => { if (req.url().endsWith("/api/features")) headers.push(req.headers()["x-harness-project"] ?? ""); });
    const card = (/** @type {string} */ title) => page.locator(".launcher-card", { hasText: title });

    await page.goto(`${BASE}/funcionalidades`);
    await page.waitForSelector(".launcher-group");
    const groups = await page.locator(".launcher-group h2").allTextContents();
    check(JSON.stringify(groups) === JSON.stringify(["Criar e conversar", "Do projeto", "Geral"]), "CP-01 three groups in order");
    const creation = await page.locator(".launcher-group").first().locator("h3").allTextContents();
    check(["Chat universal", "Ateliê", "Mapa mental", "Quadro livre", "Diagramas"].every((t) => creation.includes(t)), "CP-01 creation group has chat, Ateliê, mind map, free board, diagrams");

    check((await card("Scrum e sprints").getAttribute("aria-disabled")) === "true", "CP-02 Scrum is disabled without a project");
    check(((await page.textContent("#why-scrum")) || "").includes("Escolha um projeto para usar esta funcionalidade"), "CP-02 Scrum shows the reason");
    check((await card("Ateliê").getAttribute("aria-disabled")) === "true" && ((await page.textContent("#why-atelie")) || "").includes("Em breve"), "planned features read 'Em breve'");
    // aria-disabled cards stay clickable for real users (they explain why); Playwright needs force to click them
    await card("Scrum e sprints").click({ force: true });
    check(((await page.textContent(".launcher-toast")) || "").includes("Escolha um projeto"), "CP-02 clicking a blocked card explains why");

    await page.keyboard.press("Control+k");
    check(await page.locator("input[role=combobox]").evaluate((el) => el === document.activeElement), "CP-05 Ctrl+K focuses the search");
    await page.keyboard.type("alf");
    check((await page.locator("[role=option]").count()) === 1, "CP-05 the search filters the list");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".launcher-btn__label")?.textContent === "alfa");
    check(await page.locator(".launcher-btn[aria-haspopup]").evaluate((el) => el === document.activeElement), "CP-05 focus returns to the picker button");
    await page.waitForFunction(() => document.querySelector("#why-scrum") === null);
    check((await card("Scrum e sprints").getAttribute("aria-disabled")) === null, "CP-04 choosing a project enables Scrum");
    check(headers.at(-1) === "alfa", "CP-04 the request carries the project header");

    await page.reload();
    await page.waitForSelector(".launcher-group");
    check((await page.textContent(".launcher-btn__label")) === "alfa", "the chosen project is remembered");

    await page.click(".launcher-btn[aria-haspopup]");
    await page.mouse.click(5, 300);
    check((await page.locator("input[role=combobox]").count()) === 0, "clicking outside closes the picker");

    await page.click(".launcher-btn[aria-haspopup]");
    await page.locator("[role=option]", { hasText: "Sem projeto" }).click();
    await page.waitForFunction(() => document.querySelector("#why-scrum") !== null);
    check(headers.at(-1) === "none", "CP-03 'Sem projeto' sends the 'none' header");
    for (const [title, route] of [["Mapa mental", "/mapa-mental"], ["Quadro livre", "/quadro-livre"], ["Diagramas", "/diagramas"]]) {
      await Promise.all([page.waitForURL((u) => u.pathname === route && u.searchParams.get("p") === "_pessoal"), card(title).click()]);
      check(true, `EP-25.12 ${title} opens at ${route} in the personal scope`);
      await page.goto(`${BASE}/funcionalidades`);
      await page.waitForSelector(".launcher-group");
    }
    check((await card("Ateliê").getAttribute("aria-disabled")) === "true", "Ateliê stays 'Em breve' until story 25.10");
    await Promise.all([page.waitForURL(/\/escritorio/), card("Chat universal").click()]);
    check(page.url().includes("/escritorio#chat"), "CP-03 Chat opens in one click without a project");

    await page.route("**/api/features", (route) => route.abort());
    await page.goto(`${BASE}/funcionalidades`);
    await page.waitForSelector(".launcher-state.is-error");
    check(true, "CP-06 failure shows the error state");
    await page.unroute("**/api/features");
    await page.click("text=Tentar de novo");
    await page.waitForSelector(".launcher-group");
    check(true, "CP-06 'Tentar de novo' recovers");
    await page.route("**/api/features", async (route) => { await new Promise((r) => setTimeout(r, 1200)); await route.continue(); });
    await page.reload();
    await page.waitForSelector(".launcher-skel", { timeout: 3000 });
    check(true, "CP-06 skeleton while loading");
    await page.unroute("**/api/features");
    await page.waitForSelector(".launcher-group");

    for (const [name, width, height] of [["1440", 1440, 900], ["768", 768, 1024], ["390", 390, 844]]) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      check(!overflow, `CP-07 no horizontal scroll at ${name}px`);
      await page.screenshot({ path: path.join(SHOTS, `launcher-${name}.png`), fullPage: true });
    }
    await page.click(".launcher-btn[aria-haspopup]");
    await page.screenshot({ path: path.join(SHOTS, "launcher-390-picker.png") });

    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
    console.log(`screenshots in ${SHOTS}`);
  } finally {
    await browser?.close();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
