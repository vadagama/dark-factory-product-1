# Change Request (packaged): `GET /api/version` + integration test

- **Change:** New `GET /api/version` endpoint with an integration test. Stage:
  **planning**, attempt 1.
- **Refined requirements:** attached in §6, sourced from
  [`specs/version-endpoint/spec.md`](./spec.md) (stage: specification,
  attempt 1). That document is normative; §6 is the reviewer-facing digest.
- **Reviewable standalone:** yes. This file needs no access to the original
  task thread. Every claim below cites a path that was read.

---

## 1. Change summary

Add one read-only HTTP route to the FastAPI backend:

```
GET /api/version  ->  200  {"app": "<app_name>", "version": "<app.__version__>"}
```

plus one integration test at `backend/tests/integration/test_version.py` and a
one-line documentation update. No new configuration, no database access, no
authentication, no frontend work.

## 2. Motivation

Operators, clients and deployment tooling cannot read the running backend's
application name and version from the documented `/api/...` surface. The
identical payload already exists at `GET /` (`backend/src/app/health.py:39-42`),
but `/` is a human-facing liveness/root route, so:

- a deploy can only confirm *which* app/version is live by scraping a route
  that is not part of the API namespace;
- any future gateway/ingress rule, auth policy or rate-limit scoped to
  `/api/*` would silently skip the only metadata route.

`GET /api/version` closes that gap while remaining a pure metadata read. The
`version` value must be read from the single source of truth
`app.__version__` (`backend/src/app/__init__.py:3`) so it can never drift from
the package (and from `pyproject.toml`'s project version, currently `0.1.0`).

## 3. Scope

**In scope**

| # | Item |
|---|---|
| S-1 | New backend route `GET /api/version`, registered on the app built by `create_app` (`backend/src/app/main.py`). |
| S-2 | Response body `{"app": <Settings.app_name>, "version": app.__version__}`, reusing the existing `AppInfo` Pydantic model. |
| S-3 | New integration test `backend/tests/integration/test_version.py`, following the DSN-skip pattern of `backend/tests/integration/test_health_database.py`. |
| S-4 | `README.md` endpoints paragraph lists `GET /api/version`. |
| S-5 | All existing CI gates stay green (`ruff check`, `ruff format --check`, `mypy`, `pytest`). |

**Out of scope** (explicitly excluded — do not expand the diff)

- Changing `GET /` or `GET /api/healthz` behaviour or payloads.
- Frontend/client work (`frontend/src/api/client.ts`, `HealthPage.tsx`, UI kits).
- Authentication, authorization, API keys, CORS, gateway/ingress rules.
- Database access, schema changes, Alembic migrations.
- Bumping `app.__version__` or the `Settings.app_name` default.
- Cache headers, ETag, content negotiation, extra OpenAPI metadata.
- A second router module is *permitted* but **not required** (§5, D1).
- Chart probe changes (`deploy/chart/values.yaml` keeps probing `/api/healthz`).

## 4. Ground truth verified in the repository

Read during planning; the plan assumes these facts.

| Fact | Evidence |
|---|---|
| The route does not exist yet. No `test_version.py` exists. | `search_repo("/api/version")` matches only `specs/version-endpoint/spec.md`; `search_repo("def test_")` lists 8 tests across `tests/unit/test_config.py`, `tests/unit/test_health.py`, `tests/integration/test_health_database.py`. |
| `AppInfo(app: str, version: str)` already exists and is the intended payload shape. | `backend/src/app/health.py:23-25`. |
| `GET /` returns exactly `AppInfo(app=request.app.title, version=app.__version__)`. | `backend/src/app/health.py:39-42`. |
| `create_app` sets `FastAPI(title=settings.app_name, ...)`, so `request.app.title == settings.app_name`. | `backend/src/app/main.py:31`. |
| `Settings.app_name` default is `"dark-factory-product-1"`; `database_url` is required (no default). | `backend/src/app/config.py:19-22`. |
| `app.__version__ == "0.1.0"`. | `backend/src/app/__init__.py:3`. |
| The health `router` is already included by the factory, so a route added to it needs **no** `main.py` change. | `backend/src/app/main.py:16` (`from app import health`) and `:34` (`app.include_router(health.router)`). |
| Engine creation is lazy and does no I/O. | `backend/src/app/db.py:22-24` (`create_async_engine(..., pool_pre_ping=True)`); `create_app` only constructs engine + sessionmaker (`main.py:26,32`). |
| **No authentication or middleware exists anywhere in the backend.** | `search_repo("middleware")` and `search_repo("Authorization")` match only prose inside `specs/version-endpoint/spec.md`. |
| Integration tests use a module-level skipif + `asyncio.run`, **not** pytest-asyncio. `pytest-asyncio` is not a dependency. | `backend/tests/integration/test_health_database.py:17-21,25-37`; dev deps in `backend/pyproject.toml:27-33` are httpx/mypy/pytest/ruff only. |
| `mypy` runs in `strict` mode over `src` **and** `tests` (tests relax only `disallow_untyped_defs`/`disallow_untyped_calls`). | `backend/pyproject.toml:44-53`. |
| CI runs `ruff check .`, `ruff format --check .`, `uv run mypy`, `uv run pytest` with `APP_TEST_DATABASE_URL` set against a `postgres:16-alpine` service on port 55432. | `.github/workflows/ci.yml` jobs `backend-lint`, `backend-typecheck`, `backend-test`. |
| A specification already exists for this change and is the normative source. | `specs/version-endpoint/spec.md`. |

**Not verified / not run:** no test suite, linter or type checker was executed
during planning. All gate claims in §8 are expectations, to be confirmed by the
implementer.

## 5. Discrepancies and decisions required

- **D1 — File location is misstated in the change description.** The brief says
  `app/src/app/health.py` or a new router module. The real path is
  **`backend/src/app/health.py`**. Both placements are acceptable per the spec
  ("A `/api/version` in a new router module is permitted, but adding a second
  router file is not required"). **Recommendation:** add the handler to the
  existing `backend/src/app/health.py` and let the already-included
  `health.router` register it. Smallest diff, zero wiring changes, reuses
  `AppInfo`. A new `backend/src/app/version.py` router is the fallback if the
  team prefers not to grow `health.py`.
- **D2 — Handler shape (duplicate vs. shared).** `GET /` already computes the
  identical payload. Two acceptable options; both satisfy every criterion:
  - **(a) Recommended:** add a dedicated `version()` handler in `health.py`
    that returns `AppInfo(app=request.app.title, version=app.__version__)`,
    leaving `index` untouched. Clear OpenAPI operation name (`version`), no
    behaviour change to `GET /`.
  - **(b) Acceptable:** stack a second route decorator on the existing `index`
    function. Fewer lines (one line duplicated either way), but the OpenAPI
    operation id is derived from the function name and both routes share the
    `health` tag.
  Either way, do **not** factor `GET /` into a shared dependency just for this.
  The one-line duplication is cheaper than the indirection.
- **D3 — "Must not require authentication" is currently vacuous.** No auth
  layer exists, so AC-6 passes today by construction. Keep the assertion in the
  test as a **regression guard** (it is cheap, and it is the only thing that
  would catch a future middleware added to `/api/*`), but do not treat it as
  requiring implementation work.
- **D4 — Do not wire this route as a Kubernetes probe.** It returns `200`
  even when PostgreSQL is down (that is the point). `/api/healthz` remains the
  only readiness probe (`deploy/chart/values.yaml:45-48`). Recording this so a
  later reviewer does not "improve" the chart.
- **D5 — Optional hermetic unit test (scope decision).** As specified, the
  only new test is the integration one, which **skips** when
  `APP_TEST_DATABASE_URL` is unset (`backend/tests/integration/test_health_database.py:19-21`).
  Consequently AC-1 … AC-8 are unenforced on any machine or job without a DSN,
  and CI only enforces them because it provides a service container. A ~15-line
  hermetic test in `backend/tests/unit/test_health.py` (mirroring
  `test_root_reports_app_metadata_without_the_database`, `:68-79`) would close
  that gap with no new dependencies. **Recommendation:** include it (task T4);
  it is additive and the spec's traceability matrix already points R2 at
  `backend/tests/unit/test_health.py`. If the reviewer insists on a strict
  scope match with the brief, drop T4 and accept the coverage gap.

## 6. Refined requirements and acceptance criteria

Digest of `specs/version-endpoint/spec.md` §"Requirements and acceptance
criteria"; AC identifiers are preserved so the spec remains traceable.

| Req | Statement |
|---|---|
| **R1** | `GET /api/version` exists and is reachable through `create_app`. |
| **R2** | The payload is exactly app name + version, taken from live configuration and the package. |
| **R3** | The route requires no authentication. |
| **R4** | The route requires no database connectivity. |
| **R5** | The integration test follows the existing DSN-skip pattern. |
| **R6** | No regression to existing endpoints; no new configuration; docs updated. |

Acceptance criteria:

1. **AC-1** — `create_app(settings)` exposes `GET /api/version`; an
   `httpx.ASGITransport` request returns HTTP **200** (not 404/405).
2. **AC-2** — method is `GET` and the path is exactly `/api/version` (a plain
   `GET` resolves to the endpoint, not a catch-all).
3. **AC-3** — for `Settings(app_name=X)`, the body equals
   `{"app": X, "version": app.__version__}` with **no extra keys** (exact JSON
   equality).
4. **AC-4** — with default `Settings`, `app == "dark-factory-product-1"` and
   `version == app.__version__` (**read from the package**, not hardcoded in
   the route).
5. **AC-5** — both fields are JSON strings and `Content-Type` is
   `application/json` (guaranteed by reusing `response_model=AppInfo`).
6. **AC-6** — a request sent **without** `Authorization`, `Cookie` or API-key
   headers returns the R2 payload with `200`; never `401`/`403`.
7. **AC-7** — an app built with an unreachable `database_url` still returns
   `200` with the R2 payload on `GET /api/version`.
8. **AC-8** — the handler does not depend on `get_session` and executes no SQL
   (no `session.execute`).
9. **AC-9** — `backend/tests/integration/test_version.py` exists and **skips**
   (not fails) when `APP_TEST_DATABASE_URL` is unset, using the same
   `pytestmark = pytest.mark.skipif(...)` pattern and the same constant name as
   `test_health_database.py`.
10. **AC-10** — when `APP_TEST_DATABASE_URL` is set, the test builds
    `create_app(Settings(database_url=...))`, drives it through
    `httpx.ASGITransport`, and asserts `200` plus the exact R2 body against a
    real PostgreSQL.
11. **AC-11** — `GET /` still returns `{"app": ..., "version": ...}` and
    `GET /api/healthz` still returns `{"status": "ok", "database": "ok"}`.
12. **AC-12** — no new environment variable; only `Settings.app_name`
    configures the payload; unit + integration suites stay green.
13. **AC-13** — `README.md`'s endpoints paragraph names `GET /api/version`
    alongside `GET /` and `GET /api/healthz`.

Scenarios S1–S9 in the spec map one-to-one onto these criteria (S1→AC-1/2,
S2→AC-3/5/10, S3→AC-4, S4→AC-6, S5→AC-7/8, S6→AC-9, S7→AC-10, S8→AC-11/12,
S9→AC-13).

## 7. Task list (ordered, with explicit dependencies)

`T0` is a gate: do not start `T1` until D1–D5 in §5 are answered.

| ID | Task | Depends on | Deliverable | Criteria |
|---|---|---|---|---|
| **T0** | Resolve decisions D1–D5 (route placement, handler shape, include-or-skip the hermetic unit test). | — | Recorded decision in this file / MR description. | — |
| **T1** | Add the `GET /api/version` handler to `backend/src/app/health.py` (default per D1/D2): a `version()` function decorated with `@router.get("/api/version", response_model=AppInfo)`, returning `AppInfo(app=request.app.title, version=app.__version__)`. No `Depends(get_session)`, no `session.execute`, no new imports. | T0 | Edited `backend/src/app/health.py`. | AC-1…AC-8 (AC-6 trivially, per D3) |
| **T2** | Confirm registration without touching wiring: the route comes from `health.router`, which `create_app` already includes (`main.py:34`). Only touch `backend/src/app/main.py` if D1 chose a **new** router module (then add `from app import version` + `app.include_router(version.router)`). | T1 | Zero-diff by default; or the two-line `main.py` change under the D1 fallback. | AC-1, AC-2 |
| **T3** | Add `backend/tests/integration/test_version.py`, modelled on `backend/tests/integration/test_health_database.py`: same `DATABASE_URL_ENV = "APP_TEST_DATABASE_URL"` constant, same module-level `pytestmark = pytest.mark.skipif(...)`, same `asyncio.run(scenario())` + `httpx.ASGITransport(app=..., base_url="http://test")` shape (pytest-asyncio is not installed). Assert exact body against `app.__version__` and an explicit `Content-Type` check; include a case with a custom `app_name` and a case with no auth headers. | T1 | New `backend/tests/integration/test_version.py`. | AC-3, AC-5, AC-6, AC-9, AC-10 |
| **T3b** | *(If kept per D5)* Add a no-DSN assertion that the unreachable-DSN app still answers `200` — either as a hermetic unit test or a non-skipped case, since AC-7/AC-8 must hold **without** a database by definition. | T1, T3 | Test covering the unreachable-DSN path. | AC-7, AC-8 |
| **T4** | *(Optional, per D5)* Add `test_version_reports_app_metadata_without_the_database` to `backend/tests/unit/test_health.py`, mirroring `test_root_reports_app_metadata_without_the_database` (`:68-79`) but hitting `/api/version`. Makes AC-1…AC-8 enforceable with no DSN. | T1 | Edited `backend/tests/unit/test_health.py`. | AC-1…AC-8 (hermetic) |
| **T5** | Update the `README.md` endpoints paragraph (`README.md:36-37`) to list `GET /api/version` alongside `GET /` and `GET /api/healthz`, wording it as a pure metadata read with no database. | T1 | Edited `README.md`. | AC-13 |
| **T6** | Run the local gate sequence and fix fallout: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest`. Ruff enforces line-length 100 and formatting, so run `uv run ruff format .` before the check. | T1, T3, T5 | Green gates; formatted diff. | AC-12, AC-11 |
| **T7** | Prove the skip/run duality of the integration suite: run `uv run pytest tests/integration -q` **without** `APP_TEST_DATABASE_URL` (expect skips, zero failures) and again **with** it pointed at a reachable PostgreSQL (expect the version test to execute and pass). | T3 | Captured command output in the MR. | AC-9, AC-10 |
| **T8** | Regression check: existing unit tests and `GET /` + `GET /api/healthz` responses unchanged; `git diff` touches only the files listed in §3. | T6 | Diff review + green suite. | AC-11, AC-12 |
| **T9** | Close the loop on the spec: flip `specs/version-endpoint/spec.md` status from `proposed` to implemented, and record which AC each test asserts (its traceability matrix already predicts the mapping). | T7, T8 | Updated spec status + evidence links. | AC-1…AC-13 |

Critical path: **T0 → T1 → T3 → T6 → T7 → T9** (T2 is zero-diff by default;
T4/T3b only if D5 says yes; T5 is independent of T3 and can run in parallel).

## 8. Verification / exit criteria

Exit criteria — all must hold:

1. `GET /api/version` on an app from `create_app` returns `200` with exactly
   `{"app": <app_name>, "version": app.__version__}`.
2. The route answers `200` with **no** auth headers and with a `database_url`
   pointing at nothing listening.
3. `backend/tests/integration/test_version.py` **skips** without
   `APP_TEST_DATABASE_URL` and **passes** with it against PostgreSQL.
4. `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` is green locally, and the CI `backend-lint`,
   `backend-typecheck`, `backend-test` jobs are green on the pinned SHA
   (`.github/workflows/ci.yml`).
5. `git diff` contains only: `backend/src/app/health.py` (or a new
   `backend/src/app/version.py` + two lines in `main.py`), the new integration
   test, optionally `backend/tests/unit/test_health.py`, and `README.md`.
6. No frontend, chart, migration or CI file is modified.

Suggested commands:

```sh
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy
uv run pytest tests/unit -q                        # hermetic
uv run pytest tests/integration -q                 # without DSN -> skips
APP_TEST_DATABASE_URL=postgresql+psycopg://test:test@localhost:55432/dark_factory_product_1_test \
  uv run pytest tests/integration -q               # executes
```

## 9. Risks and rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Duplicated payload between `GET /` and `GET /api/version` drifts over time. | Low–medium | Both read `app.__version__` and `request.app.title`; no hardcoded version string anywhere (§6 AC-4). |
| Someone repoints the Kubernetes readiness probe at `/api/version`, masking DB outages. | Low | Decision D4 recorded; `/api/healthz` stays the readiness probe (`deploy/chart/values.yaml:45-48`). |
| New test silently skips everywhere (no DSN), so the criteria are never actually enforced. | Medium | T7 explicitly runs both modes; T4/T3b add hermetic coverage (D5). |
| `mypy --strict` over `tests` rejects the new test's untyped inner coroutine. | Low | `tests.*` relaxes `disallow_untyped_defs`, and the existing integration test already passes under the same config (`pyproject.toml:50-53`). |
| Ruff format drift fails CI `ruff format --check`. | Low | Run `uv run ruff format .` in T6. |
| Reviewer expands scope into auth/frontend/probes. | Low | §3 out-of-scope list is explicit and exhaustive. |

**Rollback:** revert the single commit. The change is additive (one new route,
one new test file, one doc sentence) with no migration, no persisted state and
no configuration surface, so reverting restores the previous behaviour exactly;
nothing depends on `/api/version`.

## 10. Open questions for the reviewer

1. **D1** — add the route to `backend/src/app/health.py` (recommended) or create
   `backend/src/app/version.py`?
2. **D2** — dedicated `version()` handler (recommended) or a stacked decorator
   on the existing `index`?
3. **D5** — do we add the ~15-line hermetic unit test so AC-1…AC-8 are enforced
   without a DSN, accepting a small scope increase beyond the literal brief?
4. Is the endpoint expected to be consumed by any client in this iteration
   (`frontend/src/api/client.ts`), or is it purely an operational surface? Any
   consumption is out of scope here.
