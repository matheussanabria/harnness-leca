// @ts-check
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  detectAssetType,
  detectMagicExt,
  sanitizeAssetName,
  ASSET_FILE_RE,
  INLINE_EXTS,
  TEXT_EXTS,
} = require('../ui/server/services/canvas/canvas-asset-types');
const { unsupportedAssetType } = require('../ui/server/services/canvas/canvas-errors');

// Fixtures
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('payload'),
]);
const jpg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from('payload'),
]);
const gif = Buffer.concat([
  Buffer.from('GIF89a'),
  Buffer.from('payload'),
]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4), // 4 bytes
  Buffer.from('WEBP'),
  Buffer.from('payload'),
]);
const pdf = Buffer.concat([
  Buffer.from('%PDF-1.4'),
  Buffer.from('payload'),
]);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const exe = Buffer.from([0x4d, 0x5a]); // MZ header
const invalidUtf8 = Buffer.from([0xff, 0xfe, 0x41]);
const jsonValid = Buffer.from(JSON.stringify({ a: 1 }));
const jsonInvalid = Buffer.from('{a:1}'); // invalid JSON

describe('detectMagicExt', () => {
  it('detects PNG', () => {
    assert.strictEqual(detectMagicExt(png), 'png');
  });
  it('detects JPG', () => {
    assert.strictEqual(detectMagicExt(jpg), 'jpg');
  });
  it('detects GIF', () => {
    assert.strictEqual(detectMagicExt(gif), 'gif');
  });
  it('detects WEBP', () => {
    assert.strictEqual(detectMagicExt(webp), 'webp');
  });
  it('detects PDF', () => {
    assert.strictEqual(detectMagicExt(pdf), 'pdf');
  });
  it('returns null for text/special files', () => {
    assert.strictEqual(detectMagicExt(svg), null);
    assert.strictEqual(detectMagicExt(exe), null);
  });
});

describe('detectAssetType', () => {
  // Magic overrides name
  it('returns PNG type even if name is .svg', () => {
    const res = detectAssetType(png, 'evil.svg');
    assert.strictEqual(res.ext, 'png');
    assert.strictEqual(res.mime, 'image/png');
    assert.strictEqual(res.inline, true);
  });
  it('returns JPG type even if name is .txt', () => {
    const res = detectAssetType(jpg, 'file.txt');
    assert.strictEqual(res.ext, 'jpg');
  });
  // Inline only for raster
  it('inline true only for png, jpg, gif, webp', () => {
    const types = ['png', 'jpg', 'gif', 'webp', 'pdf'];
    const buffers = { png, jpg, gif, webp, pdf };
    for (const ext of types) {
      const res = detectAssetType(buffers[ext], `${ext}`);
      const expectedInline = ['png', 'jpg', 'gif', 'webp'].includes(ext);
      assert.strictEqual(res.inline, expectedInline);
    }
  });
  // Text types
  it('accepts txt when name ends .txt and bytes are valid UTF-8', () => {
    const txt = Buffer.from('hello world');
    const res = detectAssetType(txt, 'notes.txt');
    assert.strictEqual(res.ext, 'txt');
  });
  it('rejects txt when bytes are invalid UTF-8', () => {
    assert.throws(() => detectAssetType(invalidUtf8, 'bad.txt'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  it('accepts json when name ends .json and bytes parse', () => {
    const res = detectAssetType(jsonValid, 'data.json');
    assert.strictEqual(res.ext, 'json');
  });
  it('rejects json when bytes do not parse', () => {
    assert.throws(() => detectAssetType(jsonInvalid, 'bad.json'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  // Unsupported types
  it('throws for svg even with .png name', () => {
    assert.throws(() => detectAssetType(svg, 'evil.png'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  it('throws for exe-like bytes', () => {
    assert.throws(() => detectAssetType(exe, 'evil.png'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  // Empty and non-buffer
  it('throws for empty buffer', () => {
    assert.throws(() => detectAssetType(Buffer.alloc(0), 'empty.png'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  it('throws for non-buffer', () => {
    assert.throws(() => detectAssetType('not a buffer', 'file.png'), e => {
      assert.strictEqual(e.code, 'UNSUPPORTED_ASSET_TYPE');
      return true;
    });
  });
  // Name with control chars and uppercase extension
  it('accepts name with control chars and uppercase extension', () => {
    const txt = Buffer.from('hello');
    const res = detectAssetType(txt, '\nREPORT.TXT\r');
    assert.strictEqual(res.ext, 'txt');
  });
});

describe('sanitizeAssetName', () => {
  it('removes control characters, trims, cuts to 120', () => {
    const long = 'a'.repeat(200);
    const name = '\n' + long + '\r';
    const sanitized = sanitizeAssetName(name);
    assert.strictEqual(sanitized.length, 120);
    assert.strictEqual(sanitized[0], 'a');
    assert.strictEqual(sanitized[119], 'a');
  });
  it('returns empty string for non-string', () => {
    assert.strictEqual(sanitizeAssetName(123), '');
    assert.strictEqual(sanitizeAssetName(null), '');
  });
});

describe('ASSET_FILE_RE', () => {
  const valid = 'a'.repeat(64) + '.png';
  it('accepts 64 hex lowercase with png', () => {
    assert.match(valid, ASSET_FILE_RE);
  });
  it('rejects uppercase hex', () => {
    const bad = 'A'.repeat(64) + '.png';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects 63 hex', () => {
    const bad = 'a'.repeat(63) + '.png';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects path traversal', () => {
    const bad = '../x.png';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects wrong extension', () => {
    const bad = 'a'.repeat(64) + '.svg';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects path with extra segment', () => {
    const bad = 'a'.repeat(64) + '.png/extra';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects uppercase extension', () => {
    const bad = 'a'.repeat(64) + '.PNG';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
  it('rejects null byte in name', () => {
    const bad = 'a'.repeat(64) + '\0.png';
    assert.doesNotMatch(bad, ASSET_FILE_RE);
  });
});
