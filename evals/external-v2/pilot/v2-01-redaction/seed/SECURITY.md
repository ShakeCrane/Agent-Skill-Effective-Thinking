# Security Contract — redaction

This file is the authoritative contract for the redaction helper. The implementation in
`src/redact.js` must satisfy it.

## `redactSecrets(value)`

Given a value of any type, return a sanitised copy in which sensitive values are replaced.

1. **Recursive objects.** Objects are traversed recursively; nested objects are redacted too.
2. **Recursive arrays.** Arrays are traversed recursively; object/array elements are redacted too.
3. **Case-insensitive keys.** Sensitive key matching is case-insensitive (`PASSWORD` == `password`).
4. **Sensitive keys.** Exactly these four, compared case-insensitively:
   - `password`
   - `token`
   - `apiToken`
   - `secret`
5. **Replacement value.** The replacement is the literal string `[REDACTED]`.
6. **Primitives and null.** Numbers, strings, booleans, `null` and `undefined` are returned unchanged
   (`null` stays `null`; it must not become an object).
7. **No mutation.** The input value must never be modified. Callers keep using their own object and
   it must still contain the original values afterwards.
8. **Public API.** `require('./src/redact.js')` exports `{ redactSecrets }` taking exactly one
   argument. Do not rename or re-shape the export.
