'use strict';
// TODO(database): replace the in-memory map with a real connection pool.
// Not part of the current task.
class Database {
  constructor() {
    this.rows = new Map();
  }

  put(key, value) {
    this.rows.set(key, value);
  }

  get(key) {
    return this.rows.get(key);
  }
}

module.exports = { Database };
