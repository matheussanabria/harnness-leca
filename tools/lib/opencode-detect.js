const cp = require("child_process");

function detectOpenCodeUrl() {
  if (process.platform !== "win32") return null;
  try {
    const tasklist = cp.execFileSync("tasklist", ["/fi", "imagename eq opencode.exe", "/fo", "csv", "/nh"], { windowsHide: true, timeout: 1500 }).toString();
    const pids = tasklist.split("\n").map(l => (l.split(",")[1] || "").replace(/"/g, "").trim()).filter(Boolean);
    if (!pids.length) return null;

    const netstat = cp.execFileSync("netstat", ["-ano"], { windowsHide: true, timeout: 1500 }).toString();
    for (const line of netstat.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      for (const pid of pids) {
        if (line.trim().endsWith(pid)) {
          const m = line.match(/:(\d+)\s+/);
          if (m) return `http://127.0.0.1:${m[1]}`;
        }
      }
    }
  } catch {}
  return null;
}

module.exports = { detectOpenCodeUrl };

if (require.main === module) {
  console.log("DETECTED:", detectOpenCodeUrl());
}
