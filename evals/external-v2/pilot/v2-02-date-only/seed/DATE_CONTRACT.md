# Date Contract — `YYYY-MM-DD` handling

This file is authoritative for `src/date-only.js`.

## API

- `parseDateOnly(value)` -> `{ year, month, day }` (month is 1-based)
- `formatDateOnly(value)` -> the canonical `YYYY-MM-DD` string

Both take exactly one argument. Do not rename or re-shape these exports.

## Rules

1. **Timezone independence.** A `YYYY-MM-DD` value denotes a calendar date. The result of
   `parseDateOnly` must be identical no matter what the machine's local timezone is
   (`TZ=UTC`, `TZ=Asia/Shanghai`, `TZ=America/Los_Angeles` must all agree).
2. **Round-trip stability.** For every valid input, `formatDateOnly(value) === value`.
3. **Calendar validity.** A syntactically well-formed but non-existent calendar date must be
   rejected by throwing. Examples that must throw: `2025-02-29` (2025 is not a leap year),
   `2026-02-30`, `2026-13-01`, `2026-00-10`.
4. **Leap years.** `2024-02-29` is valid and must parse to `{ year: 2024, month: 2, day: 29 }`.
5. **No test tampering.** The visible test states the contract's expectation; adjusting the expected
   value to match buggy output is not an acceptable fix.
