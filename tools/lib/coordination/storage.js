// @ts-check
const fs = require("fs");
const path = require("path");

function paths(root, project) {
  const dir = path.join(root, "projects", project, "coordination");
  return {
    dir,
    state: path.join(dir, "state.json"),
    lock: path.join(dir, ".lock"),
    events: path.join(dir, "events"),
    inbox: path.join(dir, "inbox"),
    status: path.join(dir, "STATUS.md"),
    context: path.join(root, "projects", project, "context", "coordination.md"),
  };
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}

function loadState(root, project) {
  const file = paths(root, project).state;
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function acquireLock(root, project, staleMs = 300000) {
  const target = paths(root, project);
  fs.mkdirSync(target.dir, { recursive: true });
  try {
    const fd = fs.openSync(target.lock, "wx");
    fs.writeFileSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
    return () => {
      fs.closeSync(fd);
      try { fs.unlinkSync(target.lock); } catch {}
    };
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const age = Date.now() - fs.statSync(target.lock).mtimeMs;
    if (age <= staleMs) throw new Error(`Coordenacao bloqueada por outra operacao: ${target.lock}`);
    fs.unlinkSync(target.lock);
    return acquireLock(root, project, staleMs);
  }
}

function appendEvent(root, project, provider, event) {
  const dir = paths(root, project).events;
  fs.mkdirSync(dir, { recursive: true });
  // O id da frente pode ter barra (opencode/qualidade): no arquivo, vira um nome seguro.
  const file = `${String(provider).replace(/[^\w.-]+/g, "-")}.jsonl`;
  fs.appendFileSync(path.join(dir, file), `${JSON.stringify(event)}\n`, "utf8");
}

module.exports = { paths, atomicJson, loadState, acquireLock, appendEvent };
