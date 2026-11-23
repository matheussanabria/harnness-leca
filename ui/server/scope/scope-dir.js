// @ts-check
// "Does this project folder exist?" for code that works per project directory (EP-25.11, ADR-019).
// The personal workspace is created on first use, so it always exists once asked for.
const fs = require("fs");
const { ensurePersonalWorkspace, isPersonal } = require("./personal-workspace");

/**
 * @param {string} slug project slug or the personal slug
 * @param {string} dir absolute folder of that slug
 */
function scopeDirExists(slug, dir) {
  if (isPersonal(slug)) {
    ensurePersonalWorkspace();
    return true;
  }
  return fs.existsSync(dir);
}

module.exports = { scopeDirExists };
