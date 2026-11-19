// EP-17.01: every table created by a migration has exactly one declared owner in owners.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { OWNERS, ownersOf, canWrite } = require("../ui/server/db/owners");
const { listMigrations, MIGRATIONS_DIR } = require("../ui/server/db/migrate");

const VALID = new Set(["web", "host", "cli"]);
const CREATE_RE = /CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;

test("every CREATE TABLE in a migration has an owner entry", () => {
  const missing = [];
  for (const m of listMigrations(MIGRATIONS_DIR)) {
    const source = fs.readFileSync(m.file, "utf8");
    for (const match of source.matchAll(CREATE_RE)) {
      if (!OWNERS[match[1]]) missing.push(`${m.name}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, [], "add the table to ui/server/db/owners.js in the same commit");
});

test("owners use only known process names and no entry is stale", () => {
  const created = new Set(["schema_migrations"]);
  for (const m of listMigrations(MIGRATIONS_DIR)) {
    for (const match of fs.readFileSync(m.file, "utf8").matchAll(CREATE_RE)) created.add(match[1]);
  }
  for (const [table, owner] of Object.entries(OWNERS)) {
    const list = Array.isArray(owner) ? owner : [owner];
    assert.ok(list.length > 0 && list.every((o) => VALID.has(o)), `${table}: invalid owner ${JSON.stringify(owner)}`);
    assert.ok(created.has(table), `${table} has an owner but no migration creates it`);
  }
});

test("ownersOf and canWrite", () => {
  assert.deepEqual(ownersOf("meta"), ["web"]);
  assert.equal(canWrite("meta", "web"), true);
  assert.equal(canWrite("meta", "cli"), false);
  assert.throws(() => ownersOf("nope"), /no owner/);
});
