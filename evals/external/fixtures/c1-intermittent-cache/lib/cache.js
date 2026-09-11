'use strict';
const DEFAULT_OPTS = { ttl: 60, max: 100 };

class Cache {
  constructor(opts) {
    this.opts = Object.assign(DEFAULT_OPTS, opts || {});
    this.map = new Map();
  }
  set(k, v) { this.map.set(k, v); }
  get(k) { return this.map.get(k); }
}

module.exports = { Cache };
