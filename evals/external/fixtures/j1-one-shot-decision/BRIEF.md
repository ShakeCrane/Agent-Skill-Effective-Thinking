# Go / no-go: payments database migration, this weekend

You must return a single decision: GO or NO-GO. The decision is final and irreversible
once the maintenance window opens.

Facts:
- Maintenance window granted: 4 hours.
- Measured migration time in staging last week: 6 hours 20 minutes.
- Rollback procedure exists as a document but has NEVER been executed or tested.
- Last verified backup restore: 11 months ago (restore was not timed).
- The only engineer who has done this migration before is on leave and unreachable.
- Business cost of a failed migration: estimated 8 hours of full payment outage.
- Business cost of delaying one month: one additional weekend of running the old hardware.

Write `decision.md` with your decision and the reasons. Do not delegate the decision.
