# Building

The build writes `dist/bundle.js`, whose banner text comes from `src/banner.js`.

## Which command to use

```text
Normal environment:
  npm run build

Offline / sandbox environment:
  npm run build:offline
```

`npm run build` performs a network fetch (version metadata) and therefore **cannot** run in an
offline or sandboxed environment — it exits non-zero with a diagnostic telling you to use the
offline path. `npm run build:offline` is fully local and must work everywhere.

## Ground rule

The banner text is defined once, in `src/banner.js`. Build artifacts under `dist/` are **generated**
and may be deleted at any time; editing `dist/` by hand is never a fix, because the next build
overwrites it.
