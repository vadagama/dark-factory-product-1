---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:notes-list:newest-first
type: scenario
title: Notes listed newest-first
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

Notes exist with different `created_at` values. `GET /api/notes` returns them
ordered by `created_at` descending (ties broken by `id` descending), so the
most recently created note appears first. Specification:
`.factory/changes/notes-list/spec.md`.
