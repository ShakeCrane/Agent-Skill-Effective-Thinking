修复 `slugify(null)` 崩溃：null/undefined 返回空字符串，其它已有输入行为保持。只修复这个 bug，不处理仓库中的其它 TODO，也不要重构无关代码。
