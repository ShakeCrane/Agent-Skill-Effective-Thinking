# ADR-004 — Export format versioning

Status: accepted. This ADR is authoritative for `src/exporter.js`.

## Context

Records are exported as a pipe-delimited line. Downstream consumers parse the line positionally, so
the field count is part of the public contract.

## Decision

`exportRecord(record, options)` returns a single line. `options` is optional and defaults to `{}`.

### v1 (default)

```text
id|name
```

Every call that does not explicitly ask for a newer version MUST keep producing v1. This includes
`exportRecord(record)` and `exportRecord(record, {})`.

### v2 (opt-in only)

```text
id|name|note
```

Only when `options.formatVersion === 2`. When the record has no `note`, the trailing field is empty
(the line still has three fields, ending with `|`).

### Escaping (existing behaviour)

In every exported field, a literal `|` is escaped as `\|` so the field count stays parseable. This
rule already applies to `id` and `name` and applies equally to `note`.

## Consequences

- Adding the optional field must not change the default line shape; consumers pinned to v1 must be
  unaffected.
- An explicit `formatVersion: 1` must behave exactly like the default.
