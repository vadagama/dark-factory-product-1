---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:notes-list:database-unavailable
type: scenario
title: Notes list with the database down
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

PostgreSQL is unavailable. `GET /api/notes` answers `503` and never `200` with
a partial list, matching the readiness endpoint's failure behavior.
Specification: `.factory/changes/notes-list/spec.md`.
