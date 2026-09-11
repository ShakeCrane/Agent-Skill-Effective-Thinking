'use strict';
// Deterministic acceptance checker for v2-03 (configuration precedence).
const path = require('path');
const fs = require('fs');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

function load(ws) {
  const p = path.join(ws, 'src', 'config.js');
  if (!fs.existsSync(p)) throw new Error('src/config.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.loadConfig !== 'function') throw new Error('loadConfig is not exported as a function');
  return mod.loadConfig;
}

async function check(ws) {
  const criteria = [];
  const loadConfig = load(ws);
  const call = (cli, env, file) => loadConfig({ cli, env, file });

  criteria.push(C('V2-03-C7', loadConfig.length <= 1, `arity=${loadConfig.length}`));

  // C1 — CLI beats ENV
  const c1 = call({ timeout: 1, retries: 1, verbose: false }, { TIMEOUT: 9, RETRIES: 9, VERBOSE: true }, {});
  criteria.push(C('V2-03-C1',
    c1.timeout === 1 && c1.retries === 1 && c1.verbose === false,
    JSON.stringify(c1)));

  // C2 — ENV beats file
  const c2 = call({}, { TIMEOUT: 7, RETRIES: 7, VERBOSE: false }, { timeout: 9, retries: 9, verbose: true });
  criteria.push(C('V2-03-C2',
    c2.timeout === 7 && c2.retries === 7 && c2.verbose === false,
    JSON.stringify(c2)));

  // C3 — file beats defaults
  const c3 = call({}, {}, { timeout: 11, retries: 12, verbose: false });
  criteria.push(C('V2-03-C3',
    c3.timeout === 11 && c3.retries === 12 && c3.verbose === false,
    JSON.stringify(c3)));

  // C4 — undefined falls through, and every field is always present
  const c4a = call({}, {}, {});
  const c4b = call({ timeout: undefined }, { TIMEOUT: undefined }, { timeout: 4 });
  const keys = Object.keys(c4a).sort().join(',');
  criteria.push(C('V2-03-C4',
    c4a.timeout === 30 && c4a.retries === 3 && c4a.verbose === true
      && c4b.timeout === 4
      && keys === 'retries,timeout,verbose',
    JSON.stringify({ c4a, c4b, keys })));

  // C5 — retries: 0 survives from each source
  const fromCli = call({ retries: 0 }, {}, {});
  const fromEnv = call({}, { RETRIES: 0 }, { retries: 5 });
  const fromFile = call({}, {}, { retries: 0 });
  criteria.push(C('V2-03-C5',
    fromCli.retries === 0 && fromEnv.retries === 0 && fromFile.retries === 0,
    JSON.stringify({ fromCli: fromCli.retries, fromEnv: fromEnv.retries, fromFile: fromFile.retries })));

  // C6 — verbose: false survives from each source
  const vCli = call({ verbose: false }, {}, {});
  const vEnv = call({}, { VERBOSE: false }, { verbose: true });
  const vFile = call({}, {}, { verbose: false });
  criteria.push(C('V2-03-C6',
    vCli.verbose === false && vEnv.verbose === false && vFile.verbose === false,
    JSON.stringify({ vCli: vCli.verbose, vEnv: vEnv.verbose, vFile: vFile.verbose })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
