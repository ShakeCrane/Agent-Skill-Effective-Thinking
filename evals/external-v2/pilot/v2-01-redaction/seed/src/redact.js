'use strict';

const SENSITIVE = ['password', 'token'];

function redactSecrets(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      if (SENSITIVE.includes(key)) {
        value[key] = '[REDACTED]';
      }
    }
  }
  return value;
}

module.exports = { redactSecrets };
