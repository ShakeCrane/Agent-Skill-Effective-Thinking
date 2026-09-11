'use strict';
// AUTO-GENERATED from schema/source.json by scripts/generate.js — do not edit by hand.
const FIELDS = [
  {
    "name": "id",
    "type": "string",
    "required": true
  },
  {
    "name": "title",
    "type": "string",
    "required": true
  },
  {
    "name": "archived",
    "type": "integer",
    "required": false,
    "default": 0
  }
];
const DEFAULTS = {
  "archived": 0
};
const SOURCE = 'schema/source.json';
module.exports = { FIELDS, DEFAULTS, SOURCE };
