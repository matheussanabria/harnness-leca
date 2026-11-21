// @ts-check
"use strict";
/**
 * Capture side of a motion export (EP-24.05): opens the rendered screen of the harness itself at top level, waits for
 * fonts and images (window.__harnessMotion.ready, EP-24.02), then seeks frame by frame and screenshots each one.
 * The page may only load its own origin and the font/icon CDNs the sandbox CSP already allows.
 */

const CDN_ORIGINS = ["https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"];

/**
 * @param {import("playwright-core").Browser} browser
 * @param {{ url: string, width: number, height: number, scale: number }} options
 */
async function openScreen(browser, { url, width, height, scale }) {
  const own = new URL(url).origin;
  const allowed = new Set([own, ...CDN_ORIGINS]);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith("data:") || target.startsWith("blob:")) return route.continue();
    let origin = "";
    try { origin = new URL(target).origin; } catch { /* invalid URL */ }
    return allowed.has(origin) ? route.continue() : route.abort();
  });
  const response = await page.goto(url, { waitUntil: "load", timeout: 30000 });
  if (!response || !response.ok()) throw new Error(`Render failed (${response ? response.status() : "no response"}).`);
  const hasRuntime = await page.evaluate(() => Boolean(/** @type {any} */ (window).__harnessMotion));
  if (!hasRuntime) throw new Error("The screen has no valid timeline (the motion runtime was not injected).");
  await page.evaluate(() => /** @type {any} */ (window).__harnessMotion.ready);
  return {
    /** @returns {Promise<number>} */
    duration: () => page.evaluate(() => /** @type {any} */ (window).__harnessMotion.duration()),
    /** Seeks to `ms` (the runtime waits two animation frames) and returns a PNG of the viewport. @param {number} ms */
    shot: async (ms) => {
      await page.evaluate((t) => /** @type {any} */ (window).__harnessMotion.seek(t), ms);
      return page.screenshot({ type: "png", animations: "allow", caret: "initial" });
    },
    close: () => context.close().catch(() => undefined),
  };
}

module.exports = { openScreen, CDN_ORIGINS };
