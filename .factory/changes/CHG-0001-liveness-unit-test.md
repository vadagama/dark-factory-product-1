---
schema: dark-factory.dev/specification/v1
id: spec:dark-factory-product-1:2026:liveness-unit-test
type: specification
title: Unit test for the GET / liveness endpoint
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0002
---

# Specification — Unit test for the GET / liveness endpoint

## 1. Problem

The liveness endpoint is implemented by `index()` at `backend/src/app/health.py:39-42` as
`@router.get("/", response_model=AppInfo)`, returning
`AppInfo(app=request.app.title, version=app.__version__)`, where `AppInfo` has fields
`app` and `version` (`backend/src/app/health.py:22-25`). `request.app.title` is set from
`Settings.app_name` in `create_app` (`backend/src/app/main.py:32`), and `app.__version__` is
`"0.1.0"` (`backend/src/app/__init__.py:3`).

Observable state of the repository:

- `backend/tests/unit/` contains `test_health.py`, `test_config.py` only. No file named
  `test_index.py` exists (verifiable: directory listing / `git ls-files backend/tests/unit`).
- `backend/tests/unit/test_health.py` contains `test_root_reports_app_metadata_without_the_database`
  (lines 67-80), which asserts `GET /` returns 200 and
  `{"app": "dark-factory-product-1", "version": app.__version__}`.
- That existing test passes the default `app_name` (`"dark-factory-product-1"`, the
  `Settings` default at `backend/src/app/config.py:19`), so it cannot distinguish the value
  read from `Settings`/`request.app.title` from a hardcoded constant.
- The liveness endpoint therefore has opportunistic coverage embedded in the health suite,
  but no module dedicated to the `GET /` contract and no assertion that pins the configured
  app name to a non-default value.

The problem this change addresses is the absence of a dedicated, non-default-configuration
liveness unit test module; it is a discoverability and regression-sensitivity gap, not
zero-coverage (the pre-existing `test_health.py` case means a "no coverage" claim would be
false).

## 2. Scope

### 2.1 In scope

- Add exactly one new test module: `backend/tests/unit/test_index.py`.
- Exactly one happy-path test for `GET /`:
  - response status is `200`;
  - JSON body is exactly `{"app": <configured app_name>, "version": app.__version__}`;
  - `create_app` is called with a `Settings` whose `app_name` is a deliberate non-default
    value (so the assertion fails if the handler hardcodes or ignores configuration);
  - the `version` assertion reads `app.__version__`, not a string literal.
- Test is hermetic: it builds the app in-process and drives it through
  `httpx.ASGITransport`; it opens no database connection and requires no PostgreSQL.
- Reuse the style of `backend/tests/unit/test_health.py`: `from app.main import create_app`,
  `from app.config import Settings`, `asyncio.run(scenario())`, `httpx.ASGITransport(app=...)`,
  `httpx.AsyncClient(transport=transport, base_url="http://test")`, `-> None` on the test
  function, and a module docstring.
- Additive test-only change under `backend/tests/unit/`.

### 2.2 Out of scope

- Any change under `backend/src/` (production code): `health.py`, `main.py`, `config.py`,
  `__init__.py`, `db.py`, `models.py`, `migrations/`. The tests must pass against the current
  production code.
- The readiness endpoint `GET /api/healthz`, its `get_session` dependency, and the stub
  session used by `test_health.py`.
- Integration tests (`backend/tests/integration/`), a real PostgreSQL, and
  `APP_TEST_DATABASE_URL`.
- Frontend changes (`frontend/**`), Helm chart changes (`deploy/**`), CI workflow changes
  (`.github/workflows/ci.yml`).
- Deleting or rewriting `test_root_reports_app_metadata_without_the_database` in
  `test_health.py`. Duplication between that case and `test_index.py` is accepted; removing it
  is a separate cleanup change.
- Changing `Settings.app_name` default (`"dark-factory-product-1"`) or the package version
  (`"0.1.0"`).
- New dependencies (`pyproject.toml`, `uv.lock` unchanged).

## 3. Requirements and acceptance criteria

Legend: each criterion is verifiable by file inspection, by executing a stated command, or by
observing the stated test outcome.

### Requirement R1 — A dedicated unit-test module exists

The change adds `backend/tests/unit/test_index.py` as the dedicated home of the `GET /`
liveness contract.

- **AC-1.1** `backend/tests/unit/test_index.py` exists in the repository working tree after
  the change. (Verify: file path present.)
- **AC-1.2** `cd backend && uv run pytest tests/unit/test_index.py -q` exits 0 and its summary
  reports at least one passed test. (Verify: run the command.)
- **AC-1.3** The module is located under `backend/tests/unit/` (not `integration/`) and its
  only HTTP transport is `httpx.ASGITransport`; it contains no `connect`, `create_engine` call,
  or `DATABASE_URL` read. (Verify: file inspection.)

### Requirement R2 — `GET /` returns HTTP 200 (happy path)

- **AC-2.1** The test performs a request with `client.get("/")` against
  `httpx.AsyncClient(transport=httpx.ASGITransport(app=application), base_url="http://test")`
  and asserts `response.status_code == 200`. (Verify: assertion present; test passes.)

### Requirement R3 — The body carries the configured app name and the package version

- **AC-3.1** The test asserts
  `response.json() == {"app": settings.app_name, "version": app.__version__}`, where
  `settings` is the exact `Settings` instance passed to `create_app` and `app` is the imported
  `app` package. (Verify: assertion present; test passes.)
- **AC-3.2** The `Settings` instance passed to `create_app` sets `app_name` to a value other
  than the default `"dark-factory-product-1"` (the value is a literal string in the test, e.g.
  `"liveness-test-app"`), and the test file contains no dependence on the default value.
  (Verify: the non-default literal appears; replacing the handler body with a constant
  `AppInfo(app="dark-factory-product-1", version=...)` makes AC-3.1's assertion fail.)
- **AC-3.3** The `version` member of the expected body is `app.__version__`; the test file
  contains no version string literal (`"0.1.0"` does not appear in `test_index.py`).
  (Verify: `grep -n '"0\.1\.0"' backend/tests/unit/test_index.py` returns no match.)
- **AC-3.4** The asserted JSON object has exactly the keys `app` and `version` (dict equality,
  not a subset check). (Verify: the assertion uses `==` against a two-key dict; adding a third
  field to `AppInfo` makes the assertion fail.)

### Requirement R4 — The test is hermetic (no database, no external network)

- **AC-4.1** The test constructs
  `Settings(app_name=<non-default>, database_url="postgresql+psycopg://stub:stub@localhost:5432/stub")`;
  the DSN points at an unreachable host/port and is never awaited. (Verify: file inspection;
  the literal matches the stub DSN already used at `backend/tests/unit/test_health.py:30`.)
- **AC-4.2** `cd backend && uv run pytest tests/unit/test_index.py -q` exits 0 with
  `APP_TEST_DATABASE_URL` unset in the environment. (Verify: run with the variable unset.)
- **AC-4.3** No outbound socket connection is opened by the test: it uses only
  `httpx.ASGITransport` (in-process ASGI call), never `httpx` against a real host and never a
  database driver. (Verify: file inspection; the test passes with no PostgreSQL listening on
  `localhost:5432`.)

### Requirement R5 — Existing unit-test style and fixtures are reused

- **AC-5.1** The test uses the same construction and drive pattern as
  `backend/tests/unit/test_health.py`: `create_app(settings)` from `app.main`, an inner
  `async def scenario() -> None`, `asyncio.run(scenario())`, `httpx.ASGITransport`,
  `httpx.AsyncClient(transport=transport, base_url="http://test")`, and `-> None` on the test
  function. (Verify: structural inspection against `test_health.py`.)
- **AC-5.2** The module opens with a docstring stating that it is a hermetic unit test of the
  `GET /` liveness endpoint (mirroring the `test_health.py` module docstring). (Verify:
  `test_index.py` first statement is a string literal containing "liveness".)
- **AC-5.3** No new fixture, helper module, or conftest file is introduced; the test depends
  only on `app`, `app.config.Settings`, `app.main.create_app`, `asyncio`, and `httpx`.
  (Verify: import list of `test_index.py`.)

### Requirement R6 — Test-only change; no production code is modified

- **AC-6.1** `git diff --name-only <baseline>..<head>` lists only paths under
  `backend/tests/`. (Verify: run the command on the change diff.)
- **AC-6.2** No file under `backend/src/` differs from the baseline revision. (Verify:
  `git diff --name-only <baseline>..<head> -- backend/src` is empty.)
- **AC-6.3** `backend/src/app/health.py` is byte-identical to the baseline (the `index`
  signature, `response_model=AppInfo`, and `AppInfo` fields are unchanged). (Verify: empty
  `git diff` for that path.)

### Requirement R7 — Repository backend gates stay green

- **AC-7.1** `cd backend && uv run ruff check .` exits 0.
- **AC-7.2** `cd backend && uv run ruff format --check .` exits 0.
- **AC-7.3** `cd backend && uv run mypy` exits 0 under the repository's strict configuration
  (`backend/pyproject.toml:48-55`, with the `tests.*` override).
- **AC-7.4** `cd backend && uv run pytest` exits 0; unit tests pass and the PostgreSQL
  integration tests skip when `APP_TEST_DATABASE_URL` is unset
  (`backend/tests/integration/test_health_database.py:19-20`).
- **AC-7.5** The only DSN literal introduced by the change is the stub DSN already present at
  `backend/tests/unit/test_health.py:30`; no real credential or secret is added. (Verify:
  the new file contains no credential other than that stub, and the Gitleaks stage of
  `.github/workflows/ci.yml` reports no new finding.)

## 4. Scenarios

Scenario IDs are referenced by Section 5.

- **SCN-1 — Liveness happy path.** A client issues `GET /` to the app (in-process ASGI
  transport). The app responds `200` with a JSON object whose keys are exactly `app` and
  `version`. Covers the contract of `backend/src/app/health.py:39-42`.
- **SCN-2 — Configuration is reported, not hardcoded.** The app is created with a
  non-default `app_name`. The `app` member of the response equals that configured name,
  demonstrating that the handler reports `request.app.title` (set in
  `backend/src/app/main.py:32`) rather than a constant.
- **SCN-3 — Package version is reported.** The `version` member of the response equals the
  imported package attribute `app.__version__` (`backend/src/app/__init__.py:3`), and no
  version literal is duplicated in the test.
- **SCN-4 — Hermetic execution.** The dedicated test runs in a process with no reachable
  database and no `APP_TEST_DATABASE_URL`, and still passes, so it is a true unit test and is
  not skipped or gated on infrastructure.
- **SCN-5 — Gate-green, test-only change.** A tree that differs from the baseline only by
  `backend/tests/unit/test_index.py` passes `ruff check`, `ruff format --check`, `mypy`, and
  `pytest`, and `backend/src/**` is unchanged.

## 5. Traceability (criteria → scenarios)

| Acceptance criterion | Scenario(s) | Verifying action |
| --- | --- | --- |
| AC-1.1 | SCN-5 | File `backend/tests/unit/test_index.py` present |
| AC-1.2 | SCN-1, SCN-4 | `uv run pytest tests/unit/test_index.py -q` exits 0 |
| AC-1.3 | SCN-4 | Inspect imports/transport in `test_index.py` |
| AC-2.1 | SCN-1 | Assertion `response.status_code == 200`; test passes |
| AC-3.1 | SCN-1, SCN-2, SCN-3 | Body equality assertion; test passes |
| AC-3.2 | SCN-2 | Non-default `app_name` literal present; mutation of handler to a constant fails the assertion |
| AC-3.3 | SCN-3 | `app.__version__` used; no `"0.1.0"` literal in the file |
| AC-3.4 | SCN-1 | Two-key dict equality in the assertion |
| AC-4.1 | SCN-4 | Stub DSN matches `test_health.py:30`; never awaited |
| AC-4.2 | SCN-4 | `pytest tests/unit/test_index.py` with `APP_TEST_DATABASE_URL` unset |
| AC-4.3 | SCN-4 | Only `httpx.ASGITransport` used; no socket/driver |
| AC-5.1 | SCN-1 | Structural comparison with `test_health.py` |
| AC-5.2 | SCN-5 | Module docstring mentions liveness |
| AC-5.3 | SCN-5 | Import list is limited to `app`, `Settings`, `create_app`, `asyncio`, `httpx` |
| AC-6.1 | SCN-5 | `git diff --name-only` shows only `backend/tests/**` |
| AC-6.2 | SCN-5 | `git diff --name-only -- backend/src` is empty |
| AC-6.3 | SCN-5 | `git diff -- backend/src/app/health.py` is empty |
| AC-7.1 | SCN-5 | `uv run ruff check .` exits 0 |
| AC-7.2 | SCN-5 | `uv run ruff format --check .` exits 0 |
| AC-7.3 | SCN-5 | `uv run mypy` exits 0 |
| AC-7.4 | SCN-4, SCN-5 | `uv run pytest` exits 0 |
| AC-7.5 | SCN-5 | No credential beyond the existing stub DSN; Gitleaks stage green |

Reverse mapping — every scenario is covered by at least one criterion:

| Scenario | Covered by |
| --- | --- |
| SCN-1 | AC-1.2, AC-2.1, AC-3.1, AC-3.4, AC-5.1 |
| SCN-2 | AC-3.1, AC-3.2 |
| SCN-3 | AC-3.1, AC-3.3 |
| SCN-4 | AC-1.2, AC-1.3, AC-4.1, AC-4.2, AC-4.3, AC-7.4 |
| SCN-5 | AC-1.1, AC-5.2, AC-5.3, AC-6.1, AC-6.2, AC-6.3, AC-7.1, AC-7.2, AC-7.3, AC-7.5 |

## 6. Definition of done

The change is done when all of the following commands succeed on the final revision of the
change, with `APP_TEST_DATABASE_URL` unset:

```sh
cd backend
uv run pytest tests/unit/test_index.py -q   # AC-1.2, AC-2.1, AC-3.*, AC-4.2
uv run pytest                               # AC-7.4 (integration tests skip)
uv run ruff check .                         # AC-7.1
uv run ruff format --check .                # AC-7.2
uv run mypy                                 # AC-7.3
git diff --name-only -- backend/src         # AC-6.2 (must be empty)
```
