# Plan: Fix misleading frontend error message when readiness returns 503

- **Change ID:** fix-health-page-503-message
- **Stage:** planning
- **Attempt:** 1
- **Refined spec:** [`specs/fix-health-page-503-message/spec.md`](./spec.md) (stage: specification, ready for planning)
- **Affected area:** frontend only
  (`frontend/src/pages/HealthPage.tsx`, `frontend/src/pages/HealthPage.test.tsx`)
- **Size:** small (one message-derivation branch + tests)

This document is self-contained: it restates the change, motivation, scope,
requirements/acceptance criteria, and the ordered task list with dependencies, so
a reviewer does not need the original task thread.

## 1. Change summary

`HealthPage` currently renders every fetch failure with the same prefix. Change
the error-message derivation in `frontend/src/pages/HealthPage.tsx` so that:

- an `ApiError` with `status === 503` renders **`Database unavailable: <detail> (status 503)`**;
- an `ApiError` with any other status renders
  **`Backend unavailable: <detail> (status <status>)`** (unchanged);
- a non-`ApiError` value renders **`Backend unavailable: <String(error)>`** (unchanged).

The underlying error detail and numeric status stay visible in all cases. Add
tests in `frontend/src/pages/HealthPage.test.tsx` for the 503 branch and at least
one non-503 branch.

Today's code (the only line range that changes semantically):

```ts
const message =
  error instanceof ApiError
    ? `Backend unavailable: ${error.message} (status ${error.status})`
    : `Backend unavailable: ${String(error)}`;
```

## 2. Motivation

When the backend is reachable but `/api/healthz` answers `503` because
PostgreSQL does not answer, `fetchHealth()` throws
`ApiError(503, "database unavailable")` (`frontend/src/api/client.ts`,
`parseError`). The page then shows:

```
Backend unavailable: database unavailable (status 503)
```

That is factually wrong and operationally misleading: the backend process is up
and serving the request; only its database dependency is down. An operator
following "Backend unavailable" investigates the wrong component, and the
information that distinguishes *backend unreachable* from *database unavailable*
is present in the payload but thrown away by the wording.

The two failure modes are already distinguishable in code, so this is a
presentation-only defect:

- backend truly unreachable → `ApiError(0, "The API is unreachable")` (network
  failure path in `fetchHealth`);
- backend reachable, database down → `ApiError(503, "database unavailable")`.

## 3. Scope

### In scope

- The error-message derivation in `frontend/src/pages/HealthPage.tsx`.
- The 503 → `Database unavailable` branch.
- Keeping `<detail>` and `(status <status>)` visible in the rendered alert.
- Keeping the existing `Backend unavailable` wording for every other `ApiError`
  status (including `0`) and for non-`ApiError` failures.
- Tests in `frontend/src/pages/HealthPage.test.tsx` for the 503 branch and at
  least one non-503 branch.

### Out of scope

- Backend behavior (`backend/src/app/health.py`): `/api/healthz` status codes,
  `detail` payload, `SELECT 1` readiness ping.
- The API client contract (`frontend/src/api/client.ts`): `ApiError`, `status`,
  `message`, `fetchHealth` do not change;
  `frontend/src/api/client.test.ts` must keep passing unmodified.
- Network-failure semantics: `ApiError(0, "The API is unreachable")` keeps
  meaning "backend unreachable".
- Styling, layout, markup structure, the `role="alert"` element and the
  `Retry` button mechanism.
- The healthy (`200`) rendering path.
- Deployment, Helm chart, and CI configuration.

## 4. Refined requirements and acceptance criteria

Message construction is a pure function of the thrown value, with
`detail = error.message` and `status = error.status`:

1. `ApiError` with `status === 503` → `Database unavailable: <detail> (status 503)`
2. `ApiError` with any other `status` → `Backend unavailable: <detail> (status <status>)`
3. any non-`ApiError` value → `Backend unavailable: <String(error)>`

### R1 — 503 is classified as a database failure

- **AC-1.1** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the element with `role="alert"` has the exact
  text content `Database unavailable: database unavailable (status 503)`.
- **AC-1.2** Given `fetchHealth` rejects with `new ApiError(503, "connection refused")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Database unavailable: connection refused (status 503)` (the branch is driven
  by `status`, not by the `detail` string).

### R2 — Underlying error detail and status stay visible for 503

- **AC-2.1** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the alert text content contains the substring
  `database unavailable`.
- **AC-2.2** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the alert text content contains the substring
  `(status 503)`.

### R3 — Other `ApiError` statuses keep the `Backend unavailable` wording

- **AC-3.1** Given `fetchHealth` rejects with `new ApiError(500, "boom")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Backend unavailable: boom (status 500)`.
- **AC-3.2** Given `fetchHealth` rejects with `new ApiError(502, "bad gateway")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Backend unavailable: bad gateway (status 502)`.
- **AC-3.3** Given `fetchHealth` rejects with `new ApiError(0, "The API is unreachable")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Backend unavailable: The API is unreachable (status 0)`.

### R4 — Non-`ApiError` failures keep the `Backend unavailable` wording

- **AC-4.1** Given `fetchHealth` rejects with `new TypeError("fetch failed")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Backend unavailable: TypeError: fetch failed`.

### R5 — Error affordances are preserved

- **AC-5.1** In every failure scenario in R1, R3 and R4, an element with
  `role="alert"` is present.
- **AC-5.2** In every failure scenario in R1, R3 and R4, a button with the
  accessible name `Retry` is present.

### R6 — Healthy path is unchanged

- **AC-6.1** Given `fetchHealth` resolves with `{ status: "ok", database: "ok" }`,
  when `HealthPage` renders, then exactly two `strong` elements with text `ok`
  are present and no element with `role="alert"` is present.

### R7 — Frontend-only change

- **AC-7.1** The change touches only `frontend/src/pages/HealthPage.tsx` and
  `frontend/src/pages/HealthPage.test.tsx`; `frontend/src/api/client.ts` and
  `frontend/src/api/client.test.ts` are byte-for-byte unchanged and
  `frontend/src/api/client.test.ts` still passes.

### R8 — Test coverage for both branches

- **AC-8.1** `frontend/src/pages/HealthPage.test.tsx` contains at least one test
  asserting the 503 → `Database unavailable` message and at least one test
  asserting the `Backend unavailable` message for a non-503 failure.
- **AC-8.2** `cd frontend && npm run test` exits with success, and
  `npm run lint` and `npm run typecheck` exit with success.

### Scenarios (Given/When/Then)

- **S1 — Backend reachable, database down (503).** Given `fetchHealth()` rejects
  with `ApiError(503, "database unavailable")`; when `HealthPage` renders; then
  the alert reads `Database unavailable: database unavailable (status 503)`.
  Covers AC-1.1, AC-2.1, AC-2.2, AC-5.1, AC-5.2.
- **S2 — Status-based, not detail-based.** Given `ApiError(503, "connection refused")`;
  then the alert reads `Database unavailable: connection refused (status 503)`.
  Covers AC-1.2.
- **S3 — Non-503 backend error.** Given `ApiError(500, "boom")` and separately
  `ApiError(502, "bad gateway")`; then the alert reads
  `Backend unavailable: <detail> (status <status>)`.
  Covers AC-3.1, AC-3.2, AC-5.1, AC-5.2.
- **S4 — Backend unreachable (status 0).** Given `ApiError(0, "The API is unreachable")`;
  then the alert reads `Backend unavailable: The API is unreachable (status 0)`.
  Covers AC-3.3, AC-5.1, AC-5.2.
- **S5 — Non-`ApiError`.** Given `TypeError("fetch failed")`; then the alert
  reads `Backend unavailable: TypeError: fetch failed`.
  Covers AC-4.1, AC-5.1, AC-5.2.
- **S6 — Healthy backend.** Given `{ status: "ok", database: "ok" }`; then two
  `ok` strong markers and no alert. Covers AC-6.1.
- **S7 — Scope/regression.** Only the two in-scope files changed; client and its
  tests unchanged and passing. Covers AC-7.1, AC-8.1, AC-8.2.

## 5. Current state / evidence (grounding)

- `frontend/src/pages/HealthPage.tsx` — single error string built in the
  `fetchPage` catch; renders `<p role="alert">{state.message}</p>` and a
  `Retry` button in the `phase === "error"` branch.
- `frontend/src/pages/HealthPage.test.tsx` — two existing tests: healthy render
  (`findAllByText("ok", { selector: "strong" })`, length 2) and a failure case
  using `new client.ApiError(0, "The API is unreachable")` asserting
  `toHaveTextContent("Backend unavailable")` plus the `Retry` button. The
  status-0 test is the natural non-503 regression guard and must keep passing.
- `frontend/src/api/client.ts` — `ApiError(status, message)`; network failure →
  `ApiError(0, "The API is unreachable")`; non-2xx →
  `parseError` → `ApiError(response.status, body.detail)`.
- `frontend/src/api/client.test.ts` — already asserts `ApiError(503)` with
  message `database unavailable`; a scope contract, not to be modified.
- `frontend/package.json` — `test` = `vitest run`, `lint` = `eslint .`,
  `typecheck` = `tsc --noEmit`.

## 6. Ordered task list

Tasks are ordered; each lists explicit dependencies. Implementation is a single
small change, so the list is intentionally short.

| ID | Task | Depends on | Output / done when | Covers |
|---|---|---|---|---|
| **T1** | Implement the three-case message derivation in `frontend/src/pages/HealthPage.tsx`: 503 → `Database unavailable: <detail> (status 503)`; other `ApiError` → `Backend unavailable: <detail> (status <status>)`; non-`ApiError` → `Backend unavailable: <String(error)>`. Keep using `error.message`/`error.status`; do not touch markup, `role="alert"` or the `Retry` button. | — | The file compiles and the message rule matches AC-1.1…AC-4.1 exactly. | R1–R4 |
| **T2** | Add a 503 test to `frontend/src/pages/HealthPage.test.tsx`: mock `fetchHealth` to reject with a real `client.ApiError(503, "database unavailable")`, assert the exact alert text `Database unavailable: database unavailable (status 503)` and the substrings `database unavailable` and `(status 503)`, and assert the `Retry` button. Optionally add the status-driven case (`ApiError(503, "connection refused")`). | T1 | New test passes and fails against the pre-T1 wording. | AC-1.1, AC-1.2, AC-2.1, AC-2.2, AC-5.1, AC-5.2, AC-8.1 |
| **T3** | Extend the non-503 coverage in `HealthPage.test.tsx`: assert exact `Backend unavailable` text for `ApiError(500, "boom")` and/or `ApiError(502, "bad gateway")`, and for a non-`ApiError` (`TypeError("fetch failed")`); keep the existing status-0 test unmodified. | T1 | Non-503 branches asserted exactly; status-0 test still passes. | AC-3.1, AC-3.2, AC-3.3, AC-4.1, AC-5.1, AC-5.2, AC-8.1 |
| **T4** | Scope check: confirm the diff touches only `frontend/src/pages/HealthPage.tsx` and `frontend/src/pages/HealthPage.test.tsx`; confirm `frontend/src/api/client.ts` and `frontend/src/api/client.test.ts` are unchanged. | T2, T3 | Diff contains exactly the two in-scope files. | AC-7.1 |
| **T5** | Run quality gates: `cd frontend && npm run lint && npm run typecheck && npm run test`. | T4 | All three commands exit 0, including the untouched `client.test.ts`. | AC-8.2, AC-6.1 |
| **T6** | Review/handoff: confirm §3 definition of done, attach the AC↔test mapping (R1–R8 / S1–S7), note explicitly that the API client and backend are untouched. | T5 | Reviewable change request with evidence. | all |

### Definition of done

- `frontend/src/pages/HealthPage.tsx` implements the three-case rule in §4,
  matching AC-1.1…AC-4.1 exactly.
- `frontend/src/pages/HealthPage.test.tsx` covers the 503 branch and at least
  one non-503 branch (AC-8.1).
- `cd frontend && npm run lint && npm run typecheck && npm run test` all pass
  (AC-8.2).
- No changes outside the two in-scope files (AC-7.1).

## 7. Risks, assumptions, open questions

- **Assumption:** `503` is the sole status used by `/api/healthz` for database
  unavailability (confirmed by `backend/src/app/health.py` and
  `deploy/chart/values.yaml`). No other status should be reclassified.
- **Assumption:** the classification is by `status` only; the `detail` string
  must not drive the branch (AC-1.2 guards this).
- **Risk (low):** a future 503 for a non-database cause would read
  "Database unavailable". Out of scope here; the readiness endpoint's contract
  is database liveness.
- **Compatibility:** `ApiError(0)` continues to mean backend unreachable; the
  existing status-0 test remains valid and is a regression guard.
- **Open questions:** none blocking.
