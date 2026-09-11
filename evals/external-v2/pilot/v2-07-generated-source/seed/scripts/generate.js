'use strict';
// Generator: schema/source.json -> src/generated-schema.js. Purely local, no network.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'schema', 'source.json');
const OUT = path.join(__dirname, '..', 'src', 'generated-schema.js');

function generate() {
  const schema = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const fields = schema.fields || [];
  const defaults = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(f, 'default')) defaults[f.name] = f.default;
  }
  return [
    "'use strict';",
    '// AUTO-GENERATED from schema/source.json by scripts/generate.js — do not edit by hand.',
    'const FIELDS = ' + JSON.stringify(fields, null, 2) + ';',
    'const DEFAULTS = ' + JSON.stringify(defaults, null, 2) + ';',
    "const SOURCE = 'schema/source.json';",
    'module.exports = { FIELDS, DEFAULTS, SOURCE };',
    '',
  ].join('\n');
}

function main() {
  fs.writeFileSync(OUT, generate());
  console.log('generated ' + path.relative(path.join(__dirname, '..'), OUT));
}

if (require.main === module) main();
module.exports = { generate, SRC, OUT };
