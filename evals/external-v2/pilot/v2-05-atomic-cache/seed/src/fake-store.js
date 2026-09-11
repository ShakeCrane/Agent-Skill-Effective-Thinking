'use strict';
// In-memory stand-in for the persistence layer. Deterministic and platform independent.
class FakeStore {
  constructor(initial = {}) {
    this.files = Object.assign({}, initial);
    this.failReplace = false;
    this.calls = [];
  }

  async read(key) {
    this.calls.push(['read', key]);
    return Object.prototype.hasOwnProperty.call(this.files, key) ? this.files[key] : undefined;
  }

  async writeTemp(tmpKey, value) {
    this.calls.push(['writeTemp', tmpKey]);
    this.files[tmpKey] = value;
  }

  async replace(tmpKey, key) {
    this.calls.push(['replace', tmpKey, key]);
    if (this.failReplace) throw new Error('replace failed');
    if (!Object.prototype.hasOwnProperty.call(this.files, tmpKey)) throw new Error('missing temp entry');
    this.files[key] = this.files[tmpKey];
    delete this.files[tmpKey];
  }

  async remove(tmpKey) {
    this.calls.push(['remove', tmpKey]);
    delete this.files[tmpKey];
  }

  async write(key, value) {
    this.calls.push(['write', key]);
    this.files[key] = value;
  }
}

module.exports = { FakeStore };
