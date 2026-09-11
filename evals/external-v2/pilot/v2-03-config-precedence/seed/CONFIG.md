# Configuration Contract

This file is authoritative for `src/config.js`.

## API

`loadConfig({ cli, env, file })` -> the effective configuration object. Single argument. Do not
change the export name or the call shape.

`cli`, `env` and `file` are plain objects of **already-typed** values (the loader does not parse
strings; an `env` entry for `TIMEOUT` is already a number). Each may be omitted or partial.

## Precedence

```text
CLI  >  ENV  >  config file  >  defaults
```

## Presence, not truthiness

- **Only `undefined` means "not provided".** A value is taken from the highest-priority source in
  which it is not `undefined`.
- `0` is a legal value and must survive merging (e.g. `retries: 0` must stay `0`).
- `false` is a legal value and must survive merging (e.g. `verbose: false` must stay `false`).
- `''` is a legal value and must survive merging.
- Truthiness (`||`, `&&`, `if (x)`) must not be used to decide whether a source provided a value.

## Fields and defaults

| field     | source key (cli) | source key (env) | source key (file) | default |
|-----------|------------------|------------------|-------------------|---------|
| `timeout` | `timeout`        | `TIMEOUT`        | `timeout`         | `30`    |
| `retries` | `retries`        | `RETRIES`        | `retries`         | `3`     |
| `verbose` | `verbose`        | `VERBOSE`        | `verbose`         | `true`  |

The returned object always contains exactly these three keys.
