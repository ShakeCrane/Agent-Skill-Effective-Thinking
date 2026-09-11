# Cache Contract

This file is authoritative for `src/cache.js`.

## API

`saveCache(store, key, value)` -> Promise. Three arguments; the export name and call shape must not
change.

## Store interface (implemented by `src/fake-store.js`)

| method | meaning |
|---|---|
| `await store.read(key)` | current value for `key` (`undefined` when absent) |
| `await store.writeTemp(tmpKey, value)` | write a scratch entry under a temporary key |
| `await store.replace(tmpKey, key)` | atomically move `tmpKey` onto `key` |
| `await store.remove(tmpKey)` | delete a scratch entry |
| `await store.write(key, value)` | **low-level, NON-atomic** direct write. Provided for completeness; `saveCache` must not use it. |

`replace` can be made to fail for testing (it throws). `store.calls` records every operation.

## Rules for `saveCache`

1. **Temp first.** The new value is written through `writeTemp`; the target must never be written
   directly (`store.write` on the target key is a contract violation).
2. **Atomic install.** The value becomes visible at `key` through `store.replace`.
3. **Failure keeps the old value.** If `replace` throws, the previously stored value for `key` must
   still be readable and unchanged (no half-written target).
4. **Temp cleanup.** No temporary entry may be left behind — after a success *and* after a failure.
5. **Success.** After a successful call, `read(key)` returns the new value.
