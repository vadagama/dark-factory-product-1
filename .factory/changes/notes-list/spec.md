---
schema: dark-factory.dev/specification/v1
id: spec:dark-factory-product-1:notes-list
type: specification
title: "Notes list: GET /api/notes and the frontend Notes page"
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0002
---

# Notes list — specification

## 1. Problem

The product already persists notes, but nothing reads them back. The `Note`
model (`backend/src/app/models.py`: `id`, `title`, `created_at`) and the
`notes` table (migration `backend/migrations/versions/0001_initial.py`) exist,
and the application factory registers only the health router
(`backend/src/app/main.py` → `app.health`). On the frontend, `App.tsx` renders
only `HealthPage`, and the typed client (`frontend/src/api/client.ts`) exposes
only `fetchHealth`.

| Layer | Existing evidence | Gap |
|---|---|---|
| Backend | `Note` in `app/models.py`; `notes` table in migration `0001`; `get_session` dependency in `app/health.py`; `create_app` includes only `health.router` | no endpoint lists notes |
| Frontend | `App.tsx` renders `HealthPage`; `client.ts` exports `Health`, `ApiError`, `fetchHealth`; `@small/ui` exports the `EmptyState` pattern | no notes view, no client call, no navigation to it |

Consequences:

1. The starter domain table is unobservable from the product: the schema and
   migration cannot be exercised end-to-end.
2. There is no worked example of the product's read path (session dependency →
   typed response model → typed client → page with loading / ready / empty /
   error states), which is the pattern the blueprint is meant to demonstrate.

This change is implementable on the current schema only. The future note
`body` column is **not** a dependency of any requirement below.

## 2. Scope

### 2.1 In scope

1. **Backend** — a read endpoint `GET /api/notes` returning the note list, with
   its integration test under `backend/tests/integration/`.
2. **Frontend** — `fetchNotes` added to `frontend/src/api/client.ts`; a new
   `frontend/src/pages/NotesPage.tsx` that renders the list and an
   `@small/ui` `EmptyState` when the list is empty; a link to the notes view
   rendered by `frontend/src/App.tsx`; a `NotesPage` component test following
   the `frontend/src/pages/HealthPage.test.tsx` pattern.

### 2.2 Out of scope

- Creating, updating, or deleting notes (endpoints or UI).
- Any schema, `app/models.py`, or migration change: no `body` / `excerpt`
  column is added and no new migration is created (the schema stays at revision
  `0001`). No requirement may read or render a note field other than `id`,
  `title`, `created_at`.
- Pagination, filtering, search, and user-selectable sorting.
- Authentication, authorization, multi-tenancy.
- Client-side routing: no router dependency is added. This change requires only
  that `App.tsx` renders the link; rendering `NotesPage` for the `/notes` path
  is not part of this change (the `/notes` path is served by the existing SPA
  fallback).
- Changes to the health endpoints/page, the Helm chart, `nginx.conf.template`,
  or the CI workflows.
- New components, patterns, or tokens in `@small/ui`; the page reuses the
  existing `EmptyState` pattern.
- Localisation, theming, and visual-regression baselines.

## 3. Requirements and acceptance criteria

Conventions: "must" is mandatory. Criterion IDs are `AC-<requirement>-<n>`.
Every criterion is checked either by an automated test listed in section 5 or
by a command whose exit status is the verdict. A criterion that cannot be
checked by one of those means is not acceptable.

### R1 — Backend endpoint `GET /api/notes`

The backend must expose `GET /api/notes`. It must respond `200` with a JSON
object whose only top-level field is `notes`, an array with one element per
row of the `notes` table. Each element must be an object with exactly `id`
(canonical UUID string), `title` (string), and `created_at` (timezone-aware
ISO-8601 string). The array must be ordered by `created_at` descending, ties
broken by `id` descending. An empty table must yield `{"notes": []}` with
`200`.

- **AC-R1-1** — A `GET /api/notes` against a PostgreSQL database returns `200`
  and a JSON body whose top-level key set is exactly `{"notes"}`.
- **AC-R1-2** — For each seeded note, `notes` contains an element whose `id`
  equals the seeded `id` (canonical UUID string) and whose `title` equals the
  seeded `title`.
- **AC-R1-3** — For every element, `created_at` is a string accepted by
  `datetime.fromisoformat`, and the parsed value's `tzinfo` is not `None`.
- **AC-R1-4** — When notes are seeded with distinct `created_at` values, the
  subsequence of `notes` restricted to the seeded ids is in strictly
  descending `created_at` order.
- **AC-R1-5** — After the `notes` table is empty, the body is exactly
  `{"notes": []}`.
- **AC-R1-6** — For every element, the key set is exactly
  `{"id", "title", "created_at"}`.

### R2 — Backend database failure

When PostgreSQL is unavailable, `GET /api/notes` must return `503`. It must not
return `200`, a partial list, or any other unhandled server error.

- **AC-R2-1** — With the session dependency overridden by a session whose
  query raises `SQLAlchemyError`, `GET /api/notes` returns `503`.

### R3 — Frontend API client

`frontend/src/api/client.ts` must export the `Note` type
(`{ id: string; title: string; created_at: string }`) and
`fetchNotes(fetchImpl: typeof fetch = fetch): Promise<Note[]>`. It must request
the relative path `/api/notes` (same-origin contract, ADR-021), resolve to the
`notes` array on a 2xx response, reject with `ApiError(0, "The API is
unreachable")` when the request itself fails, and reject with the
`parseError`-derived `ApiError` (HTTP status + `detail`) on a non-2xx response.

- **AC-R3-1** — `fetchNotes(fetchImpl)` calls `fetchImpl` with `"/api/notes"`.
- **AC-R3-2** — On a `200` response with body `{"notes": [n1, n2]}`, it
  resolves to `[n1, n2]`.
- **AC-R3-3** — On a non-2xx response with body `{"detail": "d"}`, it rejects
  with an `ApiError` whose `status` is the response status and whose `message`
  is `"d"`.
- **AC-R3-4** — When `fetchImpl` rejects, it rejects with an `ApiError` whose
  `status` is `0` and whose `message` is `"The API is unreachable"`.

### R4 — Notes page

`frontend/src/pages/NotesPage.tsx` must export `NotesPage`, fetch the list once
on mount via `fetchNotes`, and render exactly one of these states:

- **loading** — the text `Loading…`;
- **error** — an element with `role="alert"` whose text contains
  `Backend unavailable`, plus a button with accessible name `Retry` that
  re-invokes the fetch;
- **ready with notes** — a `role="list"` element with one `role="listitem"`
  per note, each item containing that note's `title` as text;
- **ready and empty** — the `EmptyState` pattern imported from `@small/ui`
  (which renders `role="status"`) with a non-empty title, and no
  `role="listitem"`.

- **AC-R4-1** — While the fetch promise is pending, the rendered output
  contains the text `Loading…`.
- **AC-R4-2** — Given a resolved list of N ≥ 1 notes, the output contains one
  `role="listitem"` per note, and each note's `title` text is present.
- **AC-R4-3** — Given a resolved empty list, the output contains a
  `role="status"` element with non-empty text and zero `role="listitem"`
  elements.
- **AC-R4-4** — Given a rejected fetch (`ApiError`), the output contains
  `role="alert"` text containing `Backend unavailable` and a `Retry` button;
  activating `Retry` invokes `fetchNotes` again.
- **AC-R4-5** — On mount, `fetchNotes` is invoked exactly once.

### R5 — App navigation link

`frontend/src/App.tsx` must render, on initial render, a link (`role="link"`)
with accessible name `Notes` and `href` `"/notes"`.

- **AC-R5-1** — Rendering `App` yields a `role="link"` named `Notes` whose
  `href` attribute equals `"/notes"`.

### R6 — Tests and gates

The change must ship the tests below and keep both existing gate suites green.

- **AC-R6-1** — `backend/tests/integration/test_notes_list.py` exists; when
  `APP_TEST_DATABASE_URL` is unset the module skips (not a failure), and when
  set it drives `GET /api/notes` over HTTP against PostgreSQL and checks
  AC-R1-1 … AC-R1-6.
- **AC-R6-2** — A backend unit test
  (`backend/tests/unit/test_notes.py`) overrides the session dependency and
  checks AC-R2-1 without a database.
- **AC-R6-3** — `frontend/src/api/client.test.ts` contains cases checking
  AC-R3-1 … AC-R3-4.
- **AC-R6-4** — `frontend/src/pages/NotesPage.test.tsx` exists, mocks
  `fetchNotes` following `HealthPage.test.tsx`, and checks AC-R4-1 … AC-R4-5.
- **AC-R6-5** — `frontend/src/App.test.tsx` exists and checks AC-R5-1.
- **AC-R6-6** — `cd backend && uv run ruff check . && uv run ruff format
  --check . && uv run mypy && uv run pytest` exits `0`.
- **AC-R6-7** — `cd frontend && npm run lint && npm run typecheck && npm run
  test` exits `0`.

### R7 — Constraints

- **AC-R7-1** — `frontend/package.json` `dependencies` and the
  `backend/pyproject.toml` dependency list are unchanged (no router, no new
  runtime dependency).
- **AC-R7-2** — App code imports `@small/ui` only from the package root (no
  deep import); `npm run lint` (Small UIKit policy) exits `0`.
- **AC-R7-3** — No new file is added under `backend/migrations/versions/`
  (schema stays at revision `0001`), and grep of the files added or changed by
  this change finds no `body` or `excerpt` note field.

## 4. Scenarios

End-to-end, observable flows. Each scenario is also recorded as a
`dark-factory.dev/scenario/v1` artifact under `.factory/scenarios/`.

| ID | Scenario artifact | Observable flow |
|---|---|---|
| S1 | `scenario:dark-factory-product-1:notes-list:notes-present` (`SCN-notes-list-notes-present.md`) | With notes in the database, opening the notes page shows one entry per note; the backend serves them through `GET /api/notes`. |
| S2 | `scenario:dark-factory-product-1:notes-list:empty-list` (`SCN-notes-list-empty-list.md`) | With no notes, the notes page shows the `EmptyState` and the backend returns `{"notes": []}`. |
| S3 | `scenario:dark-factory-product-1:notes-list:newest-first` (`SCN-notes-list-newest-first.md`) | With notes created at different times, the list is ordered newest-first. |
| S4 | `scenario:dark-factory-product-1:notes-list:api-unreachable` (`SCN-notes-list-api-unreachable.md`) | With the API unreachable, the notes page shows an error alert and `Retry` re-fetches. |
| S5 | `scenario:dark-factory-product-1:notes-list:database-unavailable` (`SCN-notes-list-database-unavailable.md`) | With PostgreSQL down, `GET /api/notes` answers `503`. |
| S6 | `scenario:dark-factory-product-1:notes-list:navigation` (`SCN-notes-list-navigation.md`) | On the app's first render, a link named `Notes` pointing at `/notes` is present. |

## 5. Traceability — criteria to scenarios

Every acceptance criterion above appears in exactly one row. "S1–S6" means the
criterion is a gate/constraint over all listed scenarios.

| Criterion | Requirement (short) | Scenario(s) | Verification |
|---|---|---|---|
| AC-R1-1 | `GET /api/notes` → 200, top-level key set `{notes}` | S1, S3 | `backend/tests/integration/test_notes_list.py` |
| AC-R1-2 | seeded `id` and `title` echoed | S1 | `backend/tests/integration/test_notes_list.py` |
| AC-R1-3 | `created_at` is timezone-aware ISO-8601 | S1 | `backend/tests/integration/test_notes_list.py` |
| AC-R1-4 | strictly descending `created_at` | S3 | `backend/tests/integration/test_notes_list.py` |
| AC-R1-5 | empty table → exactly `{"notes": []}` | S2 | `backend/tests/integration/test_notes_list.py` |
| AC-R1-6 | element key set exactly `{id, title, created_at}` | S1 | `backend/tests/integration/test_notes_list.py` |
| AC-R2-1 | database failure → `503` | S5 | `backend/tests/unit/test_notes.py` |
| AC-R3-1 | client requests `/api/notes` | S1 | `frontend/src/api/client.test.ts` |
| AC-R3-2 | 200 → resolves to `notes` array | S1 | `frontend/src/api/client.test.ts` |
| AC-R3-3 | non-2xx → `ApiError(status, detail)` | S4 | `frontend/src/api/client.test.ts` |
| AC-R3-4 | network failure → `ApiError(0, "The API is unreachable")` | S4 | `frontend/src/api/client.test.ts` |
| AC-R4-1 | pending → `Loading…` | S1 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R4-2 | one `listitem` per note, titles shown | S1 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R4-3 | empty list → `role="status"` `EmptyState`, no items | S2 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R4-4 | error → `role="alert"` + working `Retry` | S4 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R4-5 | exactly one fetch on mount | S1 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R5-1 | `Notes` link with `href="/notes"` | S6 | `frontend/src/App.test.tsx` |
| AC-R6-1 | integration test exists, skips without DSN | S1, S3 | file presence + `uv run pytest` |
| AC-R6-2 | 503 unit test without a database | S5 | file presence + `uv run pytest` |
| AC-R6-3 | `fetchNotes` client cases | S1, S4 | `frontend/src/api/client.test.ts` |
| AC-R6-4 | `NotesPage` component test | S1, S2, S4 | `frontend/src/pages/NotesPage.test.tsx` |
| AC-R6-5 | `App` link test | S6 | `frontend/src/App.test.tsx` |
| AC-R6-6 | backend gates green | S1–S5 | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |
| AC-R6-7 | frontend gates green | S1–S6 | `cd frontend && npm run lint && npm run typecheck && npm run test` |
| AC-R7-1 | no new runtime dependency | S6 | diff of `frontend/package.json` and `backend/pyproject.toml` |
| AC-R7-2 | kit imported only from `@small/ui` root | S1 | `cd frontend && npm run lint` |
| AC-R7-3 | schema unchanged, no `body`/`excerpt` field | S2, S3 | no new file under `backend/migrations/versions/`; grep of changed files |

Verification harness notes:

- Backend integration tests are gated by `APP_TEST_DATABASE_URL` (unset → the
  module skips, the suite stays green on a machine without PostgreSQL). CI
  provides a real PostgreSQL service (`.github/workflows/ci.yml`).
- The integration test must make its own assertions deterministic: it clears
  the `notes` table before the empty-list check (AC-R1-5) and, for the ordering
  check (AC-R1-4), compares the relative order of its own seeded ids so
  pre-existing rows cannot invalidate the expectation.
- Frontend component/unit tests run under vitest + jsdom with the setup file
  `frontend/src/test/setup.ts`; `vi.spyOn` on the `../api/client` module is the
  mocking pattern used by `HealthPage.test.tsx`.
