// @ts-check
// Stable artifact ids: "art_" + a 26-character ULID (time-sortable, Crockford base32). No dependency.
const crypto = require("crypto");

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_RE = /^art_[0-9A-HJKMNP-TV-Z]{26}$/;

/** @param {number} [now] epoch milliseconds */
function newArtifactId(now = Date.now()) {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const random = Array.from(crypto.randomBytes(16), (b) => ALPHABET[b % 32]).join("");
  return `art_${time}${random}`;
}

const isArtifactId = (/** @type {unknown} */ id) => typeof id === "string" && ID_RE.test(id);

module.exports = { newArtifactId, isArtifactId };
