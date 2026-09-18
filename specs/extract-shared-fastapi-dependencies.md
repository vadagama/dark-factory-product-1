# Specification: Extract shared FastAPI dependencies without changing endpoint contracts

- **Change type:** Refactor (no behavior change)
- **Stage:** specification
- **Attempt:** 1
- **Affected surface:** `backend/src/app/health.py`, new `backend/src/app/deps.py`,
  `backend/tests/unit/test_health.py` (import path only)

## 1. Problem

`get_session` — the FastAPI dependency that yields an `AsyncSession` bound to
`request.app.state.sessionmaker` — is defined inside
`backend/src/app/health.py` (currently line 32), a module whose stated purpose is
the two health endpoints. As a result the database wiring of the whole backend is
reachable only by importing the health router module, so any future endpoint that
needs a session would create a spurious import dependency on `app.health` and its
HTTP concerns. The dependency has no health-specific behavior and belongs with
the other shared application wiring (compare `app/db.py`, which owns engine and
sessionmaker construction).

The refactor must not change the observable HTTP contract of the two existing
endpoints (`GET /`, `GET /api/healthz`) and must preserve the
`app.dependency_overrides[get_session]` test seam used by the unit tests.

## 2. Scope

### 2.1 In scope

1. Create `backend/src/app/deps.py` as the home of the shared FastAPI
   dependencies and move the `get_session` definition into it, byte-for-byte in
   behavior (same name, same decorators/annotations, same body semantics).
2. Change `backend/src/app/health.py` to import `get_session` from
   `backend/src/app/deps.py` and keep using it via `Depends(get_session)`; remove
   the local definition.
3. Update the import path of `get_session` in
   `backend/tests/unit/test_health.py` (currently
   `from app.health import get_session`) to the new module.

### 2.2 Out of scope

1. No change to the HTTP contract of any route: methods, paths, status codes,
   response models (`AppInfo`, `HealthResponse`), and JSON response bodies stay
   exactly as they are today.
2. No new endpoints, routes, dependencies, settings, or public re-exports
   (e.g. no `app.deps.get_session` re-export from `app.health` or `app.__init__`).
3. No change to `backend/src/app/main.py`, `backend/src/app/db.py`,
   `backend/src/app/config.py`, `backend/src/app/models.py`, migrations, or the
   Helm chart.
4. No behavior change to `get_session` itself: it still yields a session from
   `request.app.state.sessionmaker` and closes it on exit; it still performs no
   I/O at import time.
5. No edits to committed test logic or assertions; only the `get_session` import
   path may change in the committed test files. Verification scripts in §4 are
   run ad hoc and are not committed as product tests.

## 3. Requirements and acceptance criteria

Each acceptance criterion is stated so that it can be checked mechanically by the
scenario named in §4 (see traceability in §5).

### R1 — `get_session` lives in `backend/src/app/deps.py`

- **AC1.1** `backend/src/app/deps.py` exists and defines a module-level
  `async def get_session(request: Request) -> AsyncIterator[AsyncSession]` (an
  async generator dependency) whose body is semantically identical to the
  current definition: it reads `request.app.state.sessionmaker` and yields a
  session while inside `async with sessionmaker() as session:`.
- **AC1.2** `import app.deps` succeeds with no `DATABASE_URL` in the environment
  and with no database server reachable; importing the module creates no engine,
  opens no connection, and resolves no settings.
- **AC1.3** Calling `get_session(request)` yields exactly one `AsyncSession`
  taken from `request.app.state.sessionmaker`, and the underlying session is
  closed when the generator is exhausted.

### R2 — `health.py` consumes the dependency from `deps.py`

- **AC2.1** `backend/src/app/health.py` contains
  `from app.deps import get_session` and contains no `async def get_session`
  definition.
- **AC2.2** `GET /api/healthz` declares its session parameter as
  `Annotated[AsyncSession, Depends(get_session)]`, resolving `get_session` to the
  object exported by `app.deps`.
- **AC2.3** `app.health.get_session is app.deps.get_session` (one shared object,
  no second divergent definition).

### R3 — Endpoint contracts are byte-identical

- **AC3.1** `GET /` returns HTTP `200` with a JSON body exactly equal to
  `{"app": <Settings.app_name>, "version": app.__version__}` (field order
  preserved by the unchanged `AppInfo` model), and the handler does not touch
  `request.app.state.sessionmaker`.
- **AC3.2** `GET /api/healthz` returns HTTP `200` with a JSON body exactly equal
  to `{"status": "ok", "database": "ok"}` when the session's `execute` succeeds.
- **AC3.3** `GET /api/healthz` returns HTTP `503` with a JSON body exactly equal
  to `{"detail": "database unavailable"}` when the session's `execute` raises a
  `SQLAlchemyError`.
- **AC3.4** The generated OpenAPI document for the app is unchanged relative to
  the pre-refactor document: same path set (`/`, `/api/healthz`), same methods,
  same `response_model` references (`AppInfo`, `HealthResponse`), and same
  declared success/error status codes for both routes.

### R4 — The `dependency_overrides` test seam is preserved

- **AC4.1** Assigning
  `application.dependency_overrides[app.deps.get_session] = fake_session` causes
  `GET /api/healthz` to use `fake_session` in place of the real dependency.
- **AC4.2** Removing that override restores the real `app.deps.get_session`
  behavior for subsequent requests (the override leaves no residual state).

### R5 — Existing tests pass with import-path-only changes

- **AC5.1** The existing backend unit suite (`backend/tests/unit/`) passes with
  no changes other than the `get_session` import path in
  `backend/tests/unit/test_health.py`.
- **AC5.2** No assertion, test name, fixture, or expected value in
  `backend/tests/unit/test_health.py`,
  `backend/tests/unit/test_config.py`, or
  `backend/tests/integration/test_health_database.py` is modified.
- **AC5.3** `backend/tests/integration/test_health_database.py` still passes when
  `APP_TEST_DATABASE_URL` is set, and still skips cleanly when it is unset.

### R6 — No new functionality and no unrelated churn

- **AC6.1** The refactor diff touches only `backend/src/app/deps.py` (new),
  `backend/src/app/health.py`, and the `get_session` import line in
  `backend/tests/unit/test_health.py`.
- **AC6.2** The set of available routes is exactly `{GET /, GET /api/healthz}`
  after the change (no additions, no removals).
- **AC6.3** Static checks already configured for the backend (ruff, mypy) pass
  on the changed modules.

## 4. Scenarios

Scenarios are the concrete checks that demonstrate the acceptance criteria. S1–S5,
S9, S10 each map to an existing automated test; S6–S8 and S11–S16 are verification
commands/scripts run ad hoc during review (they are not committed as product
tests, consistent with §2.2.5).

- **S1 — `test_healthz_reports_ok_without_a_real_database`**
  (existing, `backend/tests/unit/test_health.py`): overrides the dependency with
  a stub via `app.dependency_overrides[get_session]` and asserts `200` +
  `{"status": "ok", "database": "ok"}`. Covers AC4.1, AC3.2, AC2.2.
- **S2 — `test_healthz_returns_503_when_the_database_fails`**
  (existing, same file): stub raises `SQLAlchemyError`, asserts `503`. Covers
  AC3.3.
- **S3 — `test_root_reports_app_metadata_without_the_database`**
  (existing, same file): asserts `200` and the exact `AppInfo` body. Covers
  AC3.1.
- **S4 — `test_healthz_answers_with_a_real_database`**
  (existing, `backend/tests/integration/test_health_database.py`): asserts `200`
  + exact body against real PostgreSQL. Covers AC3.2, AC5.3.
- **S5 — `test_root_answers_with_a_real_database_configured`**
  (existing, same integration file): asserts `200`. Covers AC3.1, AC5.3.
- **S6 — hermetic import check:**
  `cd backend && env -u DATABASE_URL .venv/bin/python -c "import app.deps"` exits
  `0` with no database reachable and creates no engine. Covers AC1.2.
- **S7 — module-structure check:**
  `grep -n "async def get_session" backend/src/app/health.py` returns no match;
  `grep -n "from app.deps import get_session" backend/src/app/health.py` returns a
  match; `grep -n "async def get_session" backend/src/app/deps.py` returns a
  match. Covers AC2.1, AC1.1.
- **S8 — OpenAPI comparison:**
  generate `create_app(settings).openapi()` at the post-change revision and at
  the pre-change base revision (e.g. via a separate worktree/`git stash`) and
  assert the two documents are equal. Covers AC3.4.
- **S9 — unit suite:** `cd backend && uv run pytest tests/unit` passes. Covers
  AC5.1, AC5.2.
- **S10 — integration suite:** `cd backend && APP_TEST_DATABASE_URL=... uv run
  pytest tests/integration` passes; run once without the variable to confirm the
  skip. Covers AC5.3.
- **S11 — change-scope check:** `git diff --name-only` lists only
  `backend/src/app/deps.py`, `backend/src/app/health.py`, and
  `backend/tests/unit/test_health.py`; the diff of the test file contains only
  the changed import line. Covers AC6.1, AC5.2.
- **S12 — lint/type-check:** `cd backend && uv run ruff check . && uv run mypy
  src` pass. Covers AC6.3.
- **S13 — route inventory:** inspect the OpenAPI `paths` keys and assert they are
  exactly `{"/", "/api/healthz"}`. Covers AC6.2, AC3.4.
- **S14 — dependency identity check:**
  `cd backend && .venv/bin/python -c "import app.health, app.deps;
  assert app.health.get_session is app.deps.get_session"` exits `0`. Covers
  AC2.3.
- **S15 — real generator behavior check:** invoke `app.deps.get_session` directly
  with a minimal request object whose `app.state.sessionmaker` returns an async
  context manager that records `__aenter__`/`__aexit__`: assert exactly one
  session is yielded, that it is the one produced by the sessionmaker, and that
  `__aexit__` ran after the generator is exhausted. Covers AC1.3.
- **S16 — override lifecycle check:** in an ad hoc script, add
  `dependency_overrides[app.deps.get_session]` and assert `/api/healthz` uses it;
  then remove the override (`application.dependency_overrides.clear()`) and,
  using a stub-backed app state, assert the real `app.deps.get_session` is used
  again. Covers AC4.2.

## 5. Traceability (criteria → scenarios)

| Criterion | Scenarios |
|-----------|-----------|
| AC1.1 | S7 |
| AC1.2 | S6 |
| AC1.3 | S15 |
| AC2.1 | S7 |
| AC2.2 | S1 |
| AC2.3 | S14 |
| AC3.1 | S3, S5 |
| AC3.2 | S1, S4 |
| AC3.3 | S2 |
| AC3.4 | S8, S13 |
| AC4.1 | S1 |
| AC4.2 | S16 |
| AC5.1 | S9 |
| AC5.2 | S11 |
| AC5.3 | S4, S5, S10 |
| AC6.1 | S11 |
| AC6.2 | S13 |
| AC6.3 | S12 |

## 6. Definition of done

The change is complete when every criterion in §3 has a passing result from its
mapped scenario(s) in §5, the scenarios in §4 have been executed, and the
endpoint contracts of `GET /` and `GET /api/healthz` are byte-identical to their
pre-refactor form.
