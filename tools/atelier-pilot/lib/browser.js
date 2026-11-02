// @ts-check
"use strict";
/**
 * Shared browser launcher for the Atelier pilot tools (playwright-core, no browser download).
 * Order: HARNESS_CHROME_PATH, the default Windows Chrome, then the installed Microsoft Edge.
 */
const fs = require("fs");
const { HERE, mainRepoRoot } = require("./repo-root");

const DEFAULT_CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Loads playwright-core from this checkout, or from the main checkout when running inside a worktree. */
function loadPlaywright() {
  for (const base of [HERE, mainRepoRoot()]) {
    try { return require(require.resolve("playwright-core", { paths: [base] })); } catch { /* try the next base */ }
  }
  throw new Error("playwright-core is not installed. Run: npm install --save-dev --ignore-scripts playwright-core");
}

/** @returns {Promise<{ browser: import("playwright-core").Browser, name: string }>} */
async function launchBrowser() {
  const { chromium } = loadPlaywright();
  const chrome = process.env.HARNESS_CHROME_PATH || DEFAULT_CHROME;
  if (fs.existsSync(chrome)) {
    return { browser: await chromium.launch({ executablePath: chrome, headless: true }), name: "chrome" };
  }
  try {
    return { browser: await chromium.launch({ channel: "msedge", headless: true }), name: "msedge" };
  } catch (err) {
    throw new Error(`No browser found: Chrome is missing at ${chrome} and Edge failed (${String(err.message).split("\n")[0]}). Set HARNESS_CHROME_PATH.`);
  }
}

module.exports = { launchBrowser, loadPlaywright, DEFAULT_CHROME };
