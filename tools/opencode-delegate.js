#!/usr/bin/env node
// @ts-check
"use strict";
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const { delegate } = require("./lib/opencode-delegate");

const values = (name, argv) => argv.flatMap((value, index) => value === `--${name}` ? [argv[index + 1]] : []);

function main(argv, io = console) {
  const dir = opt("dir", argv);
  const promptFile = opt("prompt-file", argv);
  if (!dir || !promptFile) throw new CliError("Usage: node tools/opencode-delegate.js --dir <path> --prompt-file <file> [--write] [--bash <rule>] [--model <free-model>] [--timeout-min <n>]");
  try {
    const result = delegate({
      dir,
      promptFile,
      write: flag("write", argv),
      bash: values("bash", argv),
      model: opt("model", argv),
      timeoutMinutes: opt("timeout-min", argv) ? Number(opt("timeout-min", argv)) : undefined,
    });
    io.log(result.answer);
  } catch (error) {
    throw new CliError(error.message || String(error), 2);
  }
}

module.exports = { main, values };
if (require.main === module) runAsScript(main);
