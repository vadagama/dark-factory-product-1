---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:notes-list:empty-list
type: scenario
title: Empty notes list
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

The notes table is empty. `GET /api/notes` answers `200` with
`{"notes": []}`, and the notes page renders the `@small/ui` `EmptyState`
pattern (`role="status"`) instead of any list items. Specification:
`.factory/changes/notes-list/spec.md`.
