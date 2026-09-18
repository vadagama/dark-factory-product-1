---
schema: dark-factory.dev/specification/v1
id: spec:dark-factory-product-1:api:readme-api-section
type: specification
title: Document the product API in the README
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0003
---

# Document the product API in the README

## Problem

`README.md` names the two backend endpoints exactly once, in a single sentence
inside the "Run locally" section (`README.md:36-37`):

> Endpoints: `GET /` - liveness (no database); `GET /api/healthz` - readiness
> (pings PostgreSQL, 503 while it is down).

That sentence is the entire product API documentation, and it is insufficient:

1. **No API section.** A reader looking for the HTTP contract has no dedicated
   place to find it; the only mention sits under a local-development heading.
2. **Response codes are only half stated.** `503` is given for
   `GET /api/healthz`, but neither endpoint's success code (`200`) is stated,
   and nothing says `GET /` has no other outcome. A client cannot tell which
   statuses it must handle.
3. **No per-endpoint purpose/payload.** `GET /`'s payload (application name and
   version) and the guarantees (liveness, never touches the database) are not
   stated as contract; `/api/healthz`'s "readiness" purpose is not named.
4. **Drift risk.** Without an explicit contract statement to compare against,
   the documentation and the implementation can diverge silently.

Both endpoints exist today in `backend/src/app/health.py` (`index` and
`healthz`), registered on the app built by `create_app`
(`backend/src/app/main.py`). This change documents them; it changes no
behaviour and adds no endpoint.

## Scope

### In scope

1. Adding a `## API` section to `README.md`.
2. Documenting `GET /`: purpose = liveness; payload = the application name and
   version; the guarantee that it never touches the database; response code
   `200`.
3. Documenting `GET /api/healthz`: purpose = readiness; that it pings
   PostgreSQL; response codes `200` (database reachable) and `503` (database
   down/unreachable).
4. Optionally folding the pre-existing endpoint sentence (`README.md:36-37`)
   into the new section or leaving it in place, provided nothing in the README
   contradicts the new section.

### Out of scope

1. Any change under `backend/src/` (`health.py`, `main.py`, `config.py`,
   `__init__.py`, `db.py`, models, migrations): route paths, HTTP methods,
   response models, response bodies, and status codes stay exactly as they are.
2. Any change under `backend/tests/` or `frontend/` (no new tests; the existing
   suites must stay green).
3. Adding, removing, renaming, or re-describing an endpoint. Only the two
   endpoints that exist today may be documented; no `GET /api/version`, no
   future/planned endpoints, and no entry for the framework-supplied `/docs`,
   `/openapi.json`, or `/redoc`.
4. Authentication/authorization, CORS, caching, rate limiting, OpenAPI/Swagger
   descriptions, or gateway rules.
5. Helm/deploy (`deploy/**`), CI (`.github/workflows/ci.yml`), and dependency
   files (`backend/pyproject.toml`, `backend/uv.lock`, `frontend/package.json`,
   `frontend/package-lock.json`).
6. Changing `Settings.app_name` (default `"dark-factory-product-1"`) or
   `app.__version__` (`"0.1.0"`), and adding or changing any environment
   variable.
7. Rewriting other README sections (layout, local run, deployment,
   placeholders) beyond the optional fold of the existing endpoint sentence.

## Requirements

Each criterion is checkable by reading `README.md`, by inspecting the named
source/test file, or by running a stated command (see §"Verification commands"
and the traceability table).

Terminology: the **`GET /` entry** is the text that documents `GET /` — the
table row, list item, or sub-heading that begins with the token `` `GET /` `` —
up to the next endpoint entry or the end of the API section. The
**`GET /api/healthz` entry** is defined symmetrically for the token
`` `GET /api/healthz` ``. "HTTP status code" means a three-digit number.

### R1 — A dedicated `## API` section exists

- **AC-1.1** `README.md` contains a level-2 ATX heading whose text is exactly
  `API` (regex `^## API[ \t]*$`).
- **AC-1.2** The `## API` section has a non-empty body and is a top-level
  section: it starts at the `## API` heading and ends at the next level-2
  (`## `) heading or at end of file. It is not inside a fenced code block.
- **AC-1.3** Within the `## API` section, the tokens `` `GET /` `` and
  `` `GET /api/healthz` `` each begin their own, distinct entry (a Markdown
  table row, a list item, or a heading/sub-heading). Both endpoints are
  documented; neither token is used only as a substring of the other.

### R2 — The section documents exactly the endpoints that exist

- **AC-2.1** The set of endpoint tokens documented in the `## API` section is
  exactly `` `GET /` `` and `` `GET /api/healthz` `` — no more, no fewer.
- **AC-2.2** The documented endpoint set matches the application's product
  routes: `create_app(...).openapi()["paths"]` is exactly `{"/",
  "/api/healthz"}`, whose only operations are `GET` (verified by the command in
  §"Verification commands", AC-2.2 check).
- **AC-2.3** No non-product route is documented in the section: the strings
  `/docs`, `/openapi.json`, and `/redoc` do not appear as documented endpoints.
- **AC-2.4** No statement elsewhere in `README.md` contradicts the API section.
  In particular, if the pre-existing endpoint sentence (`README.md:36-37`) is
  retained, it names the same two endpoints and makes the same liveness /
  no-database and readiness / PostgreSQL / `503` claims.

### R3 — The `GET /` entry states its purpose and response code

- **AC-3.1** The `GET /` entry contains the word `liveness` (case-insensitive).
- **AC-3.2** The `GET /` entry states that the handler does not touch the
  database: it contains at least one of `no database`, `does not touch the
  database`, `never touches the database`, `without touching the database`.
- **AC-3.3** The `GET /` entry states the payload: it contains both `name`
  and `version` (case-insensitive), i.e. the application name and version.
- **AC-3.4** The `GET /` entry documents `200` as its response code and
  documents no other HTTP status code.

### R4 — The `GET /api/healthz` entry states its purpose and response codes

- **AC-4.1** The `GET /api/healthz` entry contains the word `readiness`
  (case-insensitive).
- **AC-4.2** The `GET /api/healthz` entry contains `PostgreSQL`.
- **AC-4.3** The `GET /api/healthz` entry documents both `200` (database
  reachable) and `503` (database down/unreachable).
- **AC-4.4** The `GET /api/healthz` entry's `503` is associated with the
  database being down: the entry contains `503` together with at least one of
  `down`, `unreachable`, `unavailable`.
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
  `healthz()` executing `SELECT 1` on the injected session, and the
  "does not touch the database" claim for `GET /` matches `index()`, which
  declares no session dependency and executes no SQL
  (`backend/src/app/health.py`).
- **AC-5.4** If the API section documents response bodies, each documented body
  equals the body asserted by the corresponding existing test:
  `{"app": <name>, "version": <version>}` for `GET /`,
  `{"status": "ok", "database": "ok"}` for the `GET /api/healthz` `200`, and
  `{"detail": "database unavailable"}` for the `GET /api/healthz` `503`. (If no
  body is documented, this criterion imposes nothing.)

### R6 — Documentation-only change

- **AC-6.1** Excluding `.factory/**` metadata, the change diff
  (`git diff --name-only <baseline>..<head>`) lists exactly `README.md`.
- **AC-6.2** `git diff --name-only <baseline>..<head> -- backend frontend
  deploy .github` is empty.
- **AC-6.3** `backend/src/app/health.py`, `backend/src/app/main.py`, and
  `backend/src/app/config.py` are byte-identical to the baseline.
- **AC-6.4** No dependency or environment file changes: `backend/pyproject.toml`,
  `backend/uv.lock`, `frontend/package.json`, and `frontend/package-lock.json`
  are byte-identical to the baseline.

### R7 — Existing gates stay green

- **AC-7.1** `cd backend && uv run pytest` exits 0 with
  `APP_TEST_DATABASE_URL` unset (unit tests pass; integration tests skip).
- **AC-7.2** `cd backend && uv run ruff check .` and
  `uv run ruff format --check .` exit 0.
- **AC-7.3** `cd frontend && npm run test` exits 0 (the frontend is untouched by
  this change; the check guards against accidental edits).

## Scenarios

Scenarios are the concrete checks that decide the criteria; each maps back
through the traceability table.

- **SCN-1 — API section is discoverable.**
  Given the post-change `README.md`;
  When its level-2 headings are listed;
  Then a top-level `## API` section exists with a non-empty body and each of
  `` `GET /` `` and `` `GET /api/healthz` `` begins its own entry.
  Covers AC-1.1, AC-1.2, AC-1.3.

- **SCN-2 — Endpoint inventory matches the application.**
  Given the `## API` section and an app built by
  `create_app(Settings(database_url=...))`;
  When the documented endpoints are compared with
  `openapi()["paths"]`;
  Then both are exactly `GET /` and `GET /api/healthz`, nothing else is
  documented, and no other README statement contradicts the section.
  Covers AC-2.1, AC-2.2, AC-2.3, AC-2.4.

- **SCN-3 — Liveness entry is complete and accurate.**
  Given the `GET /` entry, the `index()` handler, and
  `test_root_reports_app_metadata_without_the_database`;
  When the entry is read and compared;
  Then it states liveness, no database access, an application name and version
  payload, and the single response code `200`.
  Covers AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-5.1, AC-5.3, AC-5.4.

- **SCN-4 — Readiness entry is complete and accurate.**
  Given the `GET /api/healthz` entry, the `healthz()` handler, and the two
  healthz unit tests;
  When the entry is read and compared;
  Then it states readiness, a PostgreSQL ping, `200` when the database answers
  and `503` while it is down, with no other documented status code.
  Covers AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-4.5, AC-5.2, AC-5.3, AC-5.4.

- **SCN-5 — Docs-only scope.**
  Given the change diff against the baseline;
  When the changed paths are inspected;
  Then only `README.md` (plus `.factory/**` metadata) differs, and no
  production, test, deploy, CI, or dependency file changed.
  Covers AC-6.1, AC-6.2, AC-6.3, AC-6.4.

- **SCN-6 — Existing gates green.**
  Given the change is applied and no code changed;
  When the backend and frontend gates run;
  Then ruff, backend pytest, and frontend tests all exit 0.
  Covers AC-7.1, AC-7.2, AC-7.3.

## Traceability

| Criterion | Scenario(s) | Verification |
|---|---|---|
| AC-1.1 | SCN-1 | Read `README.md`; match `^## API[ \t]*$`. |
| AC-1.2 | SCN-1 | Section body non-empty; bounded by the next `## ` heading; not inside a fence. |
| AC-1.3 | SCN-1 | Locate each token as the first token of a distinct table row / list item / heading. |
| AC-2.1 | SCN-2 | Enumerate endpoint tokens in the section; compare to the two allowed tokens. |
| AC-2.2 | SCN-2 | Run the OpenAPI-path command; get `['/', '/api/healthz']` with `GET` only. |
| AC-2.3 | SCN-2 | Search the section for `/docs`, `/openapi.json`, `/redoc` as endpoints; none. |
| AC-2.4 | SCN-2 | Read the retained endpoint sentence (`README.md:36-37`) and the section; no contradiction. |
| AC-3.1 | SCN-3 | `GET /` entry contains `liveness` (case-insensitive). |
| AC-3.2 | SCN-3 | `GET /` entry contains one of the four "no database" phrases. |
| AC-3.3 | SCN-3 | `GET /` entry contains `name` and `version`. |
| AC-3.4 | SCN-3 | `GET /` entry contains `200` and no other three-digit status. |
| AC-4.1 | SCN-4 | `GET /api/healthz` entry contains `readiness`. |
| AC-4.2 | SCN-4 | `GET /api/healthz` entry contains `PostgreSQL`. |
| AC-4.3 | SCN-4 | `GET /api/healthz` entry contains `200` and `503`. |
| AC-4.4 | SCN-4 | `GET /api/healthz` entry pairs `503` with `down`/`unreachable`/`unavailable`. |
| AC-4.5 | SCN-4 | `GET /api/healthz` entry contains no three-digit status other than `200`/`503`. |
| AC-5.1 | SCN-3 | Compare with `test_root_reports_app_metadata_without_the_database`. |
| AC-5.2 | SCN-4 | Compare with `test_healthz_reports_ok_without_a_real_database` and `test_healthz_returns_503_when_the_database_fails`. |
| AC-5.3 | SCN-3, SCN-4 | Inspect `index()`/`healthz()` in `backend/src/app/health.py`. |
| AC-5.4 | SCN-3, SCN-4 | If bodies are documented, compare them with the tests' asserted bodies. |
| AC-6.1 | SCN-5 | `git diff --name-only <baseline>..<head>`; only `README.md` outside `.factory/**`. |
| AC-6.2 | SCN-5 | `git diff --name-only <baseline>..<head> -- backend frontend deploy .github` empty. |
| AC-6.3 | SCN-5 | `git diff -- backend/src/app/{health,main,config}.py` empty. |
| AC-6.4 | SCN-5 | `git diff -- backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json` empty. |
| AC-7.1 | SCN-6 | `cd backend && uv run pytest` (DSN unset) exits 0. |
| AC-7.2 | SCN-6 | `cd backend && uv run ruff check . && uv run ruff format --check .` exits 0. |
| AC-7.3 | SCN-6 | `cd frontend && npm run test` exits 0. |

Reverse mapping (every scenario is covered by at least one criterion):

| Scenario | Criteria |
|---|---|
| SCN-1 | AC-1.1, AC-1.2, AC-1.3 |
| SCN-2 | AC-2.1, AC-2.2, AC-2.3, AC-2.4 |
| SCN-3 | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-5.1, AC-5.3, AC-5.4 |
| SCN-4 | AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-4.5, AC-5.2, AC-5.3, AC-5.4 |
| SCN-5 | AC-6.1, AC-6.2, AC-6.3, AC-6.4 |
| SCN-6 | AC-7.1, AC-7.2, AC-7.3 |

Every criterion in the table above appears in the reverse mapping, and every
scenario in the reverse mapping appears in the forward table.

## Verification commands

```sh
# AC-1.1..AC-1.3 — section exists and has two endpoint entries
grep -nE '^## API[ \t]*$' README.md
grep -n '`GET /`' README.md
grep -n '`GET /api/healthz`' README.md

# AC-2.2 — documented set must equal the app's product routes
cd backend && uv run python -c \
  "from app.config import Settings; from app.main import create_app; \
   print(sorted(create_app(Settings(database_url='postgresql+psycopg://stub:stub@localhost:5432/stub')).openapi()['paths']))"
# expected: ['/', '/api/healthz']

# AC-6.* — docs-only scope
git diff --name-only <baseline>..<head>
git diff --name-only <baseline>..<head> -- backend frontend deploy .github

# AC-7.* — existing gates stay green
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run test
```

## Definition of done

The change is done when:

1. `README.md` contains a top-level `## API` section that documents exactly
   `GET /` and `GET /api/healthz`, each with its purpose and response codes per
   R3/R4, and the documented contract agrees with the implementation and the
   existing tests (R5).
2. The change diff is documentation-only: `README.md` is the only non-
   `.factory/**` path changed, and no backend/frontend/deploy/CI/dependency file
   differs (R6).
3. The existing gates are green: backend ruff (check + format) and pytest exit
   0, and the frontend test command exits 0 (R7).
4. Every acceptance criterion in this document has a passing result from its
   mapped scenario in the traceability table.

## Appendix A — Non-normative example

The following illustrates a section that satisfies R1–R5; the exact wording is
not part of the contract.

```markdown
## API

The backend exposes two endpoints. Both are unauthenticated and return JSON.

| Endpoint | Purpose | Payload | Response codes |
|---|---|---|---|
| `GET /` | Liveness probe; reports process metadata and never touches the database. | `{"app": <name>, "version": <version>}` | `200` |
| `GET /api/healthz` | Readiness probe; pings PostgreSQL. | `{"status": "ok", "database": "ok"}` | `200` when PostgreSQL answers; `503` while it is down (`{"detail": "database unavailable"}`) |
```
