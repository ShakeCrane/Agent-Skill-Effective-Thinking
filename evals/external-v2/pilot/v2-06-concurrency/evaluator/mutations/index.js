'use strict';
// Two plausible wrong fixes for v2-06. Both look like genuine attempts and both still lose updates.
const fs = require('fs');
const path = require('path');

// M1: the classic read -> await -> write race, with an extra tick added "to let the write settle".
const READ_AWAIT_WRITE = `'use strict';

class Counter {
  constructor() {
    this.values = new Map();
  }

  get(key) {
    return this.values.get(key) || 0;
  }

  set(key, n) {
    this.values.set(key, n);
  }

  async increment(key) {
    const current = this.get(key);
    await new Promise((resolve) => setImmediate(resolve));
    this.set(key, current + 1);
  }
}

module.exports = { Counter };
`;

// M2: computes the next value before awaiting and then writes it — competing callers all write the
// same number because they all read the same starting value.
const COMPUTE_THEN_AWAIT = `'use strict';

class Counter {
  constructor() {
    this.values = new Map();
  }

  get(key) {
    return this.values.get(key) || 0;
  }

  set(key, n) {
    this.values.set(key, n);
  }

  async increment(key) {
    const next = this.get(key) + 1;
    await Promise.resolve();
    this.set(key, next);
  }
}

module.exports = { Counter };
`;

const MUTATIONS = [
  {
    id: 'm1-read-await-write',
    description: 'Keeps the read/await/write race and only changes the scheduling tick, so concurrent callers still overwrite each other.',
    expectedKilledBy: ['V2-06-C1', 'V2-06-C2', 'V2-06-C3'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'counter.js'), READ_AWAIT_WRITE); },
  },
  {
    id: 'm2-compute-then-await',
    description: 'Computes the incremented value before awaiting and then stores it, so a whole burst writes the same number.',
    expectedKilledBy: ['V2-06-C1', 'V2-06-C2', 'V2-06-C3'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'counter.js'), COMPUTE_THEN_AWAIT); },
  },
];

module.exports = { MUTATIONS };
