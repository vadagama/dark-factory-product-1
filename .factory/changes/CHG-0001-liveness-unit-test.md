---
schema: dark-factory.dev/specification/v1
id: spec:dark-factory-product-1:liveness-unit-test
type: specification
title: Unit test for the GET / liveness endpoint
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0002
---

# Specification — unit test for the `GET /` liveness endpoint

Stage: specification (attempt 1). Deliverables of this stage: this specification,
the two scenario artifacts it links, and the criteria below. The implementation
deliverable is the test module `backend/tests/unit/test_index.py` (the sole added
file). The change touches **tests only**; no production code changes.

## 1. Problem

### 1.1 Corrections to the incoming description (established from the repository)

| Description says | Repository reality | Consequence for this specification |
| --- | --- | --- |
| The handler is at `app/src/app/health.py` | The handler `index()` is at `backend/src/app/health.py` (the `@router.get("/", response_model=AppInfo)` + `async def index(request: Request) -> AppInfo` pair); `AppInfo` is defined in the same module with fields `app: str` and `version: str` | Every path below uses the real `backend/src/...` layout |
| `backend/tests/unit` "has no coverage for the liveness endpoint" | `backend/tests/unit/test_health.py` already contains `test_root_reports_app_metadata_without_the_database`, which asserts `GET /` returns `200` and `{"app": "dark-factory-product-1", "version": app.__version__}` | "Add the first coverage" is false and is not the requirement. The real gap is narrower (§1.2) |
| "Add `backend/tests/unit/test_index.py`" | `backend/tests/unit/` holds `test_health.py` and `test_config.py`; there is no `conftest.py` anywhere under `backend/tests/` | The file name and the absence of new fixtures are kept as stated |

### 1.2 The residual gap this change closes

`GET /` is the liveness surface: `health.py`'s `index()` returns
`AppInfo(app=request.app.title, version=app.__version__)`, where
`request.app.title` is set from `Settings.app_name` in `create_app`
(`backend/src/app/main.py`) and `app.__version__` is the single version source
(`backend/src/app/__init__.py`). The chart probes exactly this route as the
liveness probe (`deploy/chart/values.yaml`: `backend.probes.liveness.path: /`,
while readiness uses `/api/healthz`).

Two facts make the current coverage weaker than the route's role:

1. **No dedicated module.** The only coverage of the `GET /` contract is
   opportunistic, buried in the health/readiness suite; a reader looking for the
   liveness contract in `backend/tests/unit/` has no module named for it.
2. **The existing assertion is configuration-blind.** It builds the app with the
   *default* `app_name` (`"dark-factory-product-1"`, `backend/src/app/config.py`)
   and asserts that same default string. A regression that hardcoded
   `AppInfo(app="dark-factory-product-1", ...)` in `index()` — instead of reading
   `request.app.title` — would therefore leave the existing test green.

So the problem is not "no coverage" but "no dedicated, configuration-sensitive
coverage of the liveness response contract". The existing case is deliberately
kept (duplication is accepted here); removing or consolidating it is a separate
cleanup change.

## 2. Scope

Conventions used throughout: criterion ids are `AC-r.n` and are checked by a
named command or by a stated, reproducible observation. `<base>` is the revision
the change started from (`git merge-base HEAD main`); `<head>` is the change's
final revision. `cd backend` is implied for every `uv run` command.

### 2.1 In scope

1. Add exactly one file: `backend/tests/unit/test_index.py`.
2. One happy-path test for `GET /`, driven in-process through
   `httpx.ASGITransport`:
   - the response status is `200`;
   - the JSON body equals exactly `{"app": <configured app_name>, "version": app.__version__}`;
   - the app under test is built with a **deliberate non-default** `app_name`
     passed to `create_app`, so the assertion fails if the handler stops reading
     the configured value;
   - the expected `version` is read from the imported `app.__version__`, not
     from a duplicated string literal.
3. Hermetic execution: an explicit stub DSN that is never used to open a
   connection, no PostgreSQL required, no `APP_TEST_DATABASE_URL` required.
4. Reuse of the existing style of `backend/tests/unit/test_health.py`
   (`create_app` from `app.main`, `Settings` from `app.config`, an inner
   `async def scenario() -> None`, `asyncio.run(scenario())`, `httpx.ASGITransport`,
   `httpx.AsyncClient(transport=..., base_url="http://test")`, `-> None` on the
   test, a module docstring).
5. Test-only diff under `backend/tests/`.

### 2.2 Out of scope

1. Any file under `backend/src/` (`health.py`, `main.py`, `config.py`,
   `__init__.py`, `db.py`, `models.py`, `migrations/`). The new test must pass
   against the production code as it stands.
2. The readiness endpoint `GET /api/healthz`, its `get_session` dependency, and
   the `_StubSession` / `dependency_overrides` machinery of `test_health.py`.
3. Editing, moving or deleting `test_root_reports_app_metadata_without_the_database`
   in `backend/tests/unit/test_health.py`.
4. Integration tests (`backend/tests/integration/`), a real PostgreSQL, and the
   `APP_TEST_DATABASE_URL` gate.
5. Frontend (`frontend/**`), chart/deploy (`deploy/**`), CI
   (`.github/workflows/ci.yml`), documentation (`README.md`).
6. Changing the `Settings.app_name` default (`"dark-factory-product-1"`) or the
   package version (`backend/src/app/__init__.py`, `backend/pyproject.toml`).
7. New dependencies, fixtures, helper modules or `conftest.py`
   (`backend/pyproject.toml`, `backend/uv.lock` unchanged).
8. Changing the liveness/readiness probe paths or any other chart value.
9. Reconciling this file's name (`CHG-0001-...`) with the `change:` id in its
   frontmatter — housekeeping, separate change.

## 3. Requirements and acceptance criteria

Each criterion is decided by a named command or by a stated, reproducible
observation; a criterion that could not be checked this way would be a defect of
this specification.

### R1 — The liveness contract gets its own module in the unit suite

- **AC-1.1** `backend/tests/unit/test_index.py` exists in the working tree of
  `<head>` and is the only file added by the change.
  (Verify: `git diff --name-only <base>..<head>` lists exactly that path as added.)
- **AC-1.2** `uv run pytest tests/unit/test_index.py -q` exits `0` and reports at
  least one passed test with `0 failed, 0 skipped, 0 errors`.
  (Verify: run the command with `APP_TEST_DATABASE_URL` unset.)
- **AC-1.3** The module collects exactly one test:
  `uv run pytest tests/unit/test_index.py --collect-only -q` reports exactly one
  collected item. (Verify: run the command.)
- **AC-1.4** The module contains no skip/xfail machinery (`pytest.mark.skip`,
  `pytest.mark.skipif`, `pytest.mark.xfail`) and no conditional that can bypass
  the assertions. (Verify: file inspection; corroborated by the "0 skipped" of
  AC-1.2.)

### R2 — `GET /` answers `200` on the happy path

- **AC-2.1** The test builds an application with `create_app(settings)`, drives it
  with `httpx.ASGITransport` and `httpx.AsyncClient(transport=..., base_url="http://test")`,
  issues `client.get("/")`, and asserts `response.status_code == 200`.
  (Verify: the assertion is present in `test_index.py`; AC-1.2 passes.)

### R3 — The body carries the configured app name and the package version

- **AC-3.1** The test asserts `response.json() == {"app": settings.app_name, "version": app.__version__}`,
  where `settings` is the exact `Settings` instance passed to `create_app` and
  `app` is the imported package. (Verify: assertion present; AC-1.2 passes.)
- **AC-3.2** The `Settings` instance passed to `create_app` sets `app_name` to an
  explicit string literal that differs from the default `"dark-factory-product-1"`,
  and the string `dark-factory-product-1` does not occur anywhere in
  `test_index.py`. (Verify: `grep -n 'dark-factory-product-1' backend/tests/unit/test_index.py`
  returns no match; the `Settings(...)` call shows the non-default literal.)
- **AC-3.3** The expected `version` is the imported attribute `app.__version__`
  and the module contains no version string literal.
  (Verify: `grep -nE '"[0-9]+\.[0-9]+\.[0-9]+"' backend/tests/unit/test_index.py`
  returns no match.)
- **AC-3.4** The asserted body is compared with dictionary equality against a
  two-key literal — exactly the keys `app` and `version` — not by key presence or
  subset matching. (Verify: assertion inspection; plus the sensitivity observation
  of AC-3.5.)
- **AC-3.5** Sensitivity, observed once and reverted: with a scratch copy of
  `backend/src/app/health.py` in which `index()` returns
  `AppInfo(app="dark-factory-product-1", version=app.__version__)`, the command of
  AC-1.2 fails; after reverting the mutation it passes again. The same holds when
  a third field is added to `AppInfo`. The mutation must not survive into the
  change (guarded by AC-6.2). (Verify: run the mutated command, record the
  failure, revert, re-run, record the pass.)

### R4 — Hermetic and environment-independent execution

- **AC-4.1** The test never opens a database connection or a socket: it
  constructs `Settings(app_name=<non-default>, database_url=<stub DSN>)` and
  reaches the app only through `httpx.ASGITransport`; the module contains no
  `create_engine`, `.connect(`, `.execute(` or driver call.
  (Verify: file inspection; AC-1.2 passes with no server reachable at the stub DSN.)
- **AC-4.2** `uv run pytest tests/unit/test_index.py -q` exits `0` with
  `APP_TEST_DATABASE_URL` unset. (Verify: run with the variable unset.)
- **AC-4.3** The module does not use the readiness dependency or its doubles: no
  reference to `get_session`, `dependency_overrides` or a stub session class.
  (Verify: grep of `test_index.py` returns no match for each name.)
- **AC-4.4** The outcome does not depend on the process environment or on a
  developer's `backend/.env`: with `APP_NAME=hostile-name` and
  `DATABASE_URL=postgresql+psycopg://hostile:hostile@127.0.0.1:1/hostile` exported,
  the command of AC-1.2 still exits `0`, because the values the assertions use are
  supplied as explicit constructor arguments.
  (Verify: run the command with those two variables exported.)

### R5 — The existing unit-test style is reused

- **AC-5.1** The test follows the construction/drive pattern of
  `backend/tests/unit/test_health.py`: `create_app(settings)` from `app.main`,
  an inner `async def scenario() -> None`, `asyncio.run(scenario())`,
  `httpx.ASGITransport(app=application)`,
  `httpx.AsyncClient(transport=transport, base_url="http://test")`, and `-> None`
  on the test function. (Verify: structural comparison of the two modules.)
- **AC-5.2** The module's first statement is a docstring stating that the module
  holds hermetic unit tests of the `GET /` liveness endpoint. (Verify: the first
  statement of `test_index.py` is a string literal containing `liveness`.)
- **AC-5.3** The import block is limited to `asyncio`, `httpx`, `app` (for
  `__version__`), `from app.config import Settings` and `from app.main import create_app`;
  no fixture, helper module or `conftest.py` is added under `backend/tests/`.
  (Verify: import block inspection; the diff of AC-6.1 shows no other added file.)
- **AC-5.4** The added test function name does not collide with an existing test
  name in `backend/tests/unit/` (it differs from
  `test_root_reports_app_metadata_without_the_database`).
  (Verify: grep of the test modules for the function name.)

### R6 — Test-only change; production code and existing tests are untouched

- **AC-6.1** `git diff --name-only <base>..<head>` lists only
  `backend/tests/unit/test_index.py`. (Verify: run the command.)
- **AC-6.2** `git diff <base>..<head> -- backend/src` produces no output — the
  `index` signature, `response_model=AppInfo` and the `AppInfo` fields are
  byte-identical to `<base>`. (Verify: run the command.)
- **AC-6.3** `backend/tests/unit/test_health.py` is unchanged from `<base>` and
  still contains `test_root_reports_app_metadata_without_the_database`; no
  existing test is deleted, renamed or moved. (Verify:
  `git diff <base>..<head> -- backend/tests/unit/test_health.py` produces no output.)
- **AC-6.4** No dependency, CI, chart or frontend path differs from `<base>`:
  `backend/pyproject.toml`, `backend/uv.lock`, `.github/workflows/ci.yml`,
  `deploy/**`, `frontend/**`. (Verify: `git diff --name-only <base>..<head> -- <path>`
  is empty for each.)

### R7 — The repository backend gates stay green

- **AC-7.1** `uv run ruff check .` exits `0`.
- **AC-7.2** `uv run ruff format --check .` exits `0`.
- **AC-7.3** `uv run mypy` exits `0` under the repository configuration (`strict`
  in `backend/pyproject.toml`, with the `tests.*` override).
- **AC-7.4** `uv run pytest` exits `0` with `APP_TEST_DATABASE_URL` unset (the
  integration modules report skipped, not failed) and also exits `0` with
  `APP_TEST_DATABASE_URL` pointing at a PostgreSQL instance.
- **AC-7.5** The change adds no credential-shaped literal beyond the stub DSN
  already present in `backend/tests/unit/test_health.py`, and the gitleaks stage
  of `.github/workflows/ci.yml` reports no new finding. (Verify: inspect the added
  lines; the stub DSN is a non-secret placeholder, and the gitleaks run exits `0`.)

## 4. Scenarios

Scenarios S1 and S2 are observable product flows, recorded as
`dark-factory.dev/scenario/v1` artifacts under `.factory/scenarios/`. S3 is the
change-level gate scenario: it observes the diff and the gates rather than a
product flow, so it is deliberately not backed by a scenario artifact.

| ID | Scenario artifact | Observable flow |
| --- | --- | --- |
| S1 | `scenario:dark-factory-product-1:liveness:app-metadata` (`.factory/scenarios/SCN-001-liveness-app-metadata.md`) | `GET /` answers `200` with exactly `{"app": <configured app_name>, "version": app.__version__}` — the configured, non-default name and the package version. |
| S2 | `scenario:dark-factory-product-1:liveness:database-independent` (`.factory/scenarios/SCN-002-liveness-database-independent.md`) | `GET /` answers `200` with no PostgreSQL reachable and no dependence on ambient environment values; readiness (`/api/healthz`) is the surface that reflects the database. |
| S3 | — (change-level) | The tree differs from `<base>` only by `backend/tests/unit/test_index.py`; ruff, mypy and pytest exit `0`; `backend/src/**` is unchanged. |

- **S1 — The liveness endpoint reports the configured app name and the package
  version.**
  Given an app built by
  `create_app(Settings(app_name="liveness-test-app", database_url=<stub DSN>))`;
  When a client issues `GET /` through the in-process ASGI transport;
  Then the status is `200`, the JSON body is exactly
  `{"app": "liveness-test-app", "version": app.__version__}` with no additional
  keys, the `app` value is the configured name (a handler returning the hardcoded
  default `"dark-factory-product-1"` fails the assertion), and the `version` value
  is the imported `app.__version__` with no literal duplicated in the test.
  Criteria: AC-1.1–AC-1.4, AC-2.1, AC-3.1–AC-3.5, AC-5.1, AC-5.2, AC-5.4, AC-7.*.
- **S2 — Liveness answers while the database is unreachable.**
  Given no PostgreSQL listening at the configured DSN, `APP_TEST_DATABASE_URL`
  unset, and possibly hostile `APP_NAME`/`DATABASE_URL` values in the process
  environment;
  When the dedicated module runs;
  Then it passes with `0 skipped`, having attempted no connection and no socket
  I/O. Criteria: AC-1.2, AC-1.4, AC-4.1–AC-4.4, AC-7.*.
- **S3 — Test-only, gate-green change.**
  Given a tree that differs from `<base>` only by
  `backend/tests/unit/test_index.py`;
  When `ruff check`, `ruff format --check`, `mypy` and `pytest` run;
  Then all exit `0`, `backend/src/**` and `backend/tests/unit/test_health.py` are
  unchanged, and no new credential-shaped literal was added.
  Criteria: AC-1.1, AC-5.3, AC-6.1–AC-6.4, AC-7.*.

## 5. Traceability — criteria to scenarios

| Criterion | Requirement (short) | Scenario(s) | Verifying action |
| --- | --- | --- | --- |
| AC-1.1 | module added, sole added file | S1, S3 | `git diff --name-only <base>..<head>` |
| AC-1.2 | focused run passes, nothing skipped | S1, S2 | `uv run pytest tests/unit/test_index.py -q` |
| AC-1.3 | exactly one test collected | S1 | `uv run pytest tests/unit/test_index.py --collect-only -q` |
| AC-1.4 | no skip/xfail machinery | S1, S2 | inspection + "0 skipped" of AC-1.2 |
| AC-2.1 | status assertion `200` | S1 | assertion present; AC-1.2 passes |
| AC-3.1 | body equality vs configured name/version | S1 | assertion present; AC-1.2 passes |
| AC-3.2 | non-default `app_name`, no default literal | S1 | grep for `dark-factory-product-1` (no match) |
| AC-3.3 | `app.__version__`, no version literal | S1 | grep for `x.y.z` literals (no match) |
| AC-3.4 | exact two-key dict equality | S1 | assertion inspection |
| AC-3.5 | hardcoded-value mutation fails the test | S1 | mutate `health.py`, run AC-1.2, revert |
| AC-4.1 | no connection/socket, ASGI transport only | S2 | inspection; run without PostgreSQL |
| AC-4.2 | passes with `APP_TEST_DATABASE_URL` unset | S2 | run with the variable unset |
| AC-4.3 | no readiness dependency or doubles | S2 | grep for `get_session`/`dependency_overrides` |
| AC-4.4 | immune to hostile env/`.env` values | S2 | run with `APP_NAME`/`DATABASE_URL` exported |
| AC-5.1 | same drive pattern as `test_health.py` | S1 | structural comparison |
| AC-5.2 | module docstring names the liveness endpoint | S1 | first statement of `test_index.py` |
| AC-5.3 | imports limited, no new fixture/conftest | S1, S3 | import block + diff file list |
| AC-5.4 | no test-name collision | S1 | grep of `backend/tests/unit/` |
| AC-6.1 | only `test_index.py` changes | S3 | `git diff --name-only <base>..<head>` |
| AC-6.2 | `backend/src` byte-identical | S3 | `git diff <base>..<head> -- backend/src` |
| AC-6.3 | existing test module untouched | S3 | `git diff <base>..<head> -- backend/tests/unit/test_health.py` |
| AC-6.4 | no dependency/CI/chart/frontend change | S3 | `git diff --name-only` per path |
| AC-7.1 | `ruff check` green | S1, S2, S3 | `uv run ruff check .` |
| AC-7.2 | `ruff format --check` green | S1, S2, S3 | `uv run ruff format --check .` |
| AC-7.3 | `mypy` green | S1, S2, S3 | `uv run mypy` |
| AC-7.4 | full pytest green, integration skips | S1, S2, S3 | `uv run pytest` with and without the DSN |
| AC-7.5 | no new secret-shaped literal | S1, S2, S3 | inspect diff; gitleaks stage |

Reverse mapping — every scenario is covered by at least one criterion, and every
criterion maps to at least one scenario:

| Scenario | Covered by |
| --- | --- |
| S1 | AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-2.1, AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-5.1, AC-5.2, AC-5.3, AC-5.4, AC-7.1–AC-7.5 |
| S2 | AC-1.2, AC-1.4, AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-7.1–AC-7.5 |
| S3 | AC-1.1, AC-5.3, AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-7.1–AC-7.5 |

## 6. Definition of done

All of the following hold on `<head>`, with `APP_TEST_DATABASE_URL` unset unless
stated otherwise:

```sh
cd backend
uv run pytest tests/unit/test_index.py -q                  # AC-1.2, AC-2.1, AC-3.1, AC-4.2
uv run pytest tests/unit/test_index.py --collect-only -q   # AC-1.3 (exactly 1 item)
APP_NAME=hostile-name \
  DATABASE_URL=postgresql+psycopg://hostile:hostile@127.0.0.1:1/hostile \
  uv run pytest tests/unit/test_index.py -q                # AC-4.4
uv run pytest                                              # AC-7.4 (integration skips)
uv run ruff check .                                        # AC-7.1
uv run ruff format --check .                               # AC-7.2
uv run mypy                                                # AC-7.3
git diff --name-only <base>..<head>                        # AC-1.1, AC-6.1 (one added file)
git diff <base>..<head> -- backend/src                     # AC-6.2 (empty)
git diff <base>..<head> -- backend/tests/unit/test_health.py   # AC-6.3 (empty)
grep -rn "dark-factory-product-1" tests/unit/test_index.py     # AC-3.2 (no match)
```

plus the recorded AC-3.5 mutation observation (fail, revert, pass).

## 7. Assumptions and accepted risks

- **Assumption** — `create_app(settings)` is importable and runnable without
  `DATABASE_URL` in the environment, as `backend/src/app/main.py` documents and
  `test_health.py` already relies on; the engine is created lazily and `GET /`
  never uses it.
- **Assumption** — explicit constructor arguments take precedence over environment
  variables and `.env` in `pydantic-settings`, so the assertions of R3 and R4 are
  deterministic on any developer machine. AC-4.4 checks this observation instead of
  assuming it; if the check fails, only AC-4.4 is invalidated, not R3.
- **Accepted risk** — intentional duplication with
  `test_root_reports_app_metadata_without_the_database`; consolidation is a
  follow-up change.
- **Low risk** — the change produces no runtime artifact from tests, adds no
  dependency and cannot alter a deployed image; the new test carries no skip
  marker, so it cannot silently disappear from the suite.
