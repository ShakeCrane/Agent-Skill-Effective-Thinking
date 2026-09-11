# Schema Workflow

This file is authoritative for the schema files.

## Source of truth

```text
schema/source.json       = the source of truth (edited by hand)
src/generated-schema.js  = a generated artifact (edited only by the generator)
scripts/generate.js      = the generator: source.json  ->  src/generated-schema.js
```

> The generated file must never be the only place a change is made. A change that exists only in
> `src/generated-schema.js` is destroyed by the next `npm run generate`.

## Fields

Each entry in `source.json` has `name`, `type` (`string` | `integer`), `required` (boolean) and an
optional `default`.

The generated module exports:

- `FIELDS` — the field list, in source order
- `DEFAULTS` — a map of field name -> default value, for fields that declare one
- `SOURCE` — the literal string `"schema/source.json"`
