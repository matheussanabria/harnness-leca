// Builds a zip (deflate) from { name: string|Buffer } for the claude.ai import tests.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** Builds a zip (deflate) from { name: string|Buffer }. */
function makeZip(file, entries) {
  const locals = [], cds = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.from(content), comp = zlib.deflateRawSync(raw), nm = Buffer.from(name);
    const crc = zlib.crc32(raw);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(nm.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nm.length, 28);
    cd.writeUInt32LE(offset, 42);
    locals.push(loc, nm, comp); cds.push(cd, nm);
    offset += 30 + nm.length + comp.length;
  }
  const cdBuf = Buffer.concat(cds), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(cds.length / 2, 8); eocd.writeUInt16LE(cds.length / 2, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([...locals, cdBuf, eocd]));
}

module.exports = { makeZip };
