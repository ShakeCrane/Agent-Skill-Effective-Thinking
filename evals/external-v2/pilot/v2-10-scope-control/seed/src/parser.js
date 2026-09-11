'use strict';
// TODO(parser): support quoted arguments with embedded escapes.
// Not part of the current task.
function parseArgs(argv) {
  return argv.split(/\s+/).filter(Boolean);
}

module.exports = { parseArgs };
