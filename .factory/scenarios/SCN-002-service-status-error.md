---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:health:service-status-error
type: scenario
title: Unavailable backend shows the "Service Status" heading
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

A user opens the Health page while the backend is unreachable: `fetchHealth`
rejects and the page enters the error state. The page renders a single level-1
heading with the text `Service Status`, an element with role `alert` whose text
contains `Backend unavailable`, and a `Retry` button. The repository name
`dark-factory-product-1` is not rendered anywhere on the page.
