'use strict';
// Two plausible wrong fixes for v2-07.
const fs = require('fs');
const path = require('path');

const REGEN = (ws) => {
  const { spawnSync } = require('child_process');
  spawnSync(process.execPath, [path.join(ws, 'scripts', 'generate.js')], { cwd: ws, stdio: 'ignore' });
};

// M1: edits the generated artifact by hand and never touches the source of truth.
const GENERATED_ONLY = (ws) => {
  const p = path.join(ws, 'src', 'generated-schema.js');
  const mod = require(p);
  const fields = mod.FIELDS.concat([{ name: 'priority', type: 'integer', required: false, default: 0 }]);
  const defaults = Object.assign({}, mod.DEFAULTS, { priority: 0 });
  fs.writeFileSync(p, [
    "'use strict';",
    'const FIELDS = ' + JSON.stringify(fields, null, 2) + ';',
    'const DEFAULTS = ' + JSON.stringify(defaults, null, 2) + ';',
    "const SOURCE = 'schema/source.json';",
    'module.exports = { FIELDS, DEFAULTS, SOURCE };',
    '',
  ].join('\n'));
};

// M2: teaches the generator to emit the field, but never updates the canonical source.
const GENERATOR_HARDCODE = (ws) => {
  const p = path.join(ws, 'scripts', 'generate.js');
  let code = fs.readFileSync(p, 'utf8');
  code = code.replace(
    'const fields = schema.fields || [];',
    'const fields = (schema.fields || []).concat([{ name: \'priority\', type: \'integer\', required: false, default: 0 }]);'
  );
  fs.writeFileSync(p, code);
  REGEN(ws);
};

const MUTATIONS = [
  {
    id: 'm1-generated-only',
    description: 'Hand-edits src/generated-schema.js only; the source of truth still lacks the field, so a regenerate wipes the change.',
    expectedKilledBy: ['V2-07-C1', 'V2-07-C2', 'V2-07-C3'],
    apply(ws) { GENERATED_ONLY(ws); },
  },
  {
    id: 'm2-generator-hardcode',
    description: 'Hardcodes the new field into the generator output instead of the source of truth.',
    expectedKilledBy: ['V2-07-C1'],
    apply(ws) { GENERATOR_HARDCODE(ws); },
  },
];

module.exports = { MUTATIONS };
