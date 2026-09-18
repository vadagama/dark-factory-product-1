# Specification: Fix misleading frontend error message when readiness returns 503

- **Change ID:** fix-health-page-503-message
- **Stage:** specification
- **Affected area:** frontend only (`frontend/src/pages/HealthPage.tsx`,
  `frontend/src/pages/HealthPage.test.tsx`)
- **Status:** ready for planning

## 1. Problem

`HealthPage` calls `fetchHealth()` (`frontend/src/api/client.ts`) and, on
failure, renders a single error string built in `HealthPage.tsx`:

```ts
error instanceof ApiError
  ? `Backend unavailable: ${error.message} (status ${error.status})`
  : `Backend unavailable: ${String(error)}`
```

`fetchHealth()` throws `ApiError(503, "database unavailable")` when the backend
is reachable but `/api/healthz` reports that PostgreSQL does not answer
(`backend/src/app/health.py` returns `503` with `detail="database unavailable"`;
the readiness probe in `deploy/chart/values.yaml` documents the same). In that
case the page shows `Backend unavailable: database unavailable (status 503)`.

This is factually wrong and operationally misleading: the backend process is
available and serving the request, only the database dependency is down. An
operator reading `Backend unavailable` will look at the wrong component, and the
information needed to tell the two failure modes apart (backend unreachable vs.
database unavailable) is lost. The error detail and HTTP status are present but
mis-attributed.

Note that `ApiError.status === 0` already carries the genuine
"backend unreachable" case (`frontend/src/api/client.ts`:
`throw new ApiError(0, "The API is unreachable")`), so the two failure modes are
distinguishable in code but not in the rendered message.

## 2. Scope

### 2.1 In scope

- The error-message derivation in `frontend/src/pages/HealthPage.tsx`.
- The 503 branch that must render `Database unavailable`.
- Preservation of the underlying error detail and status in the rendered alert.
- Preservation of the existing `Backend unavailable` wording for every other
  `ApiError` status (including `0`) and for non-`ApiError` failures.
- Tests in `frontend/src/pages/HealthPage.test.tsx` covering the 503 case and at
  least one non-503 case.

### 2.2 Out of scope

- Backend behavior: `/api/healthz` status codes, `detail` payload and the
  `SELECT 1` readiness ping (`backend/src/app/health.py`).
- The API client contract: `frontend/src/api/client.ts` (`ApiError`, `status`,
  `message`, `fetchHealth`) must not change; `frontend/src/api/client.test.ts`
  must keep passing unmodified.
- Network-failure semantics: `ApiError(0, "The API is unreachable")` continues
  to mean "backend unreachable".
- Styling, layout, markup structure, the `role="alert"` element and the `Retry`
  button mechanism.
- The healthy (`200`) rendering path.
- Deployment, Helm chart, and CI configuration.

## 3. Requirements and acceptance criteria

Message construction is specified as a pure function of the thrown value, with
`detail = error.message` and `status = error.status`:

1. `ApiError` with `status === 503` → `Database unavailable: <detail> (status 503)`
2. `ApiError` with any other `status` → `Backend unavailable: <detail> (status <status>)`
3. any non-`ApiError` value → `Backend unavailable: <String(error)>`

### R1 — 503 is classified as a database failure

When `fetchHealth()` rejects with an `ApiError` whose `status` is `503`, the
rendered error message must use the `Database unavailable` wording.

- **AC-1.1** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the element with `role="alert"` has the exact
  text content `Database unavailable: database unavailable (status 503)`.
- **AC-1.2** Given `fetchHealth` rejects with `new ApiError(503, "connection refused")`,
  when `HealthPage` renders, then the alert text content is exactly
  `Database unavailable: connection refused (status 503)` (the branch is driven
  by `status`, not by the `detail` string).

### R2 — Underlying error detail and status stay visible for 503

The 503 message must retain the original `error.message` and the numeric status.

- **AC-2.1** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the alert text content contains the substring
  `database unavailable`.
- **AC-2.2** Given `fetchHealth` rejects with `new ApiError(503, "database unavailable")`,
  when `HealthPage` renders, then the alert text content contains the substring
  `(status 503)`.

### R3 — Other `ApiError` statuses keep the `Backend unavailable` wording

For `ApiError` values with a status other than `503`, the message must remain
`Backend unavailable: <detail> (status <status>)`.

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

For every failure covered by R1, R3 and R4, the error UI must keep the alert and
recovery controls.

- **AC-5.1** In each failure scenario above, an element with `role="alert"` is
  present in the document.
- **AC-5.2** In each failure scenario above, a button with the accessible name
  `Retry` is present in the document.

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
- **AC-8.2** Running the frontend test suite (`cd frontend && npm run test`)
  exits with success, and `npm run lint` and `npm run typecheck` exit with
  success.

## 4. Scenarios

### S1 — Backend reachable, database down (readiness 503)

- **Given** the backend is reachable and `/api/healthz` answers `503`
  (equivalently, `fetchHealth()` rejects with `ApiError(503, "database unavailable")`)
- **When** `HealthPage` renders
- **Then** the alert reads `Database unavailable: database unavailable (status 503)`,
  and the detail `database unavailable` and marker `(status 503)` are visible
- **Covers:** AC-1.1, AC-2.1, AC-2.2, AC-5.1, AC-5.2

### S2 — Status-based classification, not detail-based

- **Given** `fetchHealth()` rejects with `ApiError(503, "connection refused")`
- **When** `HealthPage` renders
- **Then** the alert reads `Database unavailable: connection refused (status 503)`
- **Covers:** AC-1.2

### S3 — Backend error with a non-503 status

- **Given** `fetchHealth()` rejects with `ApiError(500, "boom")` (and,
  separately, `ApiError(502, "bad gateway")`)
- **When** `HealthPage` renders
- **Then** the alert reads `Backend unavailable: <detail> (status <status>)`
- **Covers:** AC-3.1, AC-3.2, AC-5.1, AC-5.2

### S4 — Backend unreachable (network failure, status 0)

- **Given** `fetchHealth()` rejects with `ApiError(0, "The API is unreachable")`
- **When** `HealthPage` renders
- **Then** the alert reads `Backend unavailable: The API is unreachable (status 0)`
- **Covers:** AC-3.3, AC-5.1, AC-5.2

### S5 — Non-`ApiError` failure

- **Given** `fetchHealth()` rejects with `TypeError("fetch failed")`
- **When** `HealthPage` renders
- **Then** the alert reads `Backend unavailable: TypeError: fetch failed`
- **Covers:** AC-4.1, AC-5.1, AC-5.2

### S6 — Healthy backend

- **Given** `fetchHealth()` resolves with `{ status: "ok", database: "ok" }`
- **When** `HealthPage` renders
- **Then** two `ok` strong markers are shown and no alert is rendered
- **Covers:** AC-6.1

### S7 — Scope and regression guard

- **Given** the implementation of this change
- **When** the diff and the test suite are inspected
- **Then** only the two in-scope frontend files changed, the API client and its
  tests are unchanged and passing, and the 503 and non-503 assertions exist
- **Covers:** AC-7.1, AC-8.1, AC-8.2

## 5. Traceability

| Acceptance criterion | Requirement | Scenario | Verification |
|---|---|---|---|
| AC-1.1 | R1 | S1 | unit test, exact alert text |
| AC-1.2 | R1 | S2 | unit test, exact alert text |
| AC-2.1 | R2 | S1 | unit test, substring `database unavailable` |
| AC-2.2 | R2 | S1 | unit test, substring `(status 503)` |
| AC-3.1 | R3 | S3 | unit test, exact alert text |
| AC-3.2 | R3 | S3 | unit test, exact alert text |
| AC-3.3 | R3 | S4 | unit test, exact alert text |
| AC-4.1 | R4 | S5 | unit test, exact alert text |
| AC-5.1 | R5 | S1, S3, S4, S5 | unit test, `getByRole("alert")` |
| AC-5.2 | R5 | S1, S3, S4, S5 | unit test, `getByRole("button", { name: "Retry" })` |
| AC-6.1 | R6 | S6 | unit test, two `strong` markers, no alert |
| AC-7.1 | R7 | S7 | diff review + `frontend/src/api/client.test.ts` pass |
| AC-8.1 | R8 | S7 | file inspection of `HealthPage.test.tsx` |
| AC-8.2 | R8 | S7 | `npm run lint`, `npm run typecheck`, `npm run test` |

## 6. Definition of done

- `frontend/src/pages/HealthPage.tsx` implements the three-case message rule in
  §3, matching AC-1.1 through AC-4.1 exactly.
- `frontend/src/pages/HealthPage.test.tsx` covers the 503 branch and at least
  one non-503 branch (AC-8.1).
- `cd frontend && npm run lint && npm run typecheck && npm run test` all pass
  (AC-8.2).
- No changes outside the two in-scope files (AC-7.1).
