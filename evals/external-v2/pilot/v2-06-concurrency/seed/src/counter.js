'use strict';

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
    await Promise.resolve();
    this.set(key, current + 1);
  }
}

module.exports = { Counter };
