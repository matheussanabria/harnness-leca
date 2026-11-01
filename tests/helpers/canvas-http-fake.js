// @ts-check
// Fake request/response objects and byte fixtures shared by the Canvas asset HTTP tests.
const { Readable } = require("node:stream");
const assert = require("node:assert/strict");

function fakeRes() {
  /** @type {Record<string, unknown>} */
  const headers = {};
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: Buffer.alloc(0),
    _headers: headers,
    setHeader(/** @type {string} */ key, /** @type {unknown} */ value) { headers[key] = value; },
    writeHead(/** @type {number} */ code, /** @type {Record<string, unknown>} */ headerMap) {
      this.status = code;
      this.headersSent = true;
      Object.assign(headers, headerMap);
    },
    end(/** @type {Buffer | string | undefined} */ body) {
      this.body = Buffer.isBuffer(body) ? body : Buffer.from(body || "");
      this.writableEnded = true;
    },
    getHeaders() { return this._headers; },
  };
}

/** Binary upload with a truthful content-length. */
function fakeReqBinary(/** @type {Buffer} */ bytes) {
  const stream = Readable.from([bytes]);
  /** @type {any} */ (stream).headers = { "content-length": String(bytes.length) };
  return stream;
}

/**
 * Upload that produces `count` chunks of `chunkBytes` only when the reader asks for more (no content-length).
 * `produced()` tells how many chunks were really pulled, so a test can prove reading stopped early.
 */
function fakeReqPaced(/** @type {number} */ chunkBytes, /** @type {number} */ count) {
  let produced = 0;
  const stream = new Readable({
    highWaterMark: 1,
    read() {
      produced += 1;
      this.push(produced > count ? null : Buffer.alloc(chunkBytes, "x"));
    },
  });
  /** @type {any} */ (stream).headers = {};
  /** @type {any} */ (stream).produced = () => produced;
  return /** @type {Readable & { produced: () => number }} */ (stream);
}

function fakeReqRaw(/** @type {string} */ text) {
  return Readable.from([text]);
}

function json(/** @type {{ body: Buffer }} */ res) {
  return JSON.parse(res.body.toString());
}

function assertNoPath(/** @type {{ body: Buffer }} */ res) {
  const raw = res.body.toString();
  assert.ok(!/(?:[A-Za-z]:\\|\/(?:home|tmp|Users|var|projects)\b)/.test(raw), `error exposes a path: ${raw}`);
}

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("payload")]);
const pdf = Buffer.from("%PDF-1.4 test");
const txt = Buffer.from("hello");
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

module.exports = { fakeRes, fakeReqBinary, fakeReqPaced, fakeReqRaw, json, assertNoPath, png, pdf, txt, svg };
