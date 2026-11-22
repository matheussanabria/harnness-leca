// @ts-check
// `npm run host:restart` (EP-23.05): asks the running engine host to drain and restart, prints progress, and past
// the drain limit asks in the terminal whether to force (the active runs end as interrupted).
//   node ui/engine-host.js --restart [--force] [--cancel]
const readline = require("readline");
const { hostUrl, readToken, TOKEN_HEADER } = require("./protocol");

const POLL_MS = 1000;
const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string} token @param {"GET"|"POST"} method @param {Record<string, unknown>} [body] */
async function call(token, method, body) {
  const res = await fetch(`${hostUrl()}/admin/restart`, {
    method,
    headers: { [TOKEN_HEADER]: token, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
  });
  if (!res.ok) throw new Error(`host answered ${res.status}`);
  return res.json();
}

/** @param {string} question @returns {Promise<boolean>} */
function confirm(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(/^s(im)?$|^y(es)?$/i.test(answer.trim())); }));
}

/** @param {string[]} argv @param {{ log?: (line: string) => void, ask?: (q: string) => Promise<boolean> }} [io] */
async function restartRunningHost(argv, { log = console.log, ask = confirm } = {}) {
  const token = readToken();
  if (!token) return log("[engine-host] no token file: the host never started here");
  try {
    if (argv.includes("--cancel")) return log(`[engine-host] restart cancelled (${(await call(token, "POST", { cancel: true })).state})`);
    let status = await call(token, "POST", argv.includes("--force") ? { force: true } : {});
    let lastActive = -1;
    while (status.state === "draining" || status.state === "timed-out") {
      if (status.active !== lastActive) log(`[engine-host] draining: waiting for ${status.active} run(s) to finish`);
      lastActive = status.active;
      if (status.state === "timed-out") {
        const minutes = Math.round(status.limitMs / 60000);
        const force = await ask(`[engine-host] ${status.active} run(s) still active after ${minutes} min. Force the restart and interrupt them? (s/N) `);
        status = await call(token, "POST", force ? { force: true } : { cancel: true });
        if (!force) return log("[engine-host] restart cancelled; the host accepts new runs again");
        break;
      }
      await sleep(POLL_MS);
      status = await call(token, "GET");
    }
    log("[engine-host] restarting");
  } catch (error) {
    log(`[engine-host] not running or not reachable (${/** @type {any} */ (error).message})`);
  }
}

module.exports = { restartRunningHost };
