---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:health:service-status-ready
type: scenario
title: Healthy backend shows the "Service Status" heading
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

A user opens the Health page while the backend is healthy: `fetchHealth`
resolves successfully. The page renders a single level-1 heading with the text
`Service Status`, the two `<strong>` status markers `ok` (backend and database)
and a `Refresh` button. The repository name `dark-factory-product-1` is not
rendered anywhere on the page.
