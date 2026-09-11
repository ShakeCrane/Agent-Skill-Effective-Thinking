# Concurrency Contract

This file is authoritative for `src/counter.js`.

## API

```js
const { Counter } = require('./src/counter.js');
const counter = new Counter();
await counter.increment(key);   // async
counter.get(key);               // sync, returns the current number
```

The export name, the class name and the method shapes must not change.

## Rules

1. **No lost updates.** Concurrent `increment()` calls on the SAME `Counter` instance must each
   count exactly once. `await Promise.all(Array.from({length: 100}, () => counter.increment('a')))`
   must leave `counter.get('a') === 100`.
2. **Bursts compose.** A following burst of 50 concurrent increments must bring the value to 150.
3. **Per-key independence.** Different keys are counted independently and must not interfere.
4. **Deterministic result.** The final value must not depend on scheduling order; the contract is
   exact, not approximate.
