// @ts-check
// Reserved project folder names (EP-25.02, ADR-019). No dependencies, so config.js can use it without a cycle.
const PERSONAL_SLUG = "_pessoal";
const RESERVED_SLUGS = Object.freeze(["_template", PERSONAL_SLUG]);

module.exports = { PERSONAL_SLUG, RESERVED_SLUGS };
