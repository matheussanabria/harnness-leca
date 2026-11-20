// Preloaded into the engine host by tests/engine-host.test.js (node -r): registers a fake engine and, when
// HARNESS_TEST_SQL_LOG is set, records every write statement prepared on data/harness.sqlite (EP-23.03 RF3a).
const fs = require("fs");
const E = require("../../tools/lib/engines");

// Prompt "chunks=N delay=M": N text chunks M ms apart, then done. Stops on abort.
E.engines.set("fakehost", {
  id: "fakehost",
  stream({ prompt, signal, onChunk, onDone }) {
    const chunks = Number(/chunks=(\d+)/.exec(prompt)?.[1] || 3);
    const delay = Number(/delay=(\d+)/.exec(prompt)?.[1] || 20);
    let sent = 0;
    const timer = setInterval(() => {
      if (signal.aborted) return clearInterval(timer);
      onChunk({ type: "text", text: `c${sent}`, ts: Date.now() }); // ts lets a benchmark measure relay latency
      sent += 1;
      if (sent >= chunks) {
        clearInterval(timer);
        onDone({ text: "fim" });
      }
    }, delay);
  },
});

const logFile = process.env.HARNESS_TEST_SQL_LOG;
if (logFile) {
  const { DatabaseSync } = require("node:sqlite");
  const WRITE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
  const target = String(process.env.HARNESS_DB_PATH || "").toLowerCase();
  const record = (db, sql) => {
    let location = "";
    try { location = String(db.location() || "").toLowerCase(); } catch { /* closed */ }
    if (WRITE.test(sql) && location === target) fs.appendFileSync(logFile, `${sql.replace(/\s+/g, " ").trim()}\n`);
  };
  const prepare = DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare = function patchedPrepare(sql, ...rest) {
    record(this, String(sql));
    return prepare.call(this, sql, ...rest);
  };
  const exec = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function patchedExec(sql, ...rest) {
    record(this, String(sql));
    return exec.call(this, sql, ...rest);
  };
}
