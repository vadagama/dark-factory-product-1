---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:notes-list:api-unreachable
type: scenario
title: Notes API unreachable
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

The notes request fails (network error or non-2xx). The typed client raises
`ApiError`, the notes page shows a `role="alert"` message containing
`Backend unavailable`, and activating `Retry` re-invokes `fetchNotes`.
Specification: `.factory/changes/notes-list/spec.md`.
