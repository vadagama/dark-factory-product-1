---
schema: dark-factory.dev/plan/v1
id: plan:dark-factory-product-1:health:service-status-heading
type: plan
title: Replace the repository-name heading on the Health page with "Service Status"
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0002
stage: planning
attempt: 1
specification: spec:dark-factory-product-1:health:service-status-heading
scenarios:
  - scenario:dark-factory-product-1:health:service-status-ready
  - scenario:dark-factory-product-1:health:service-status-error
---

# Change package — "Service Status" heading on the Health page

This document is the complete, self-contained request. A reviewer needs no access
to the originating task thread.

## 1. Change summary

`HealthPage` (`frontend/src/pages/HealthPage.tsx`) renders the literal repository
name `dark-factory-product-1` as its only `<h1>`, in **two** places:

- the **error** state branch (`state.phase === "error"`), and
- the **ready** state (the final `return`).

Replace that heading text with `Service Status` in both places, and make the
frontend suite assert the new heading in both states. Nothing else changes.

Two token-level edits in the component, plus added assertions in the existing
test file. No API, backend, chart, or configuration change.

## 2. Motivation

The repository/package name is an implementation identifier, not a human-facing
title. Rendered as the page heading it:

- tells the user nothing about what the page does (it shows service liveness and
  database status);
- leaks an internal identifier into the user interface;
- reads as a bug or an unfinished template to anyone opening the page.

`Service Status` describes the page's purpose and is stable regardless of what
the repository is eventually named.

## 3. Scope

### In scope

| # | Item | Location |
|---|---|---|
| 1 | `<h1>` text in the **ready** state: `dark-factory-product-1` → `Service Status` | `frontend/src/pages/HealthPage.tsx` (the `<h1>` in the final `return`) |
| 2 | `<h1>` text in the **error** state: `dark-factory-product-1` → `Service Status` | `frontend/src/pages/HealthPage.tsx` (the `<h1>` inside the `state.phase === "error"` branch) |
| 3 | Heading assertions for both states | `frontend/src/pages/HealthPage.test.tsx` |

### Out of scope (explicitly unchanged)

1. **Every other occurrence** of `dark-factory-product-1` in the repository.
   Verified occurrences that must **not** be touched: `frontend/index.html`
   `<title>`, `frontend/package.json` `name`, `frontend/package-lock.json`,
   `frontend/packages/ui/src/patterns/FormField.stories.tsx` (sample input
   value), `deploy/chart/**` (`fullnameOverride`, image repositories, secret
   names), `backend/src/app/config.py` `app_name` and its tests,
   `backend/pyproject.toml`, `backend/uv.lock`, `backend/.env.example`,
   `.github/workflows/ci.yml`, `README.md`, `.factory/**` metadata.
   In particular the **browser tab title** (`index.html`) is deliberately left
   as-is: this change is about the rendered page heading only.
2. The `loading` state, which renders `<p>Loading…</p>` and has no heading.
3. `Retry` / `Refresh` button labels, the `role="alert"` error message, the two
   `<strong>` status markers, layout, styling, accessibility attributes.
4. `frontend/src/api/client.ts`, backend endpoints and backend behaviour.
5. Dependency or tooling changes; no new test libraries.

## 4. Refined requirements and acceptance criteria

Criteria keep the stable ids (`AC-x.y`) from the change specification
(`.factory/changes/CHG-0002-service-status-heading/specification.md`) so the two
documents stay traceable to each other.

### R1 — Ready state renders the human heading

- **AC-1.1** Given `fetchHealth` resolves, when `HealthPage` is rendered and the
  ready state is reached, the document contains exactly one `<h1>` whose text
  content is exactly `Service Status`.
- **AC-1.2** In the ready state, no rendered element has the text content
  `dark-factory-product-1`.

### R2 — Error state renders the human heading

- **AC-2.1** Given `fetchHealth` rejects, when `HealthPage` is rendered and the
  error state is reached, the document contains exactly one `<h1>` whose text
  content is exactly `Service Status`.
- **AC-2.2** In the error state, no rendered element has the text content
  `dark-factory-product-1`.

### R3 — Ready-state content is preserved

- **AC-3.1** In the ready state, exactly two `<strong>` elements are rendered and
  both have text content `ok`.
- **AC-3.2** In the ready state, a button with accessible name `Refresh` is
  rendered.

### R4 — Error-state content is preserved

- **AC-4.1** In the error state, an element with role `alert` is rendered and its
  text content contains `Backend unavailable`.
- **AC-4.2** In the error state, a button with accessible name `Retry` is
  rendered.

### R5 — Frontend tests assert the new heading

- **AC-5.1** `frontend/src/pages/HealthPage.test.tsx` has a test that renders the
  ready state and asserts the level-1 heading is `Service Status`.
- **AC-5.2** `frontend/src/pages/HealthPage.test.tsx` has a test that renders the
  error state and asserts the level-1 heading is `Service Status`.
- **AC-5.3** `npm run test` in `frontend/` exits successfully.

### Traceability

| Criterion | Scenario | Task | Verification |
|---|---|---|---|
| AC-1.1 | `scenario:...:service-status-ready` | T3 | Query level-1 heading in ready state; compare text. |
| AC-1.2 | `scenario:...:service-status-ready` | T3 | Assert no element has text `dark-factory-product-1`. |
| AC-2.1 | `scenario:...:service-status-error` | T4 | Query level-1 heading in error state; compare text. |
| AC-2.2 | `scenario:...:service-status-error` | T4 | Assert no element has text `dark-factory-product-1`. |
| AC-3.1 | `scenario:...:service-status-ready` | T3 (existing assertion) | Count `<strong>` markers with text `ok`. |
| AC-3.2 | `scenario:...:service-status-ready` | T3 (existing assertion) | Query button named `Refresh`. |
| AC-4.1 | `scenario:...:service-status-error` | T4 (existing assertion) | Query `role="alert"`; match text. |
| AC-4.2 | `scenario:...:service-status-error` | T4 (existing assertion) | Query button named `Retry`. |
| AC-5.1 | `scenario:...:service-status-ready` | T3 | Inspect/run the ready-state test. |
| AC-5.2 | `scenario:...:service-status-error` | T4 | Inspect/run the error-state test. |
| AC-5.3 | both scenarios | T5 | Run `npm run test` in `frontend/`; check exit code. |

## 5. Task list (ordered, with dependencies)

All paths are relative to the repository root. "Deps" lists tasks that must be
complete first; T1 and T2 are independent of each other and may land in either
order (or the same commit).

### T1 — Replace the ready-state `<h1>` (AC-1.1, AC-1.2)

- **Deps:** none.
- **File:** `frontend/src/pages/HealthPage.tsx` — the `<h1>` in the final
  `return` of `HealthPage` (currently `line 66`).
- **Change:** `<h1>dark-factory-product-1</h1>` → `<h1>Service Status</h1>`.
- **Constraints:** change only the element's text. Keep the element, its level,
  its position as the first child of `<main>`, and every sibling untouched. Keep
  the JSX on a single line so Prettier formatting is unchanged.

### T2 — Replace the error-state `<h1>` (AC-2.1, AC-2.2)

- **Deps:** none.
- **File:** `frontend/src/pages/HealthPage.tsx` — the `<h1>` inside the
  `if (state.phase === "error")` branch (currently `line 57`).
- **Change:** `<h1>dark-factory-product-1</h1>` → `<h1>Service Status</h1>`.
- **Constraints:** as T1. Do not touch the `<p role="alert">` message or the
  `Retry` button.

### T3 — Assert the heading in the ready-state test (AC-1.1, AC-1.2, AC-5.1)

- **Deps:** T1.
- **File:** `frontend/src/pages/HealthPage.test.tsx` — the existing test
  `"shows backend and database status when healthy"`.
- **Change:** after the state has settled (i.e. after the existing
  `await screen.findAllByText("ok", { selector: "strong" })`), add assertions
  that (a) there is exactly one level-1 heading and its text is exactly
  `Service Status`, and (b) no element renders `dark-factory-product-1`.
- **Constraints:** keep the two existing `ok` assertions and the
  `toHaveLength(2)` check (they carry AC-3.1). Awaiting first is required
  because the `loading` state renders no heading.

### T4 — Assert the heading in the error-state test (AC-2.1, AC-2.2, AC-5.2)

- **Deps:** T2.
- **File:** `frontend/src/pages/HealthPage.test.tsx` — the existing test
  `"shows an alert with a retry action when the backend fails"`.
- **Change:** after `await screen.findByRole("alert")`, add assertions that
  (a) there is exactly one level-1 heading and its text is exactly
  `Service Status`, and (b) no element renders `dark-factory-product-1`.
- **Constraints:** keep the existing `alert` text check (AC-4.1) and the `Retry`
  button check (AC-4.2).

### T5 — Run the frontend gates and review the diff (AC-5.3, all)

- **Deps:** T1, T2, T3, T4.
- **Files:** none modified (verification task).
- **Change:** run, from `frontend/`:
  - `npm run test` (required by AC-5.3),
  - `npm run lint` and `npm run typecheck` (the repository's standard frontend
    gates per `README.md`; a formatting or type regression here fails the
    change).
- **Then:** inspect the full diff and confirm the only modified files are
  `frontend/src/pages/HealthPage.tsx` and
  `frontend/src/pages/HealthPage.test.tsx`, and that no out-of-scope occurrence
  of `dark-factory-product-1` was touched. Attach the command output as
  evidence.

### Dependency graph

```
T1 ──→ T3 ─┐
           ├──→ T5
T2 ──→ T4 ─┘
```

## 6. Definition of done

1. T1–T5 complete.
2. Both `<h1>` occurrences in `HealthPage.tsx` read `Service Status`; no other
   change in that file.
3. `HealthPage.test.tsx` asserts the new heading in both states while retaining
   every pre-existing assertion.
4. `npm run test`, `npm run lint` and `npm run typecheck` in `frontend/` all
   exit 0.
5. The diff touches exactly the two files listed in scope; all other
   `dark-factory-product-1` occurrences are unchanged.

## 7. Assumptions, risks and notes

1. **The description says "update the existing expectations"; there are none for
   the heading.** Verified: `HealthPage.test.tsx` today asserts only the two
   `ok` `<strong>` markers, the `alert` text and the `Retry` button — it never
   queries the `<h1>`. The test change is therefore **additive** (new heading
   assertions) rather than a rewrite of existing ones. This is consistent with
   AC-5.1/AC-5.2 and is called out so the reviewer does not expect a deleted or
   modified heading expectation.
2. **Exact-text matching.** AC-1.1/AC-2.1 require the heading text to be *exactly*
   `Service Status`. `toHaveTextContent("Service Status")` is substring-based, so
   the implementer should assert the exact string (e.g. an anchored regex
   `^Service Status$` or a direct `textContent` comparison) and assert exactly one
   level-1 heading.
3. **Asynchronous state.** Both states are reached after a promise resolves or
   rejects, so heading queries must be awaited (`findByRole`) or preceded by an
   existing awaited query; otherwise the assertion races the `loading` state,
   which contains no heading at all.
4. **Low risk.** Two literal string edits plus test assertions. No behavioural,
   API, data or deployment impact; no migration and no rollback plan required
   beyond reverting the commit.
5. **Non-goal to watch.** Reviewers may reasonably expect the browser tab title
   (`frontend/index.html`) to change too. It is explicitly out of scope here
   (section 3, out-of-scope item 1); if desired it must be raised as a separate
   change.
