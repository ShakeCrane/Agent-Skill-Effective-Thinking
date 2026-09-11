'use strict';
// Two plausible wrong fixes for v2-05.
const fs = require('fs');
const path = require('path');

// M1: adds a temp write for appearances, but then writes the target directly and never uses the
// atomic replace, so a failing replace can neither be detected nor survived.
const DIRECT_WRITE_WITH_TEMP = `'use strict';

async function saveCache(store, key, value) {
  const tmpKey = key + '.tmp';
  await store.writeTemp(tmpKey, value);
  await store.write(key, value);
  await store.remove(tmpKey);
}

module.exports = { saveCache };
`;

// M2: uses replace, but clears the old target first "to avoid conflicts", so a failing replace
// leaves the cache empty instead of intact.
const DELETE_THEN_REPLACE = `'use strict';

async function saveCache(store, key, value) {
  const tmpKey = key + '.tmp';
  await store.writeTemp(tmpKey, value);
  await store.remove(key);
  try {
    await store.replace(tmpKey, key);
  } catch (err) {
    await store.remove(tmpKey);
    throw err;
  }
}

module.exports = { saveCache };
`;

const MUTATIONS = [
  {
    id: 'm1-direct-write-with-temp',
    description: 'Writes a temp entry but installs the value with a direct non-atomic write, never using replace.',
    expectedKilledBy: ['V2-05-C2', 'V2-05-C3'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'cache.js'), DIRECT_WRITE_WITH_TEMP); },
  },
  {
    id: 'm2-delete-then-replace',
    description: 'Removes the existing target before replacing, so a failed replace destroys the old value.',
    expectedKilledBy: ['V2-05-C3'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'cache.js'), DELETE_THEN_REPLACE); },
  },
];

module.exports = { MUTATIONS };
