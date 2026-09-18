---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:notes-list:notes-present
type: scenario
title: Notes page shows existing notes
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

The notes table holds one or more notes. `GET /api/notes` returns them as
`{"notes": [{id, title, created_at}]}`, and the notes page renders one list
item per note showing its title. Specification:
`.factory/changes/notes-list/spec.md`.
