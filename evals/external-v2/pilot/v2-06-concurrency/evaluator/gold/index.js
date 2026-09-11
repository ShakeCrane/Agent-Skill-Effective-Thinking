'use strict';
// GOLD: serialise increments through a per-instance promise chain (no lock library required).
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

class Counter {
  constructor() {
    this.values = new Map();
    this.tail = Promise.resolve();
  }

  get(key) {
    return this.values.get(key) || 0;
  }

  set(key, n) {
    this.values.set(key, n);
  }

  increment(key) {
    const run = () => {
      this.values.set(key, this.get(key) + 1);
    };
    const next = this.tail.then(run, run);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }
}

module.exports = { Counter };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'counter.js'), GOLD);
}

module.exports = { apply };
