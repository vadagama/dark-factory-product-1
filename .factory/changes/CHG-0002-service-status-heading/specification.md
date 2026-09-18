---
schema: dark-factory.dev/specification/v1
id: spec:dark-factory-product-1:health:service-status-heading
type: specification
title: Replace the repository-name heading on the Health page with "Service Status"
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
---

# Replace the repository-name heading on the Health page with "Service Status"

## Problem

`HealthPage` (`frontend/src/pages/HealthPage.tsx`) renders the literal repository
name `dark-factory-product-1` as its only `<h1>` in both the ready state and the
error state. The repository/package name is an implementation identifier, not a
human-facing title: it tells a user nothing about the page and leaks an internal
name into the UI. The heading must read `Service Status` in both states.

## Scope

### In scope

1. The text of the `<h1>` rendered by `HealthPage` in the **ready** state:
   `dark-factory-product-1` -> `Service Status`.
2. The text of the `<h1>` rendered by `HealthPage` in the **error** state:
   `dark-factory-product-1` -> `Service Status`.
3. The heading expectations in `frontend/src/pages/HealthPage.test.tsx`, updated
   so the suite asserts the new heading in both states.

### Out of scope

1. Every other occurrence of `dark-factory-product-1` in the repository
   (`frontend/index.html` `<title>`, `frontend/package.json` `name`,
   `frontend/package-lock.json`, `frontend/packages/ui/src/patterns/FormField.stories.tsx`,
   `deploy/chart/**`, `backend/src/app/config.py` `app_name`, `README.md`,
   `.factory/**` metadata). These are unchanged.
2. The `loading` state of `HealthPage`, which renders `<p>Loading…</p>` and has no
   heading.
3. The `Retry` and `Refresh` button labels, the `role="alert"` error message, the
   two `<strong>` status markers, page layout and styling.
4. The API client `frontend/src/api/client.ts`, the backend endpoints and the
   backend behaviour.

## Requirements

Each requirement below is a single, independently verifiable statement. Criteria
carry stable ids (`AC-x.y`) used by the traceability table.

### R1 — Ready state renders the human heading

- **AC-1.1** Given `fetchHealth` resolves, when `HealthPage` is rendered and the
  ready state is reached, then the document contains exactly one `<h1>` element
  whose text content is exactly `Service Status`.
- **AC-1.2** In the ready state, no rendered element has the text content
  `dark-factory-product-1`.

### R2 — Error state renders the human heading

- **AC-2.1** Given `fetchHealth` rejects, when `HealthPage` is rendered and the
  error state is reached, then the document contains exactly one `<h1>` element
  whose text content is exactly `Service Status`.
- **AC-2.2** In the error state, no rendered element has the text content
  `dark-factory-product-1`.

### R3 — Ready-state content is preserved

- **AC-3.1** In the ready state, exactly two `<strong>` elements are rendered and
  both have the text content `ok`.
- **AC-3.2** In the ready state, a button whose accessible name is `Refresh` is
  rendered.

### R4 — Error-state content is preserved

- **AC-4.1** In the error state, an element with role `alert` is rendered and its
  text content contains `Backend unavailable`.
- **AC-4.2** In the error state, a button whose accessible name is `Retry` is
  rendered.

### R5 — Frontend tests assert the new heading

- **AC-5.1** `frontend/src/pages/HealthPage.test.tsx` contains a test that renders
  the ready state and asserts the level-1 heading is `Service Status`.
- **AC-5.2** `frontend/src/pages/HealthPage.test.tsx` contains a test that renders
  the error state and asserts the level-1 heading is `Service Status`.
- **AC-5.3** Running the frontend test command (`npm run test` in `frontend/`)
  exits successfully.

## Traceability

Every acceptance criterion traces to at least one scenario; the verification
column names the check that decides the criterion.

| Criterion | Scenario | Verification |
|---|---|---|
| AC-1.1 | `scenario:dark-factory-product-1:health:service-status-ready` | Render ready state; query the `<h1>` and compare its text. |
| AC-1.2 | `scenario:dark-factory-product-1:health:service-status-ready` | Render ready state; assert no element has text `dark-factory-product-1`. |
| AC-2.1 | `scenario:dark-factory-product-1:health:service-status-error` | Render error state; query the `<h1>` and compare its text. |
| AC-2.2 | `scenario:dark-factory-product-1:health:service-status-error` | Render error state; assert no element has text `dark-factory-product-1`. |
| AC-3.1 | `scenario:dark-factory-product-1:health:service-status-ready` | Render ready state; count `<strong>` markers with text `ok`. |
| AC-3.2 | `scenario:dark-factory-product-1:health:service-status-ready` | Render ready state; query the button named `Refresh`. |
| AC-4.1 | `scenario:dark-factory-product-1:health:service-status-error` | Render error state; query `role="alert"` and match its text. |
| AC-4.2 | `scenario:dark-factory-product-1:health:service-status-error` | Render error state; query the button named `Retry`. |
| AC-5.1 | `scenario:dark-factory-product-1:health:service-status-ready` | Inspect / run the ready-state test in `HealthPage.test.tsx`. |
| AC-5.2 | `scenario:dark-factory-product-1:health:service-status-error` | Inspect / run the error-state test in `HealthPage.test.tsx`. |
| AC-5.3 | `scenario:dark-factory-product-1:health:service-status-ready`, `scenario:dark-factory-product-1:health:service-status-error` | Run `npm run test` in `frontend/` and check the exit code. |
