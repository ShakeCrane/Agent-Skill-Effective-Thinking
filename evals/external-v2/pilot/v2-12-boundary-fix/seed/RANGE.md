# Range Contract

This file is authoritative for `src/range.js`.

## API

`isWithin(value, min, max)` -> boolean. Three arguments; keep the export name and signature.

## Rules

1. **Inclusive boundaries.** `min` and `max` are part of the valid range: `isWithin(5, 5, 10)` and
   `isWithin(10, 5, 10)` are both `true`.
2. **Strictly outside is false.** Values below `min` or above `max` are `false`.
3. **Values strictly inside are true.**
