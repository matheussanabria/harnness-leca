// @ts-check
// Migração versionada do estado local do Scrum, sem alterar fontes externas.
const fs = require("fs");
const path = require("path");

const SCRUM_SCHEMA_VERSION = 2;
const MIGRATION_ID = "scrum-status-v1-to-v2";
const STATUS_TO_LANE = Object.freeze({
  todo: "pronto-para-dev",
  in_progress: "em-desenvolvimento",
  review: "em-revisao",
  done: "concluido",
});

function legacyStatusToLane(status) {
  return STATUS_TO_LANE[String(status || "")] || null;
}

function isLegacyStatus(status) {
  return Object.hasOwn(STATUS_TO_LANE, String(status || ""));
}

function migrateScrumData(input, now = () => new Date().toISOString()) {
  const fromVersion = Number.isInteger(input?.schemaVersion) ? input.schemaVersion : 1;
  if (fromVersion > SCRUM_SCHEMA_VERSION || fromVersion < 1) {
    const error = Object.assign(
      new Error(`Versao de schema Scrum nao suportada: ${fromVersion}.`),
      { code: "UNSUPPORTED_SCRUM_SCHEMA" }
    );
    throw error;
  }
  if (fromVersion === SCRUM_SCHEMA_VERSION) {
    return { data: input, changed: false, fromVersion };
  }

  const unmapped = new Set();
  let mappedStories = 0;
  const stories = (Array.isArray(input.stories) ? input.stories : []).map((story) => {
    const laneId = legacyStatusToLane(story.status);
    if (laneId) mappedStories += 1;
    else if (story.status !== undefined && story.status !== null) unmapped.add(String(story.status));
    return { ...story, laneId };
  });
  const migration = Object.freeze({
    id: MIGRATION_ID,
    fromVersion,
    toVersion: SCRUM_SCHEMA_VERSION,
    appliedAt: now(),
    mappedStories,
    unmappedStatuses: [...unmapped].sort(),
  });
  return {
    changed: true,
    fromVersion,
    data: {
      ...input,
      schemaVersion: SCRUM_SCHEMA_VERSION,
      migrationHistory: [...(Array.isArray(input.migrationHistory) ? input.migrationHistory : []), migration],
      stories,
    },
  };
}

function backupPathFor(scrumFile, version = 1) {
  return path.join(path.dirname(scrumFile), `scrum.v${version}.backup.json`);
}

function writeTextAtomic(file, content) {
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, content, "utf8");
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function writeJsonAtomic(file, data) {
  writeTextAtomic(file, JSON.stringify(data, null, 2));
}

function migrateScrumFile(scrumFile, input, now) {
  const result = migrateScrumData(input, now);
  if (!result.changed) return result;
  const backupFile = backupPathFor(scrumFile, result.fromVersion);
  if (fs.existsSync(scrumFile) && !fs.existsSync(backupFile)) {
    fs.copyFileSync(scrumFile, backupFile, fs.constants.COPYFILE_EXCL);
  }
  writeJsonAtomic(scrumFile, result.data);
  return { ...result, backupFile };
}

function rollbackScrumFile(scrumFile, version = 1) {
  const backupFile = backupPathFor(scrumFile, version);
  if (!fs.existsSync(backupFile)) {
    const error = Object.assign(
      new Error(`Backup Scrum v${version} nao encontrado.`),
      { code: "SCRUM_BACKUP_NOT_FOUND" }
    );
    throw error;
  }
  const content = fs.readFileSync(backupFile, "utf8");
  const data = JSON.parse(content);
  writeTextAtomic(scrumFile, content);
  return data;
}

module.exports = {
  MIGRATION_ID,
  SCRUM_SCHEMA_VERSION,
  STATUS_TO_LANE,
  backupPathFor,
  isLegacyStatus,
  legacyStatusToLane,
  migrateScrumData,
  migrateScrumFile,
  rollbackScrumFile,
  writeJsonAtomic,
};
