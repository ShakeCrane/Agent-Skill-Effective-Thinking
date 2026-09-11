# Session storage decision

A single-user offline CLI tool records work sessions. Each session is a small JSON record
(a few KB). Requirements:

- must survive a crash or power loss (an in-flight session must not vanish)
- must support "list the last 100 sessions" quickly
- total storage budget is 50 MB
- offline, single user, no network dependency
- the tool is distributed as a single binary; adding a native dependency is expensive

Candidate approaches: (a) one JSON file per session under ~/.app/sessions,
(b) a single SQLite database, (c) keep sessions in memory and flush on exit.
