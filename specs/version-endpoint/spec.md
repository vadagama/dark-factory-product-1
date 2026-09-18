# Specification: `GET /api/version`

- **Change:** New `GET /api/version` endpoint with an integration test.
- **Stage:** specification (attempt 1).
- **Status:** proposed.
- **Related code:** `backend/src/app/health.py`, `backend/src/app/main.py`,
  `backend/src/app/config.py`, `backend/src/app/__init__.py`,
  `backend/tests/unit/test_health.py`,
  `backend/tests/integration/test_health_database.py`.

## Problem

Operators and clients cannot read the running backend's application name and
version through the API. Today only `GET /` (`backend/src/app/health.py`)
returns that metadata, and it is a liveness/root route rather than a stable
`/api/...` surface. As a result:

- a deploy cannot confirm *which* app/version is live from the documented API
  namespace without scraping a human-facing root route;
- any future middleware or gateway rule scoped to `/api/*` (auth, routing,
  rate limiting) would skip the only metadata route.

`GET /api/version` closes that gap by exposing the same trustworthy metadata
(`{"app": <app_name>, "version": app.__version__}`) on the API surface, and it
must stay a pure metadata read: **no authentication and no database
connectivity**. The `version` value must come from the single source of truth
`app.__version__` (`backend/src/app/__init__.py`) so it cannot drift from the
package.

There is no existing specification section in this repository (no `specs/`,
`## Problem`, or acceptance-criteria markers were found), so this document
establishes the layout for the change.

## Scope

In scope:

- A new backend route `GET /api/version` registered on the app built by
  `create_app` (`backend/src/app/main.py`).
- Response body `{"app": <app_name>, "version": <app.__version__>}`, where
  `<app_name>` is the `Settings.app_name` used to construct the app.
- Reuse of the existing `AppInfo` response model in
  `backend/src/app/health.py` for the payload shape.
- A new integration test `backend/tests/integration/test_version.py` following
  the DSN-skip pattern of `backend/tests/integration/test_health_database.py`.
- Documentation of the endpoint alongside the existing endpoints in
  `README.md`.

Out of scope:

- Changing `GET /` or `GET /api/healthz` behavior.
- Any frontend consumption, UI, or client (`frontend/src/api/client.ts`) work.
- Authentication, authorization, API keys, or gateway rules for the route.
- Database access, schema changes, or Alembic migrations.
- Bumping `app.__version__` or `Settings.app_name` defaults.
- Cache headers, ETag, content negotiation, CORS, or OpenAPI metadata changes
  beyond the route's default schema.
- A `/api/version` in a new router module is permitted, but adding a second
  router file is not required; either placement is acceptable as long as the
  route is included by `create_app`.

## Requirements and acceptance criteria

Every criterion below is checkable by an automated test or a direct code/HTTP
inspection.

### R1 — Route exists and is reachable through the app factory

Criterion **AC-1**: `create_app(settings)` exposes `GET /api/version`; an
`httpx.ASGITransport` request to `/api/version` on that app returns HTTP `200`
(not `404`, not `405`).

Criterion **AC-2**: The route is a `GET`; the path is exactly `/api/version`.
`OPTIONS`/`POST` need not be asserted, but a plain `GET` must resolve to the
endpoint rather than a catch-all.

### R2 — Response payload is exactly app name + version

Criterion **AC-3**: For an app built with `Settings(app_name=X)`, the `200`
response body equals `{"app": X, "version": app.__version__}` with no extra
keys (exact JSON equality, as in the existing
`test_root_reports_app_metadata_without_the_database`).

Criterion **AC-4**: With the default `Settings`, `app` equals
`"dark-factory-product-1"` (the `Settings.app_name` default in
`backend/src/app/config.py`) and `version` equals `app.__version__`
(currently `"0.1.0"` in `backend/src/app/__init__.py`) — the value is read
from the package, not hardcoded in the route.

Criterion **AC-5**: Both fields are JSON strings and the response
`Content-Type` is `application/json` (guaranteed by reusing the `AppInfo`
`response_model`).

### R3 — No authentication required

Criterion **AC-6**: A request to `/api/version` sent **without** any
`Authorization`, `Cookie`, or API-key header returns the R2 payload with
HTTP `200` — i.e. never `401` or `403`.

### R4 — No database connectivity required

Criterion **AC-7**: An app built with a `database_url` that points to no
reachable PostgreSQL instance still returns HTTP `200` with the R2 payload on
`GET /api/version`. (SQLAlchemy engine creation is lazy in
`backend/src/app/db.py`; the endpoint must not depend on the session.)

Criterion **AC-8**: The version route's handler does not depend on the
`get_session` dependency and does not execute any SQL: it returns
`AppInfo(app=..., version=...)` without calling `session.execute`.

### R5 — Integration test follows the existing pattern

Criterion **AC-9**: `backend/tests/integration/test_version.py` exists and
skips (rather than fails) when `APP_TEST_DATABASE_URL` is unset, using the
same `pytestmark = pytest.mark.skipif(...)` pattern and constant name as
`backend/tests/integration/test_health_database.py`.

Criterion **AC-10**: When `APP_TEST_DATABASE_URL` is set, the integration test
builds the app with `create_app(Settings(database_url=...))`, drives it through
`httpx.ASGITransport` and asserts HTTP `200` plus the exact R2 body against a
real PostgreSQL instance.

### R6 — No regression, no new configuration

Criterion **AC-11**: The existing `GET /` and `GET /api/healthz` responses are
unchanged by this change (the root still returns
`{"app": ..., "version": ...}` and `/api/healthz` still returns
`{"status": "ok", "database": "ok"}` when the database answers).

Criterion **AC-12**: No new environment variable is introduced; the endpoint
is configurable only through the existing `Settings.app_name`. The repo's
`backend/tests/unit` and `backend/tests/integration` suites remain green
(integration limited to tests whose DSN env var is set).

Criterion **AC-13**: `README.md` lists `GET /api/version` in the endpoints
paragraph next to `GET /` and `GET /api/healthz`.

## Scenarios

Scenarios are described Given/When/Then; each maps to the criteria above and is
realizable as a pytest test using `httpx.ASGITransport`.

- **S1 — Version route resolves (AC-1, AC-2).**
  Given an app built by `create_app(Settings(app_name="dark-factory-product-1",
  database_url=<any>)`;
  When a client issues `GET /api/version` without special headers;
  Then the status is `200`.

- **S2 — Exact payload with a custom app name and live DB (AC-3, AC-5,
  AC-10).**
  Given an app built with `Settings(app_name="custom-app", database_url=<real
  DSN>)`;
  When the client issues `GET /api/version`;
  Then the status is `200`, `Content-Type` starts with `application/json`, and
  the JSON body equals `{"app": "custom-app", "version": app.__version__}`
  exactly (same value as `backend/src/app/__init__.py`).

- **S3 — Default metadata (AC-4).**
  Given an app built with default `Settings` (only `database_url` supplied);
  When the client issues `GET /api/version`;
  Then `app` is `"dark-factory-product-1"` and `version` is
  `app.__version__`.

- **S4 — Anonymous request succeeds (AC-6).**
  Given the app from S3;
  When the client issues `GET /api/version` with no `Authorization`, `Cookie`,
  or API-key header;
  Then the status is `200` and the body is the R2 payload (no `401`/`403`).

- **S5 — Unreachable database still answers (AC-7, AC-8).**
  Given an app built with
  `Settings(database_url="postgresql+psycopg://stub:stub@127.0.0.1:1/stub")`
  (no server listening);
  When the client issues `GET /api/version`;
  Then the status is `200` and the body is the R2 payload, proving the handler
  performs no database I/O.

- **S6 — Integration suite skips without a DSN (AC-9).**
  Given `APP_TEST_DATABASE_URL` is not set;
  When pytest collects `backend/tests/integration/test_version.py`;
  Then the test(s) report as skipped, not failed.

- **S7 — Integration suite runs against PostgreSQL (AC-10).**
  Given `APP_TEST_DATABASE_URL` points at a running PostgreSQL instance;
  When pytest runs `backend/tests/integration/test_version.py`;
  Then the version test executes and asserts `200` plus the exact R2 body.

- **S8 — No regression on existing endpoints (AC-11, AC-12).**
  Given the app from S3 and the existing unit/integration suites;
  When the existing tests run plus `GET /` and `GET /api/healthz` are called;
  Then their responses are unchanged and all suites stay green.

- **S9 — Documentation updated (AC-13).**
  Given the repository;
  When `README.md`'s endpoints paragraph is read;
  Then it names `GET /api/version` alongside `GET /` and `GET /api/healthz`.

## Traceability matrix

| Requirement | Acceptance criteria | Scenarios | Checked by |
|---|---|---|---|
| R1 — route exists | AC-1, AC-2 | S1 | `backend/tests/integration/test_version.py` (and unit test for hermetic run) |
| R2 — exact payload | AC-3, AC-4, AC-5 | S2, S3 | `backend/tests/integration/test_version.py`; `backend/tests/unit/test_health.py` |
| R3 — no auth | AC-6 | S4 | `backend/tests/integration/test_version.py` |
| R4 — no database | AC-7, AC-8 | S5 | `backend/tests/integration/test_version.py` (unreachable-DSN case); code inspection of `backend/src/app/health.py` |
| R5 — integration pattern | AC-9, AC-10 | S6, S7 | `backend/tests/integration/test_version.py`; collection with/without `APP_TEST_DATABASE_URL` |
| R6 — no regression / no config | AC-11, AC-12, AC-13 | S8, S9 | existing `backend/tests/**`; `README.md` |

### Criteria-to-scenario coverage check

- AC-1 → S1; AC-2 → S1; AC-3 → S2; AC-4 → S3; AC-5 → S2; AC-6 → S4;
  AC-7 → S5; AC-8 → S5; AC-9 → S6; AC-10 → S2, S7; AC-11 → S8; AC-12 → S8;
  AC-13 → S9. Every criterion is mapped to at least one scenario, and every
  scenario maps to at least one criterion.
