# Migration Contract

This file is authoritative for `src/migrate.js`.

## API

`migrate(config)` -> the migrated configuration. Single argument; the export name and call shape must
not change.

`config` looks like:

```json
{ "plugins": [ { "id": "user-a", "enabled": false } ] }
```

## Rules

1. **Idempotent.** Running the migration any number of times produces the same result as running it
   once. `migrate(migrate(c))` must deep-equal `migrate(c)`.
2. **Never overwrite user entries.** If an entry with id `builtin-safe` already exists, it is left
   exactly as the user configured it (including extra fields and `enabled: false`).
3. **Add only when missing.** The default entry is appended only when no entry with that id exists.
4. **Preserve order.** The user's existing entries keep their original relative order; a newly added
   default entry goes at the end.
5. **No input mutation.** The caller's object (and its nested entries) must not be modified.

## The default entry

```json
{ "id": "builtin-safe", "enabled": true }
```
