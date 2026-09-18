---
schema: dark-factory.dev/plan/v1
id: plan:dark-factory-product-1:api:readme-api-section
type: plan
title: Document the product API in the README
product: dark-factory-product-1
status: active
change: chg:dark-factory-product-1:2026:0003
stage: planning
attempt: 1
specification: spec:dark-factory-product-1:api:readme-api-section
deliverable_paths:
  - README.md
production_code_touched: false
---

# Change package — document the product API in `README.md`

This document is the complete, self-contained request. A reviewer needs no access
to the originating task thread: §1 states the change, §3 the motivation, §4 the
boundaries, §5 the acceptance criteria, and §7 the executable task list with
explicit dependencies. The authoritative specification (identical criteria, plus
its own scenarios) is
`.factory/changes/CHG-0003-readme-api-section/specification.md`; the criteria ids
below are the ones defined there.

## 1. Change summary

`README.md` documents the backend HTTP surface in **one sentence** inside the
"Run locally" section (`README.md:36-37`):

> Endpoints: `GET /` - liveness (no database); `GET /api/healthz` - readiness
> (pings PostgreSQL, 503 while it is down).

Add a dedicated top-level **`## API`** section that documents each of the two
endpoints that exist today, one entry per endpoint, with its **purpose** and its
**response codes**:

| Endpoint | Purpose (as to be documented) | Response codes |
| --- | --- | --- |
| `GET /` | Liveness; returns the application name and version; never touches the database. | `200` only |
| `GET /api/healthz` | Readiness; pings PostgreSQL. | `200` when PostgreSQL answers; `503` while it is down/unreachable |

The change is **documentation-only**. `README.md` is the only deliverable path.
No file under `backend/`, `frontend/`, `deploy/`, or `.github/` is modified; no
production code, test, dependency, or configuration file changes. Consequently
there is no new test: the existing backend and frontend suites must simply stay
green (§5 R7).

**Bottom line for the reviewer:** one file edited, no behaviour changed, a
contract statement added that is provably consistent with the code and the tests.

## 2. Corrections and clarifications to the incoming description

The description is materially accurate (both endpoints, their semantics, the
`README.md` target, docs-only). Three points are recorded so review does not
re-derive them:

1. **The README is not empty of API text — it has one line, and it stays or is
   folded.** `README.md:36-37` already names both endpoints. This change adds a
   *section*; it does not introduce the first mention. Whether that one-line
   sentence is folded into the new section or retained is left open by the spec
   (both satisfy the criteria) but it must not contradict the new section
   (AC-2.4). See T2.
2. **"App name" is the JSON key `app`, not `name`.** The handler returns
   `AppInfo(app=request.app.title, version=app.__version__)`
   (`backend/src/app/health.py:39-42`), and the existing test asserts the body
   `{"app": "dark-factory-product-1", "version": app.__version__}`. If the new
   section documents a body, it must use the key `app` (AC-5.4); prose may say
   "application name" (AC-3.3 looks for `name`/`version` wording). Do not invent a
   `name` key.
3. **Only endpoints that exist may be documented.** Other in-flight specs in this
   repository describe endpoints that do **not** exist yet (`GET /api/version`,
   `GET /api/notes`). They are explicitly out of scope; the documented set must
   equal the app's actual route set, `{"/", "/api/healthz"}` with `GET` only
   (AC-2.2).

No scope-widening correction is required. This package keeps the spec's scope.

## 3. Motivation

- **Contract discoverability.** A reader looking for the HTTP contract today
  finds a single sentence buried under a local-development heading. A top-level
  `## API` section is the conventional home for it and makes the contract
  reachable without reading the run instructions.
- **Response codes are only half documented.** `503` is stated for
  `/api/healthz`; neither endpoint's success code (`200`) is stated, and nothing
  says `GET /` has no other outcome. A client author cannot tell which statuses
  to handle from the current text.
- **Purpose and guarantees are not stated as contract.** `GET /`'s payload
  (application name and version) and its "never touches the database" guarantee
  — the reason liveness does not fail during a database outage — are not
  written down; `/api/healthz`'s "readiness" role is not named.
- **Drift protection.** An explicit, checkable statement gives future changes
  something to keep true (and gives reviewers a place to catch divergence).
- **Low cost, zero runtime risk.** Markdown-only; nothing is built or deployed
  from it, so the change cannot affect an image or a running service.

## 4. Scope

### 4.1 In scope

| # | Item |
| --- | --- |
| 1 | Add a top-level `## API` section to `README.md` with a non-empty body. |
| 2 | Document `GET /`: purpose = liveness; payload = application name + version; guarantee = never touches the database; response code `200`. |
| 3 | Document `GET /api/healthz`: purpose = readiness; mechanism = pings PostgreSQL; response codes `200` (database reachable) and `503` (database down/unreachable). |
| 4 | Optionally fold the pre-existing endpoint sentence (`README.md:36-37`) into the new section, or leave it in place — provided nothing in the README contradicts the new section. |

### 4.2 Out of scope (explicitly unchanged)

1. Any file under `backend/src/` (`health.py`, `main.py`, `config.py`,
   `__init__.py`, `db.py`, models, migrations): routes, methods, response
   models, bodies, and status codes stay exactly as they are.
2. Any file under `backend/tests/` or `frontend/` — no new tests; the existing
   suites must stay green.
3. Adding, removing, renaming, or re-describing an endpoint. Only `GET /` and
   `GET /api/healthz` may be documented; **no** `GET /api/version`, no
   `GET /api/notes`, no future/planned endpoint, and no framework-supplied
   `/docs`, `/openapi.json`, or `/redoc`.
4. Authentication/authorization, CORS, caching, rate limiting, OpenAPI/Swagger
   descriptions, or gateway rules.
5. Helm/deploy (`deploy/**`), CI (`.github/workflows/ci.yml`), and dependency
   files (`backend/pyproject.toml`, `backend/uv.lock`, `frontend/package.json`,
   `frontend/package-lock.json`).
6. Changing `Settings.app_name` (default `"dark-factory-product-1"`), the package
   version (`app.__version__ == "0.1.0"`), or any environment variable.
7. Rewriting other README sections (layout, local run, deployment, placeholders)
   beyond the optional fold in in-scope item 4.

## 5. Refined requirements and acceptance criteria

Reproduced from the specification so this request stands alone. Terminology: the
**`GET /` entry** is the Markdown element (table row, list item, or heading) that
documents `GET /` and begins with the token `` `GET /` ``; the
**`GET /api/healthz` entry** is defined symmetrically for the token
`` `GET /api/healthz` ``. "HTTP status code" means a three-digit number. Every
criterion is decidable by reading `README.md`, by inspecting the named
source/test file, or by running a stated command (see §6).

### R1 — A dedicated `## API` section exists

- **AC-1.1** `README.md` contains a level-2 ATX heading whose text is exactly
  `API` (regex `^## API[ \t]*$`).
- **AC-1.2** The `## API` section has a non-empty body; it starts at the `## API`
  heading and ends at the next level-2 (`## `) heading or end of file, and is not
  inside a fenced code block.
- **AC-1.3** Within the section, the tokens `` `GET /` `` and
  `` `GET /api/healthz` `` each begin their own, distinct entry; neither token is
  used only as a substring of the other.

### R2 — The section documents exactly the endpoints that exist

- **AC-2.1** The set of endpoint tokens documented in the `## API` section is
  exactly `` `GET /` `` and `` `GET /api/healthz` `` — no more, no fewer.
- **AC-2.2** The documented set equals the app's product routes:
  `create_app(...).openapi()["paths"]` is exactly `{"/", "/api/healthz"}`, whose
  only operations are `GET`.
- **AC-2.3** No non-product route is documented: the strings `/docs`,
  `/openapi.json`, and `/redoc` do not appear as documented endpoints.
- **AC-2.4** No statement elsewhere in `README.md` contradicts the API section.
  In particular, if the pre-existing sentence (`README.md:36-37`) is retained, it
  names the same two endpoints and makes the same liveness / no-database and
  readiness / PostgreSQL / `503` claims.

### R3 — The `GET /` entry states its purpose and response code

- **AC-3.1** The `GET /` entry contains the word `liveness` (case-insensitive).
- **AC-3.2** The `GET /` entry states that the handler does not touch the
  database: it contains at least one of `no database`,
  `does not touch the database`, `never touches the database`,
  `without touching the database`.
- **AC-3.3** The `GET /` entry states the payload: it contains both `name` and
  `version` (case-insensitive), i.e. the application name and version.
- **AC-3.4** The `GET /` entry documents `200` as its response code and
  documents no other HTTP status code.

### R4 — The `GET /api/healthz` entry states its purpose and response codes

- **AC-4.1** The `GET /api/healthz` entry contains the word `readiness`
  (case-insensitive).
- **AC-4.2** The `GET /api/healthz` entry contains `PostgreSQL`.
- **AC-4.3** The `GET /api/healthz` entry documents both `200` (database
  reachable) and `503` (database down/unreachable).
- **AC-4.4** The `503` is associated with the database being down: the entry
  contains `503` together with at least one of `down`, `unreachable`,
  `unavailable`.
- **AC-4.5** The `GET /api/healthz` entry documents no HTTP status code other
  than `200` and `503`.

### R5 — The documentation agrees with the implementation and its tests

- **AC-5.1** The `GET /` success code documented in AC-3.4 (`200`) equals the
  status asserted by
  `backend/tests/unit/test_health.py::test_root_reports_app_metadata_without_the_database`,
  and the AC-3.3 "name and version" payload matches that test's asserted body
  keys `app` and `version`.
- **AC-5.2** The `GET /api/healthz` codes documented in AC-4.3 (`200`, `503`)
  equal the statuses asserted by
  `backend/tests/unit/test_health.py::test_healthz_reports_ok_without_a_real_database`
  (`200`) and
  `backend/tests/unit/test_health.py::test_healthz_returns_503_when_the_database_fails`
  (`503`).
- **AC-5.3** The mechanism claims match the source: "pings PostgreSQL" matches
  `healthz()` executing `SELECT 1` on the injected session
  (`backend/src/app/health.py:45-52`), and "does not touch the database" matches
  `index()`, which declares no session dependency and executes no SQL
  (`backend/src/app/health.py:39-42`).
- **AC-5.4** If the section documents response bodies, each documented body
  equals the body asserted by the corresponding existing test:
  `{"app": <name>, "version": <version>}` for `GET /`,
  `{"status": "ok", "database": "ok"}` for the `GET /api/healthz` `200`, and
  `{"detail": "database unavailable"}` for the `GET /api/healthz` `503`. If no
  body is documented, this criterion imposes nothing.

### R6 — Documentation-only change

- **AC-6.1** Excluding `.factory/**` metadata, the change diff
  (`git diff --name-only <baseline>..<head>`) lists exactly `README.md`.
- **AC-6.2** `git diff --name-only <baseline>..<head> -- backend frontend deploy
  .github` is empty.
- **AC-6.3** `backend/src/app/health.py`, `backend/src/app/main.py`, and
  `backend/src/app/config.py` are byte-identical to the baseline.
- **AC-6.4** `backend/pyproject.toml`, `backend/uv.lock`, `frontend/package.json`,
  and `frontend/package-lock.json` are byte-identical to the baseline.

### R7 — Existing gates stay green

- **AC-7.1** `cd backend && uv run pytest` exits 0 with `APP_TEST_DATABASE_URL`
  unset (unit tests pass; integration tests skip).
- **AC-7.2** `cd backend && uv run ruff check . && uv run ruff format --check .`
  exits 0.
- **AC-7.3** `cd frontend && npm run test` exits 0 (frontend untouched; guards
  against accidental edits).

Advisory (non-normative): the backend dev group also provides `mypy` (strict,
`backend/pyproject.toml`); running `cd backend && uv run mypy` is a cheap extra
check. No Python file changes, so it is expected to be a no-op.

## 6. Traceability

| Criterion | Verification | Task |
| --- | --- | --- |
| AC-1.1 | `grep -nE '^## API[ \t]*$' README.md` returns the heading. | T3 |
| AC-1.2 | Section body non-empty; bounded by the next `## ` heading; not inside a fence. | T3 |
| AC-1.3 | Locate each token as the first token of a distinct table row / list item / heading. | T3 |
| AC-2.1 | Enumerate endpoint tokens in the section; compare to the two allowed tokens. | T3 |
| AC-2.2 | Run the OpenAPI-path command (T3); expect `['/', '/api/healthz']`, `GET` only. | T3 |
| AC-2.3 | Search the section for `/docs`, `/openapi.json`, `/redoc` as endpoints; none. | T3 |
| AC-2.4 | Read the retained/ folded sentence (`README.md:36-37`) and the section; no contradiction. | T3 |
| AC-3.1 | `GET /` entry contains `liveness` (case-insensitive). | T4 |
| AC-3.2 | `GET /` entry contains one of the four "no database" phrases. | T4 |
| AC-3.3 | `GET /` entry contains `name` and `version`. | T4 |
| AC-3.4 | `GET /` entry contains `200` and no other three-digit status. | T4 |
| AC-4.1 | `GET /api/healthz` entry contains `readiness`. | T4 |
| AC-4.2 | `GET /api/healthz` entry contains `PostgreSQL`. | T4 |
| AC-4.3 | `GET /api/healthz` entry contains `200` and `503`. | T4 |
| AC-4.4 | Entry pairs `503` with `down` / `unreachable` / `unavailable`. | T4 |
| AC-4.5 | Entry contains no three-digit status other than `200` / `503`. | T4 |
| AC-5.1 | Compare with `test_root_reports_app_metadata_without_the_database`. | T4 |
| AC-5.2 | Compare with the two healthz unit tests. | T4 |
| AC-5.3 | Inspect `index()` / `healthz()` in `backend/src/app/health.py`. | T4 |
| AC-5.4 | If bodies are documented, compare with the tests' asserted bodies. | T4 |
| AC-6.1 | `git diff --name-only <baseline>..<head>`; only `README.md` outside `.factory/**`. | T5 |
| AC-6.2 | `git diff --name-only <baseline>..<head> -- backend frontend deploy .github` empty. | T5 |
| AC-6.3 | `git diff -- backend/src/app/{health,main,config}.py` empty. | T5 |
| AC-6.4 | `git diff -- backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json` empty. | T5 |
| AC-7.1 | `cd backend && uv run pytest` (DSN unset) exits 0. | T6 |
| AC-7.2 | `cd backend && uv run ruff check . && uv run ruff format --check .` exits 0. | T6 |
| AC-7.3 | `cd frontend && npm run test` exits 0. | T6 |

Every criterion maps to at least one task; every task's `Verifies` field lists
only criteria from this table.

## 7. Ordered task list (explicit dependencies)

Ordering is execution order; **Deps** are hard prerequisites. T3–T6 fan out after
T2 and must all complete before T7. The critical path is
**T0 → T1 → T2 → {T3, T4, T5, T6} → T7**.

### T0 — Baseline confirmation *(done in planning)*

- **Deps:** none.
- **Action:** confirm, against the baseline revision, that (a) `README.md:36-37`
  is the only endpoint documentation; (b) the handlers are `index()` at `"/"` and
  `healthz()` at `"/api/healthz"` in `backend/src/app/health.py`, registered via
  `app.include_router(health.router)` in `backend/src/app/main.py`; (c) the
  asserted contracts live in `backend/tests/unit/test_health.py` (three tests)
  and `backend/tests/integration/test_health_database.py`; (d) record the
  baseline revision for the T5 diff checks.
- **Verifies:** prerequisite for AC-2.2, AC-5.1–5.3, AC-6.3 baseline.
- **Status:** done — see §Appendix A.

### T1 — Draft the `## API` content (authoring, not yet committed)

- **Deps:** T0.
- **Action:** write the Markdown block that satisfies R1–R5: a `## API` heading
  with a non-empty body and one distinct entry per endpoint. `GET /` entry:
  liveness; no-database guarantee; payload = application name + version; `200`
  only. `GET /api/healthz` entry: readiness; pings PostgreSQL; `200` when the
  database answers; `503` while it is down/unreachable; no other status code.
  Document bodies only if they match AC-5.4 exactly; otherwise document purpose
  and codes without a body. No `/docs`, `/openapi.json`, `/redoc`, and no
  not-yet-existing endpoint.
- **Note:** the example in specification Appendix A is non-normative; wording is
  free. A table (one row per endpoint) satisfies AC-1.3 naturally.
- **Verifies:** produces AC-1.1–1.3, AC-3.1–3.4, AC-4.1–4.5.

### T2 — Apply the section to `README.md`

- **Deps:** T1.
- **File:** `README.md` (only).
- **Action:** insert the drafted `## API` section as a top-level section (a
  sensible position is near "Run locally" / before "Deployment"; no criterion
  pins the position). Resolve the pre-existing sentence at `README.md:36-37`:
  fold it into the section **or** leave it — if left, it must not contradict the
  new section (AC-2.4). Change nothing else.
- **Verifies:** AC-1.1–1.3, AC-2.1, AC-2.3, AC-2.4.

### T3 — Structural and inventory verification

- **Deps:** T2.
- **Action:** run and record:
  ```sh
  grep -nE '^## API[ \t]*$' README.md
  grep -n '`GET /`' README.md
  grep -n '`GET /api/healthz`' README.md
  cd backend && uv run python -c \
    "from app.config import Settings; from app.main import create_app; \
     print(sorted(create_app(Settings(database_url='postgresql+psycopg://stub:stub@localhost:5432/stub')).openapi()['paths']))"
  # expected: ['/', '/api/healthz']
  ```
  Confirm the section lists exactly the two tokens, no framework route, and no
  contradicting README statement.
- **Verifies:** AC-1.1, AC-1.2, AC-1.3, AC-2.1, AC-2.2, AC-2.3, AC-2.4.

### T4 — Accuracy verification against source and tests

- **Deps:** T2.
- **Action:** read the new entries side by side with `index()` / `healthz()`
  (`backend/src/app/health.py`) and the three unit tests in
  `backend/tests/unit/test_health.py`; confirm purpose words, mechanism claims,
  status codes, and (if present) bodies match exactly. Flag any documented status
  or body not backed by source/test.
- **Verifies:** AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-4.1, AC-4.2, AC-4.3, AC-4.4,
  AC-4.5, AC-5.1, AC-5.2, AC-5.3, AC-5.4.

### T5 — Docs-only scope guard

- **Deps:** T2.
- **Action:** run and record:
  ```sh
  git diff --name-only <baseline>..<head>
  git diff --name-only <baseline>..<head> -- backend frontend deploy .github
  git diff -- backend/src/app/health.py backend/src/app/main.py backend/src/app/config.py
  git diff -- backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json
  ```
  Expect: only `README.md` outside `.factory/**`; all other diffs empty.
- **Verifies:** AC-6.1, AC-6.2, AC-6.3, AC-6.4.

### T6 — Existing gates stay green

- **Deps:** T2.
- **Action:** run and record, from the repository root:
  ```sh
  cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
  cd frontend && npm run test
  ```
  `APP_TEST_DATABASE_URL` unset, so backend integration tests skip. All commands
  must exit 0.
- **Verifies:** AC-7.1, AC-7.2, AC-7.3.

### T7 — Package evidence and mark ready for review

- **Deps:** T3, T4, T5, T6.
- **Action:** attach the command outputs of T3–T6 and update this change's status
  to ready-for-review. No further file changes.
- **Verifies:** §8 Definition of done.

### Dependency graph

```
T0 ──→ T1 ──→ T2 ──┬──→ T3 ─┐
                   ├──→ T4 ─┤
                   ├──→ T5 ─┼──→ T7
                   └──→ T6 ─┘
```

## 8. Definition of done

1. `README.md` contains a top-level `## API` section documenting exactly
   `GET /` and `GET /api/healthz`, each with its purpose and response codes per
   R3/R4, and the documented contract agrees with the implementation and the
   existing tests (R5).
2. The change diff is documentation-only: `README.md` is the only non-
   `.factory/**` path changed, and no backend/frontend/deploy/CI/dependency file
   differs (R6).
3. The existing gates are green: backend ruff (`check` + `format --check`) and
   pytest exit 0, and the frontend test command exits 0 (R7).
4. Every acceptance criterion in §5 has a passing result from its mapped task.

## 9. Assumptions, risks, open questions

- **Assumption (verified in T0):** the app's entire product surface today is
  `{GET /, GET /api/healthz}`; the framework routes (`/docs`, `/openapi.json`,
  `/redoc`) are excluded from documentation.
- **Assumption:** `Settings.app_name` default `"dark-factory-product-1"` and
  `app.__version__ = "0.1.0"` are unchanged by this change — no criterion depends
  on their literal values, only on the payload *keys* `app` and `version`.
- **Risk — staleness from parallel changes.** Other in-flight specs in this
  repository propose new endpoints (`specs/version-endpoint/spec.md` →
  `GET /api/version`; `.factory/changes/notes-list/spec.md` → `GET /api/notes`).
  If one of those lands first, this README section must not be written against
  today's route set blind. T3's `openapi()` check is the guard: the documented set
  must match the routes present in the revision under review, and documenting a
  route that does not yet exist violates AC-2.1/AC-2.2. If the route set has
  changed by review time, re-run T3 and adjust before merge (or sequence the
  changes); no speculative endpoints are to be pre-documented here.
- **Risk — contradiction with the existing one-liner (low).** Handled explicitly
  by T2/AC-2.4; folding the sentence removes the risk entirely.
- **Open question (non-blocking) — fold or retain `README.md:36-37`?** The spec
  permits either. Retaining keeps the "Run locally" section self-contained;
  folding avoids duplication. Reviewer preference only; both satisfy the criteria.
- **Open question (non-blocking) — section placement.** No criterion pins where
  `## API` sits, only that it is top-level and has a non-empty body.
- **Accepted risk — documentation can drift again.** This change makes the
  contract explicit but adds no automated check that the README keeps matching
  the code. A future "docs vs `openapi()`" gate is a separate change, out of
  scope here.

## 10. How to review this request without the source thread

1. Read §1 and §4 to confirm the shape: one file (`README.md`), two endpoints,
   purpose + codes, docs-only.
2. Check the boundaries in §4.2 against your intent — especially: **no** code,
   **no** tests, **no** speculative endpoints.
3. Skim §5 for the load-bearing criteria: **AC-2.1/AC-2.2** (exactly the routes
   that exist), **AC-3.2** (the liveness "no database" guarantee),
   **AC-4.3/AC-4.4** (`503` tied to the database being down), and **AC-5.4**
   (any documented body must equal the tests' asserted bodies).
4. Confirm §7 is executable as written: a draft step, one edit step, then four
   parallel verification steps (structure, accuracy, scope, gates) feeding the
   packaging step, with a dependency graph.
5. If you disagree with the narrowed/kept scope, the place to say so is before
   T1 — after T1 every task is a check, not new work.

## Appendix A — Planning evidence

Confirmed while packaging against the baseline revision:

- **`README.md:36-37`** — the only statement of the endpoints today, quoted in
  §1; no `## API` heading exists yet.
- **`backend/src/app/health.py`** — `index()` (`GET /`, `response_model=AppInfo`)
  returns `AppInfo(app=request.app.title, version=app.__version__)` and takes no
  session; `healthz()` (`GET /api/healthz`, `response_model=HealthResponse`)
  executes `text("SELECT 1")` on the injected session and raises
  `HTTPException(503, detail="database unavailable")` on `SQLAlchemyError`,
  otherwise returns `HealthResponse(status="ok", database="ok")`.
- **`backend/src/app/main.py`** — `create_app` sets `FastAPI(title=settings.app_name)`
  and `include_router(health.router)`; no other router is registered.
- **`backend/src/app/config.py`** — `app_name: str = "dark-factory-product-1"`
  (default), `database_url` required.
- **`backend/src/app/__init__.py`** — `__version__ = "0.1.0"`.
- **`backend/tests/unit/test_health.py`** — asserts `GET /api/healthz` → `200`
  with `{"status": "ok", "database": "ok"}`, `GET /api/healthz` → `503` on a
  failing session, and `GET /` → `200` with
  `{"app": <app_name>, "version": app.__version__}`.
- **`backend/pyproject.toml`** — `[tool.ruff]` and `[tool.pytest.ini_options]`
  present; `mypy` strict configured (`files = ["src", "tests"]`).
- **Route-set check (T3)** — expected output
  `['/', '/api/healthz']`.

## Appendix B — Non-normative example of a satisfying section

Wording is not part of the contract; this is one shape that satisfies R1–R5.

```markdown
## API

The backend exposes two endpoints. Both are unauthenticated and return JSON.

| Endpoint | Purpose | Payload | Response codes |
|---|---|---|---|
| `GET /` | Liveness probe; reports the application name and version and never touches the database. | `{"app": <name>, "version": <version>}` | `200` |
| `GET /api/healthz` | Readiness probe; pings PostgreSQL. | `{"status": "ok", "database": "ok"}` | `200` when PostgreSQL answers; `503` while it is down (`{"detail": "database unavailable"}`) |
```
