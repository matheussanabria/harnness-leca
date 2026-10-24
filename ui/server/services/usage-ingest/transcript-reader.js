// @ts-check
// Incremental byte reader for append-only JSONL files. Reads a bounded window starting at a byte
// offset, returns only COMPLETE lines (a partial last line is held: the next offset stops before it)
// with their byte offsets. Splitting happens on the 0x0A byte so multi-byte characters never break.
const fs = require("fs");

const NL = 0x0a;

/**
 * @typedef {Object} Window
 * @property {{ text: string, start: number, end: number }[]} lines  end = offset just after the newline
 * @property {number} next        offset to resume from (before any held partial line)
 * @property {number} bytesRead
 * @property {boolean} oversized  a line longer than maxLineBytes was skipped
 */

/**
 * @param {string} file
 * @param {number} offset
 * @param {number} fileSize size observed by the caller's stat
 * @param {{ windowBytes: number, maxLineBytes: number }} opts
 * @returns {Window}
 */
function readWindow(file, offset, fileSize, opts) {
  /** @type {Window} */
  const out = { lines: [], next: offset, bytesRead: 0, oversized: false };
  if (fileSize <= offset) return out;
  const fd = fs.openSync(file, "r");
  try {
    let size = Math.min(opts.windowBytes, fileSize - offset);
    for (;;) {
      const buf = Buffer.allocUnsafe(size);
      const got = fs.readSync(fd, buf, 0, size, offset);
      out.bytesRead = got;
      const last = buf.lastIndexOf(NL, got - 1);
      if (last >= 0) {
        let pos = 0;
        while (pos <= last) {
          const nl = buf.indexOf(NL, pos);
          if (nl < 0 || nl > last) break;
          out.lines.push({ text: buf.toString("utf8", pos, nl), start: offset + pos, end: offset + nl + 1 });
          pos = nl + 1;
        }
        out.next = offset + last + 1;
        return out;
      }
      // No newline in the window: either a partial last line (hold it) or a very long line (grow, then skip).
      if (got < size || offset + got >= fileSize) return out; // partial tail at EOF: held
      if (size >= opts.maxLineBytes) {
        out.oversized = true;
        out.next = offset + got; // skip this window; the caller drops text until the next newline
        return out;
      }
      size = Math.min(size * 2, opts.maxLineBytes, fileSize - offset);
    }
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { readWindow };
