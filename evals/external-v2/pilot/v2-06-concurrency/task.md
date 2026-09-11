并发调用 `increment()` 时计数会丢失更新。修复 `Counter`，使同一个实例上的并行递增精确计数（见 `CONCURRENCY.md`）。保持公共 API。
