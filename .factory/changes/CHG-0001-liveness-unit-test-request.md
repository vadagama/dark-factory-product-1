---
schema: dark-factory.dev/change-request/v1
id: cr:dark-factory-product-1:2026:liveness-unit-test
type: change-request
title: Package — add a unit test for the GET / liveness endpoint
product: dark-factory-product-1
status: ready-for-review
stage: planning
attempt: 1
change: chg:dark-factory-product-1:2026:0002
specification: .factory/changes/CHG-0001-liveness-unit-test.md
deliverable_paths:
  - backend/tests/unit/test_index.py
production_code_touched: false
---

# Change request — unit test for the `GET /` liveness endpoint

Reviewable standalone: everything needed to judge this request is in this file plus the
referenced source paths. No knowledge of the originating task thread is required.

## 1. Change summary

Add **one new test module**, `backend/tests/unit/test_index.py`, containing **one happy-path
test** that drives the liveness endpoint `GET /` in-process and asserts:

- HTTP status is `200`;
- the JSON body is exactly `{"app": <configured app_name>, "version": app.__version__}`, with
  the expected `app` value asserted against a **deliberate non-default** `app_name`.

The test is hermetic (no database, no sockets), reuses the construction/drive style of
`backend/tests/unit/test_health.py`, and changes **no production code**.

Affected surfaces: tests only. `backend/tests/unit/test_index.py` is the sole added file; no
file under `backend/src/`, no dependency file (`backend/pyproject.toml`, `backend/uv.lock`),
no CI workflow, and no existing test is modified or deleted.

## 2. Corrections to the request description (reviewer must see these)

The incoming description contains two inaccuracies. The request is scoped to the corrected
statement of the problem; the corrections narrow, not widen, the work.

| Description says | Repository reality | Consequence |
| --- | --- | --- |
| The handler is at `app/src/app/health.py` | The handler `index()` is at `backend/src/app/health.py:39-42` (`backend/src/app/health.py:40` for the `def`) | All paths in this request use the real `backend/src/...` layout |
| `backend/tests/unit` "has no coverage for the liveness endpoint `GET /`" | `backend/tests/unit/test_health.py:67-80` already contains `test_root_reports_app_metadata_without_the_database`, which asserts `200` and `{"app": "dark-factory-product-1", "version": app.__version__}` for `GET /` | The claim "add the first coverage" is false. The genuine gap is narrower — see below |

**The real, residual gap** (this is what the change fixes):

1. **No dedicated module** for the `GET /` contract — its only coverage is opportunistic,
   embedded in the readiness/health suite.
2. **The existing assertion is configuration-blind**: `test_health.py:67-70` passes
   `app_name="dark-factory-product-1"`, which is also the `Settings` default
   (`backend/src/app/config.py:19`). A regression that hardcoded
   `AppInfo(app="dark-factory-product-1", ...)` in the handler would therefore keep that test
   green. The new test pins a non-default `app_name` so it fails in exactly that case.

The existing test is deliberately **left in place** (duplication accepted); removing or
rewriting it is a separate cleanup change, out of scope here.

## 3. Motivation

- **Regression sensitivity.** `GET /` reports `request.app.title` (set from
  `Settings.app_name` in `backend/src/app/main.py:32`) and `app.__version__`
  (`backend/src/app/__init__.py:3`). Nothing currently fails if that becomes a constant. A
  non-default `app_name` converts "configuration flows into the response" into a tested claim.
- **Discoverability / contract home.** A future reader looking for the liveness contract in
  `backend/tests/unit/` finds a module named for it instead of having to know it hides in
  `test_health.py`.
- **Risk profile.** Test-only, additive, no runtime artifact is produced from tests and no
  production behaviour changes, so the change cannot affect a deployed image.
- **Cost/benefit.** ~30 lines of test code against a real (if latent) regression class, using
  the project's existing test idiom — no new dependency, fixture, or abstraction.

## 4. Scope

### 4.1 In scope

- Add exactly one file: `backend/tests/unit/test_index.py`.
- Exactly one test, happy path only: status `200`; body equality against
  `{"app": <non-default app_name>, "version": app.__version__}`; non-default `app_name` set
  through the `Settings` instance handed to `create_app`; `version` read from
  `app.__version__` (no version string literal).
- Hermetic execution via `httpx.ASGITransport`; stub DSN, never awaited; runs with
  `APP_TEST_DATABASE_URL` unset and no PostgreSQL listening.
- Reuse of `test_health.py` style: `create_app` from `app.main`, `Settings` from
  `app.config`, inner `async def scenario() -> None`, `asyncio.run(scenario())`,
  `httpx.AsyncClient(transport=..., base_url="http://test")`, `-> None` on the test, module
  docstring stating the module is a hermetic liveness unit test.
- Test-only diff under `backend/tests/`.

### 4.2 Out of scope

- Any change under `backend/src/` (`health.py`, `main.py`, `config.py`, `__init__.py`, `db.py`,
  models, migrations). The new test must pass against the current production code.
- The readiness endpoint `GET /api/healthz`, its `get_session` dependency, and the stub
  session/`dependency_overrides` machinery from `test_health.py`.
- Editing, moving, or deleting `test_root_reports_app_metadata_without_the_database`
  (`backend/tests/unit/test_health.py:67-80`).
- Integration tests (`backend/tests/integration/`), real PostgreSQL, `APP_TEST_DATABASE_URL`.
- Frontend (`frontend/**`), Helm/deploy (`deploy/**`), CI workflows
  (`.github/workflows/ci.yml`).
- Changing the `Settings.app_name` default (`"dark-factory-product-1"`) or the package
  version (`"0.1.0"`).
- New dependencies, fixtures, helpers, or `conftest.py` files.

## 5. Refined requirements and acceptance criteria

Authoritative full specification (problem statement, scenarios, traceability):
`.factory/changes/CHG-0001-liveness-unit-test.md`. Requirements and criteria are reproduced
here so this request stands alone.

Legend: each criterion is verifiable by file inspection, by a stated command, or by an
observable test outcome. `cd backend` is implied for every `uv run` command.

### R1 — A dedicated unit-test module exists

- **AC-1.1** `backend/tests/unit/test_index.py` exists after the change.
- **AC-1.2** `uv run pytest tests/unit/test_index.py -q` exits 0 and reports at least one
  passed test.
- **AC-1.3** The module lives under `tests/unit/` (not `integration/`), uses only
  `httpx.ASGITransport`, and contains no `connect`/`create_engine` call or `DATABASE_URL`
  read.

### R2 — `GET /` returns HTTP 200 (happy path)

- **AC-2.1** The test issues `client.get("/")` against
  `httpx.AsyncClient(transport=httpx.ASGITransport(app=application), base_url="http://test")`
  and asserts `response.status_code == 200`.

### R3 — The body carries the configured app name and the package version

- **AC-3.1** The test asserts
  `response.json() == {"app": settings.app_name, "version": app.__version__}`, where
  `settings` is the exact instance passed to `create_app` and `app` is the imported package.
- **AC-3.2** The `Settings` passed to `create_app` sets `app_name` to a non-default literal
  (e.g. `"liveness-test-app"`, i.e. not `"dark-factory-product-1"`); the file depends on no
  default value. *Sensitivity check:* replacing the handler body with
  `AppInfo(app="dark-factory-product-1", version=...)` makes AC-3.1's assertion fail.
- **AC-3.3** The expected `version` is `app.__version__`; the file contains no version string
  literal (`grep -n '"0\.1\.0"' backend/tests/unit/test_index.py` returns nothing).
- **AC-3.4** The asserted JSON object is compared with dict equality (exactly the keys `app`
  and `version`); adding a third field to `AppInfo` makes the assertion fail.

### R4 — The test is hermetic (no database, no external network)

- **AC-4.1** The test builds
  `Settings(app_name=<non-default>, database_url="postgresql+psycopg://stub:stub@localhost:5432/stub")`
  — the same stub DSN already used at `backend/tests/unit/test_health.py:30` — and never
  awaits a connection.
- **AC-4.2** `uv run pytest tests/unit/test_index.py -q` exits 0 with `APP_TEST_DATABASE_URL`
  unset.
- **AC-4.3** No outbound socket is opened: only `httpx.ASGITransport` is used; the test passes
  with no PostgreSQL listening on `localhost:5432`.

### R5 — Existing unit-test style is reused

- **AC-5.1** Same construction/drive pattern as `test_health.py`: `create_app(settings)`, inner
  `async def scenario() -> None`, `asyncio.run(scenario())`, `httpx.ASGITransport`,
  `httpx.AsyncClient(transport=..., base_url="http://test")`, `-> None` on the test.
- **AC-5.2** The module opens with a docstring stating it is a hermetic unit test of the
  `GET /` liveness endpoint (first statement is a string literal containing "liveness").
- **AC-5.3** No new fixture, helper module, or `conftest.py`; imports are limited to `app`,
  `app.config.Settings`, `app.main.create_app`, `asyncio`, and `httpx`.

### R6 — Test-only change; no production code modified

- **AC-6.1** `git diff --name-only <baseline>..<head>` lists only paths under
  `backend/tests/`.
- **AC-6.2** `git diff --name-only <baseline>..<head> -- backend/src` is empty.
- **AC-6.3** `backend/src/app/health.py` is byte-identical to the baseline (`index` signature,
  `response_model=AppInfo`, and the `AppInfo` fields unchanged).

### R7 — Repository backend gates stay green

- **AC-7.1** `uv run ruff check .` exits 0.
- **AC-7.2** `uv run ruff format --check .` exits 0.
- **AC-7.3** `uv run mypy` exits 0 under the repo's strict config (`backend/pyproject.toml:48-55`,
  including the `tests.*` override).
- **AC-7.4** `uv run pytest` exits 0; unit tests pass and PostgreSQL integration tests skip
  when `APP_TEST_DATABASE_URL` is unset
  (`backend/tests/integration/test_health_database.py:19-20`).
- **AC-7.5** The only credential-shaped literal introduced is the existing stub DSN; the
  gitleaks stage (`.github/workflows/ci.yml`) reports no new finding.

### Scenarios (behavioral intent behind the criteria)

- **SCN-1 Liveness happy path** — `GET /` → `200` + JSON keys exactly `app`, `version`
  (contract of `backend/src/app/health.py:39-42`).
- **SCN-2 Configuration is reported, not hardcoded** — non-default `app_name` is echoed,
  proving `request.app.title` is read (`backend/src/app/main.py:32`).
- **SCN-3 Package version is reported** — `version` equals imported `app.__version__`
  (`backend/src/app/__init__.py:3`), with no duplicated literal.
- **SCN-4 Hermetic execution** — passes with no reachable database and no DSN env var; not
  skipped, not gated on infrastructure.
- **SCN-5 Gate-green, test-only change** — only `backend/tests/unit/test_index.py` differs
  from baseline; ruff/mypy/pytest pass; `backend/src/**` unchanged.

## 6. Ordered task list

Ordering is execution order; `Dependencies` are hard prerequisites. `ACs` are the criteria
satisfied by the task (full text in §5). Critical path: **T0 → T1 → T2 → T7**, with T3–T6 as
gates that fan out after T1 and must all complete before T7.

| # | Task | Depends on | Deliverable / action | Verifies | Status |
| --- | --- | --- | --- | --- | --- |
| **T0** | Baseline reconciliation | — | Confirmed handler at `backend/src/app/health.py:39-42` (returns `AppInfo(app=request.app.title, version=app.__version__)`) and existing coverage at `backend/tests/unit/test_health.py:67-80`; recorded the two description corrections in §2 | Prerequisite for AC-3.2 rationale, AC-6.3 baseline | **done (planning)** |
| **T1** | Author `backend/tests/unit/test_index.py` | T0 | New file: module docstring (hermetic liveness unit test), imports limited to `asyncio`, `httpx`, `app`, `app.config.Settings`, `app.main.create_app`; one test `test_index_reports_app_metadata` with `Settings(app_name="liveness-test-app", database_url="postgresql+psycopg://stub:stub@localhost:5432/stub")`, `create_app(settings)`, inner `async def scenario() -> None`, `asyncio.run(scenario())`, asserts status `200` and `response.json() == {"app": settings.app_name, "version": app.__version__}` | AC-1.1, AC-1.3, AC-2.1, AC-3.1, AC-3.3, AC-3.4, AC-4.1, AC-4.3, AC-5.1, AC-5.2, AC-5.3 | todo |
| **T2** | Run the focused test | T1 | `uv run pytest tests/unit/test_index.py -q` with `APP_TEST_DATABASE_URL` unset; exits 0, ≥1 passed | AC-1.2, AC-4.2 | todo |
| **T3** | Negative (sensitivity) check | T1 (after T2) | Temporarily mutate a scratch copy of the handler to `AppInfo(app="dark-factory-product-1", version=...)`, re-run T2's command, observe a failure, then **revert** the mutation; record the observation | AC-3.2 | todo |
| **T4** | Lint, format, type gates | T1 | `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy` — all exit 0 | AC-7.1, AC-7.2, AC-7.3 | todo |
| **T5** | Full backend suite | T1 | `uv run pytest` (DSN unset) exits 0 with integration tests skipped; if the CI service DSN is available, also run with `APP_TEST_DATABASE_URL` set | AC-7.4 | todo |
| **T6** | Scope / diff guard | T1, T3 (revert complete) | `git diff --name-only <baseline>..<head>` shows only `backend/tests/**`; `git diff --name-only <baseline>..<head> -- backend/src` empty; `git diff -- backend/src/app/health.py` empty; no dependency/CI files touched; no new secret literal | AC-6.1, AC-6.2, AC-6.3, AC-7.5 | todo |
| **T7** | Package evidence for review | T2, T4, T5, T6 | Attach the command outputs of T2/T4/T5 and the T6 diff proof to the change record; mark request ready for review | Definition of done (§7) | todo |

Notes that constrain the tasks:

- **T1** — the test function name is not pinned by any AC; it must not collide with the
  existing `test_root_reports_app_metadata_without_the_database`. Assert exactly the two keys
  via dict `==` (AC-3.4). Do not import `get_session`, `_StubSession`, or any
  `dependency_overrides` machinery: `GET /` touches no session.
- **T3** — the temporary mutation must not survive into the change; **T6** is the guard that
  catches a forgotten revert. Skipping T3 is permitted only with the sensitivity claim in
  §5 AC-3.2 re-labelled as unverified (review should then request T3).
- **T5** — the CI service maps PostgreSQL to `localhost:55432`
  (`.github/workflows/ci.yml`, `backend-test` job); the unit test must never depend on that.

## 7. Definition of done

All of the following pass on the final revision, with `APP_TEST_DATABASE_URL` unset:

```sh
cd backend
uv run pytest tests/unit/test_index.py -q   # AC-1.2, AC-2.1, AC-3.*, AC-4.2
uv run pytest                               # AC-7.4 (integration tests skip)
uv run ruff check .                         # AC-7.1
uv run ruff format --check .                # AC-7.2
uv run mypy                                 # AC-7.3
```

plus the empty-diff proofs of T6 (`-- backend/src` empty) and a green gitleaks stage
(AC-7.5).

## 8. Assumptions, risks, open questions

- **Assumption** — `create_app` is importable and runnable without `DATABASE_URL` env set, as
  `backend/src/app/main.py:6-10` documents and `test_health.py` already relies on; the engine is
  created lazily and never connects for `GET /`.
- **Assumption** — explicit constructor kwargs outrank `.env`/environment sources in
  pydantic-settings, so the non-default `app_name` and the stub DSN are deterministic even if
  a developer has a populated `backend/.env`.
- **Accepted risk** — intentional duplication with
  `test_root_reports_app_metadata_without_the_database`; consolidation is a follow-up, not part
  of this change.
- **Low risk** — the change cannot alter shipped behavior (tests only, no dependency or config
  change) and cannot silently skip: the new test has no skip marker (SCN-4).
- **Open question (non-blocking)** — the specification filename is `CHG-0001-...` while its
  frontmatter carries `change: chg:dark-factory-product-1:2026:0002`. This request keeps the
  change id from the spec and does not rename the file; reconcile numbering in a separate
  housekeeping change if the discrepancy matters.

## 9. How to review this request without the source thread

1. Read §2 first: it establishes that the description's "no coverage" premise is wrong and
   that the real deliverable is a dedicated module with a **non-default** configuration
   assertion. If that narrowed framing is rejected, the request should be re-planned before T1.
2. Confirm the scope boundaries in §4.2 against your intent (especially: **not** deleting the
   existing test, **no** production-code touch).
3. Skim §5 for acceptance criteria whose absence would make the test non-discriminating —
   **AC-3.2** (non-default `app_name`) and **AC-3.4** (exact two-key body) are the load-bearing
   ones; AC-3.3 (no version literal) is the anti-duplication guard.
4. Check that the task list in §6 is executable as written: one added file, one test, gates and
   a sensitivity check with explicit dependencies, and a scope guard (T6) before packaging (T7).
