# Change Request — Extract shared FastAPI dependencies without changing endpoint contracts

- **ID:** CR-extract-shared-fastapi-dependencies
- **Stage:** planning
- **Attempt:** 1
- **Change type:** Refactor (no behavior change, no new functionality)
- **Source specification:** `specs/extract-shared-fastapi-dependencies.md`
- **Affected surface:** `backend/src/app/deps.py` (new), `backend/src/app/health.py`,
  `backend/tests/unit/test_health.py` (import path only)

This document is self-contained: a reviewer can approve, reject or implement this
change without reading the originating task thread.

---

## 1. Change summary

Move the FastAPI dependency `get_session` out of `backend/src/app/health.py`
(where it is currently defined) into a new module `backend/src/app/deps.py`, and
have `health.py` import it from there. `get_session` is an async-generator
dependency that reads `request.app.state.sessionmaker` and yields an
`AsyncSession` bound to it.

Nothing else changes:

- `GET /` and `GET /api/healthz` keep their paths, methods, handlers, response
  models (`AppInfo`, `HealthResponse`), status codes and JSON bodies
  byte-for-byte.
- The `app.dependency_overrides[get_session]` test seam continues to work,
  because `health.py` and the tests keep referring to the same function object.
- The only edition to committed tests is the `get_session` import line in
  `backend/tests/unit/test_health.py`; no assertion, fixture, test name or
  expected value is touched.

The refactor is a pure module-boundary change: one function moves, two import
statements change, and two now-unused imports (`AsyncIterator`,
`async_sessionmaker`) are dropped from `health.py`.

## 2. Motivation

`get_session` is generic application wiring — it has no health-specific logic. It
currently lives in a module whose stated purpose is the two health endpoints, so
any future endpoint that needs a database session would have to import
`app.health` (and its HTTP concerns) just to obtain the dependency. That is a
spurious coupling and the wrong home for shared wiring; compare
`backend/src/app/db.py`, which already owns engine and sessionmaker
construction.

Extracting `get_session` into `backend/src/app/deps.py` gives shared
dependencies an obvious import location, and makes the "shared wiring" vs.
"endpoint module" split explicit, without any behavioral or contractual change.
This is preparatory hygiene for any endpoint added later; it delivers no
user-visible value on its own, which is why the scope is deliberately strict.

## 3. Scope

### 3.1 In scope

1. Create `backend/src/app/deps.py` as the home of shared FastAPI dependencies
   and move the `get_session` definition into it, preserving semantics exactly
   (same name, same signature `async def get_session(request: Request) ->
   AsyncIterator[AsyncSession]`, same body).
2. Edit `backend/src/app/health.py` to import `get_session` from `app.deps`,
   keep using it as `Annotated[AsyncSession, Depends(get_session)]`, delete the
   local definition, and drop the two imports that become unused
   (`collections.abc.AsyncIterator`, `sqlalchemy.ext.asyncio.async_sessionmaker`).
3. Update the `get_session` import path in
   `backend/tests/unit/test_health.py` from `app.health` to `app.deps`.

### 3.2 Out of scope (explicitly not part of this change)

1. Any change to the HTTP contract of any route: methods, paths, status codes,
   response models, response bodies, or the generated OpenAPI document.
2. No new endpoints, routes, dependencies, settings or public re-exports
   (in particular, no `get_session` re-export from `app.health` or `app/__init__.py`).
3. No change to `backend/src/app/main.py`, `backend/src/app/db.py`,
   `backend/src/app/config.py`, `backend/src/app/models.py`, migrations, or the
   Helm chart.
4. No behavior change to `get_session` itself: still no I/O at import time, still
   one session per call taken from `request.app.state.sessionmaker`, still closed
   when the generator is exhausted.
5. No edits to committed test logic or assertions — only the `get_session` import
   line in `backend/tests/unit/test_health.py` may change. The ad hoc verification
   scripts in §6 are run during review and are not committed.
6. No renaming, no reformatting, no drive-by tidying of unrelated code.

## 4. Refined requirements and acceptance criteria

Every criterion is mechanically checkable; scenario references point at §6.

### R1 — `get_session` lives in `backend/src/app/deps.py`

- **AC1.1** `backend/src/app/deps.py` exists and defines a module-level
  `async def get_session(request: Request) -> AsyncIterator[AsyncSession]` whose
  body is semantically identical to the current definition: it reads
  `request.app.state.sessionmaker` and yields a session inside
  `async with sessionmaker() as session:`.
- **AC1.2** `import app.deps` succeeds with no `DATABASE_URL` set and no database
  reachable; importing the module creates no engine, opens no connection and
  resolves no settings.
- **AC1.3** Calling `get_session(request)` yields exactly one `AsyncSession`
  produced by `request.app.state.sessionmaker`, and the underlying session is
  closed when the generator is exhausted.

### R2 — `health.py` consumes the dependency from `deps.py`

- **AC2.1** `backend/src/app/health.py` contains
  `from app.deps import get_session` and contains no `async def get_session`
  definition.
- **AC2.2** `GET /api/healthz` still declares its session parameter as
  `Annotated[AsyncSession, Depends(get_session)]`, resolving `get_session` to the
  object exported by `app.deps`.
- **AC2.3** `app.health.get_session is app.deps.get_session` — one shared object,
  no second divergent definition.

### R3 — Endpoint contracts are byte-identical

- **AC3.1** `GET /` returns `200` with a JSON body exactly equal to
  `{"app": <Settings.app_name>, "version": app.__version__}` (field order
  preserved by the unchanged `AppInfo` model), and the handler does not touch
  `request.app.state.sessionmaker`.
- **AC3.2** `GET /api/healthz` returns `200` with a JSON body exactly equal to
  `{"status": "ok", "database": "ok"}` when the session's `execute` succeeds.
- **AC3.3** `GET /api/healthz` returns `503` with a JSON body exactly equal to
  `{"detail": "database unavailable"}` when the session's `execute` raises a
  `SQLAlchemyError`.
- **AC3.4** The generated OpenAPI document is unchanged relative to the
  pre-refactor document: same path set (`/`, `/api/healthz`), same methods, same
  `response_model` references (`AppInfo`, `HealthResponse`), same declared
  success/error status codes.

### R4 — The `dependency_overrides` test seam is preserved

- **AC4.1** Assigning
  `application.dependency_overrides[app.deps.get_session] = fake_session` makes
  `GET /api/healthz` use `fake_session` instead of the real dependency.
- **AC4.2** Removing the override restores the real `app.deps.get_session`
  behavior for subsequent requests (no residual state).

### R5 — Existing tests pass with import-path-only changes

- **AC5.1** The existing backend unit suite (`backend/tests/unit/`) passes with no
  change other than the `get_session` import path in
  `backend/tests/unit/test_health.py`.
- **AC5.2** No assertion, test name, fixture or expected value in
  `backend/tests/unit/test_health.py`, `backend/tests/unit/test_config.py` or
  `backend/tests/integration/test_health_database.py` is modified.
- **AC5.3** `backend/tests/integration/test_health_database.py` passes when
  `APP_TEST_DATABASE_URL` is set and skips cleanly when it is unset.

### R6 — No new functionality and no unrelated churn

- **AC6.1** The diff touches only `backend/src/app/deps.py` (new),
  `backend/src/app/health.py`, and the `get_session` import line in
  `backend/tests/unit/test_health.py`.
- **AC6.2** The available route set is exactly `{GET /, GET /api/healthz}` after
  the change — nothing added or removed.
- **AC6.3** The backend's configured static checks (ruff, mypy) pass on the
  changed modules, including no unused-import findings in `health.py`.

## 5. Ordered task list with dependencies

| # | Task | Depends on | Delivers |
|---|------|-----------|----------|
| T1 | Create `backend/src/app/deps.py` and move `get_session` into it verbatim | — | AC1.1–1.3 |
| T2 | Rewire `backend/src/app/health.py` to import from `app.deps`; delete the local definition and the two unused imports | T1 | AC2.1–2.3, AC3.1–3.3, AC6.2 |
| T3 | Update the `get_session` import path in `backend/tests/unit/test_health.py` to `app.deps` | T1 | AC5.1, AC5.2 |
| T4 | Contract verification: OpenAPI diff vs. base revision and route inventory | T2 | AC3.4, AC6.2 |
| T5 | Run the test suites: unit; integration with and without `APP_TEST_DATABASE_URL` | T2, T3 | AC5.1–5.3 |
| T6 | Run ad hoc dependency checks: hermetic import, identity, generator lifecycle, override lifecycle | T2 | AC1.2, AC1.3, AC2.3, AC4.2 |
| T7 | Lint/type-check and change-scope check (`git diff --name-only`) | T1–T3 | AC6.1, AC6.3 |

Ordering constraints:

- **T1 before T2/T3.** The new module must exist before anything imports it.
- **T2 and T3 must land in the same commit.** Removing `get_session` from
  `health.py` (T2) breaks the committed test's
  `from app.health import get_session` import until T3 lands; committing either
  alone leaves the suite red.
- **T5 needs T2 and T3** because the unit tests both import the moved dependency
  and exercise `health.py`. Integration tests need only T2.
- **T4, T5, T6 can run in any order once their inputs are in place; all precede
  T7's final scope check.**

### T1 — Create `backend/src/app/deps.py` with `get_session`

- **Deliverable:** new module containing a module docstring and:

  ```python
  async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
      """FastAPI dependency yielding a session bound to the app's engine."""
      sessionmaker: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
      async with sessionmaker() as session:
          yield session
  ```

- **Imports:** `collections.abc.AsyncIterator`, `fastapi.Request`,
  `sqlalchemy.ext.asyncio.{AsyncSession, async_sessionmaker}`. No import of
  `app`, `app.db`, `app.config` or `app.health`; nothing executes at import time.
- **Note:** the function body/docstring are copied unchanged. The only unavoidable
  difference is `get_session.__module__` becoming `app.deps`, which is not part of
  the HTTP contract and has no consumer in the repository.
- **Check:** AC1.1 via S7; AC1.2 via S6; AC1.3 via S15.

### T2 — Rewire `backend/src/app/health.py`

- **Deliverable:**
  - Add `from app.deps import get_session`; delete the local
    `async def get_session(...)` definition.
  - Remove the now-unused imports `from collections.abc import AsyncIterator` and
    `async_sessionmaker` from the `sqlalchemy.ext.asyncio` import.
  - Leave `router`, `AppInfo`, `HealthResponse`, `index`, `healthz` and their
    decorators/annotations untouched (`Depends(get_session)` unchanged as an
    expression; only the name's origin changes).
- **Check:** AC2.1/AC2.2 via S7 and S1; AC2.3 via S14; AC3.x via S1–S5, S8, S13.

### T3 — Update the test import

- **Deliverable:** in `backend/tests/unit/test_health.py`, change
  `from app.health import get_session` to `from app.deps import get_session`
  (line 13 today). No other edit in the file.
- **Check:** AC5.1/AC5.2 via S9 and S11.

### T4 — Contract verification

- Generate `create_app(settings).openapi()` at the post-change revision and at the
  pre-change base revision (separate worktree or `git stash`) and assert equality.
- Assert the OpenAPI `paths` keys are exactly `{"/", "/api/healthz"}`.
- **Check:** AC3.4 via S8; AC6.2 via S13.

### T5 — Test suites

- `cd backend && uv run pytest tests/unit`.
- `cd backend && APP_TEST_DATABASE_URL=... uv run pytest tests/integration`, then
  rerun without the variable to confirm the clean skip.
- **Check:** AC5.1–5.3 via S9, S10, S4, S5.

### T6 — Ad hoc dependency checks

- Hermetic import: `cd backend && env -u DATABASE_URL .venv/bin/python -c "import app.deps"`.
- Identity: `python -c "import app.health, app.deps; assert app.health.get_session is app.deps.get_session"`.
- Generator lifecycle: call `app.deps.get_session` with a minimal request whose
  `app.state.sessionmaker` records `__aenter__`/`__aexit__`; assert exactly one
  session is yielded and `__aexit__` ran after exhaustion.
- Override lifecycle: add `dependency_overrides[app.deps.get_session]`, assert
  `/api/healthz` uses it, clear the override, assert the real dependency is used
  again against stub-backed app state.
- **Check:** AC1.2 via S6; AC1.3 via S15; AC2.3 via S14; AC4.2 via S16.

### T7 — Static checks and scope check

- `cd backend && uv run ruff check . && uv run mypy src`.
- `git diff --name-only` must list only `backend/src/app/deps.py`,
  `backend/src/app/health.py`, `backend/tests/unit/test_health.py`, and the test
  file's diff must contain only the changed import line.
- **Check:** AC6.1 via S11; AC6.3 via S12.

## 6. Scenario map (criteria → checks)

Anchored backwards to the acceptance criteria so review can be traced.

| Scenario | What it is | Criteria |
|----------|-----------|----------|
| S1 | existing `test_healthz_reports_ok_without_a_real_database` (override → 200, exact body) | AC4.1, AC3.2, AC2.2 |
| S2 | existing `test_healthz_returns_503_when_the_database_fails` | AC3.3 |
| S3 | existing `test_root_reports_app_metadata_without_the_database` | AC3.1 |
| S4 | existing integration `test_healthz_answers_with_a_real_database` | AC3.2, AC5.3 |
| S5 | existing integration `test_root_answers_with_a_real_database_configured` | AC3.1, AC5.3 |
| S6 | ad hoc hermetic `import app.deps` without `DATABASE_URL` | AC1.2 |
| S7 | ad hoc grep of module structure (`async def get_session` / import line) | AC1.1, AC2.1 |
| S8 | ad hoc OpenAPI equality vs. base revision | AC3.4 |
| S9 | ad hoc `uv run pytest tests/unit` | AC5.1, AC5.2 |
| S10 | ad hoc integration run with/without `APP_TEST_DATABASE_URL` | AC5.3 |
| S11 | ad hoc `git diff --name-only` scope check | AC6.1, AC5.2 |
| S12 | ad hoc `ruff check . && mypy src` | AC6.3 |
| S13 | ad hoc route inventory from OpenAPI `paths` | AC6.2, AC3.4 |
| S14 | ad hoc dependency identity assert | AC2.3 |
| S15 | ad hoc real-generator behavior check | AC1.3 |
| S16 | ad hoc override add/remove lifecycle check | AC4.2 |

## 7. Risks, assumptions and rollback

- **Assumption:** `get_session` has exactly one production consumer
  (`healthz` in `health.py`) and one test consumer
  (`backend/tests/unit/test_health.py`); repo-wide search for `get_session`
  confirms no other importer or re-export.
- **Risk — broken override seam:** if `health.py` kept a local copy while the
  tests imported `app.deps.get_session`, FastAPI would key the override on a
  different object and the unit tests would silently hit the real sessionmaker.
  Mitigated by deleting the local definition (T2) and by the identity check S14.
- **Risk — non-atomic commit:** shipping T2 without T3 leaves an import error in
  the committed unit suite. Mitigated by the same-commit constraint in §5.
- **Risk — accidental contract drift:** guarded by the OpenAPI equality check
  (S8) and the exact-body assertions already in the suites (S1–S5).
- **Rollback:** revert the commit; the change is self-contained (one new module,
  two import-line edits) and has no data, config or migration footprint.

## 8. Definition of done

The change is complete when every criterion in §3 has a passing result from its
mapped scenario, all tasks T1–T7 are done in the stated order with T2+T3 in one
commit, and the `GET /` and `GET /api/healthz` contracts are byte-identical to
their pre-refactor form.
