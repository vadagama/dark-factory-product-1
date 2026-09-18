# Change request (planning): Document the database session lifecycle in `backend/src/app/db.py`

| Field | Value |
|---|---|
| Change | Document the database session lifecycle in `backend/src/app/db.py` |
| Stage | planning |
| Attempt | 1 |
| Kind | Documentation-only (docstrings); no behaviour change |
| Primary file under change | `backend/src/app/db.py` |
| Related files (read-only evidence) | `backend/src/app/main.py`, `backend/src/app/health.py`, `backend/src/app/config.py` |
| Refined requirements | `specs/db-session-lifecycle.md` (Section 3, R1–R7 / AC-1.1–AC-7.5) |
| Review status | Ready for implementation once the AC-5.5 footprint note in §7 is resolved |

This document is self-contained: a reviewer needs only this file and the
repository, not the originating task thread.

## 1. Summary

Add complete docstrings to `backend/src/app/db.py` so the module explains, on
its own, how the three pieces it owns compose into a database session lifecycle:

1. `create_engine(settings)` builds one async engine from
   `Settings.database_url` (`create_async_engine(..., pool_pre_ping=True)`).
2. `create_sessionmaker(engine)` wraps that engine in an
   `async_sessionmaker(..., expire_on_commit=False)`.
3. `create_app` (in `app/main.py`) creates the engine per application instance,
   stores the sessionmaker on `app.state.sessionmaker`, and disposes the engine
   on lifespan shutdown; `health.get_session` reads that sessionmaker and yields
   one session per request.

The change adds/extends a module docstring plus docstrings for
`create_engine`, `create_sessionmaker` (currently absent), and preserves the
`Base` docstring. It alters no executable code.

## 2. Motivation

`backend/src/app/db.py` defines how the product talks to PostgreSQL, but a
reader currently has to cross-read three files to reconstruct the lifecycle:

* `create_sessionmaker` (`db.py:28-29`) has **no docstring at all** — the
  function with the least obvious contract (why `expire_on_commit=False`, where
  the returned factory is stored) is the only undocumented one.
* The existing module docstring mentions the per-application-instance engine but
  never states where the sessionmaker lives (`app.state.sessionmaker`) or who
  yields sessions (`get_session`), so the request-scoped session lifetime is
  invisible from `db.py`.
* `create_engine` does not record its inputs (`Settings.database_url`) or the
  deliberate `pool_pre_ping=True` choice.

The goal is to make `db.py` self-explanatory for a maintainer or on-call
engineer, with the documentation pinned to the real code by mechanical checks.

## 3. Scope

### 3.1 In scope

* Module docstring of `backend/src/app/db.py`, extended to describe the full
  lifecycle: engine → sessionmaker → app state → per-request session → engine
  disposal.
* Docstring of `create_sessionmaker` (currently absent).
* Docstrings of `create_engine` and `Base` (extended only as needed to keep
  every lifecycle statement accurate and complete).
* Coherence edits to `specs/db-session-lifecycle.md` required by this planning
  stage (see §7).

### 3.2 Out of scope

* Any change to runtime behaviour, control flow, signatures, annotations, type
  hints, imports, module-level definitions, or return expressions in `db.py`.
* Changes to `app/health.py`, `app/main.py`, `app/config.py` — including moving
  `get_session` into `db.py`, which is explicitly **not** done.
* Renaming `create_engine` / `create_sessionmaker` / `Base`, or adding helpers,
  aliases, or module-level singletons.
* New or modified tests (the existing suite must pass unchanged).
* Documenting `migrations/env.py`, `app/models`, or connection-pool tuning.
* Enabling ruff `D`/pydocstyle or adding a documentation CI gate.
* Editing `README.md` or other prose.

## 4. Refined requirements and acceptance criteria

Reproduced from `specs/db-session-lifecycle.md` §3. `N(d)` = `" ".join(d.split()).lower()`;
"`N(d)` contains `x`" means `"x" in N(d)` (case-insensitive literal substring).
`BASE_REV` is the change's merge-base with `main`.

### R1 — Module docstring documents the lifecycle end to end

| ID | Acceptance criterion |
|---|---|
| AC-1.1 | `db.py` has a non-empty module docstring. |
| AC-1.2 | `N(D_mod)` contains `create_engine` and `database_url`. |
| AC-1.3 | `N(D_mod)` contains `create_sessionmaker` and `app.state.sessionmaker`. |
| AC-1.4 | `N(D_mod)` contains `get_session` and `per request`. |
| AC-1.5 | `N(D_mod)` contains `dispose`. |
| AC-1.6 | `N(D_mod)` contains `per application instance` **or** `isolated`. |

### R2 — `create_engine` docstring accurate about inputs and options

| ID | Acceptance criterion |
|---|---|
| AC-2.1 | `create_engine` has a non-empty docstring. |
| AC-2.2 | `N(D_engine)` contains `database_url`. |
| AC-2.3 | `N(D_engine)` contains `pool_pre_ping`. |
| AC-2.4 | `N(D_engine)` contains `create_app`. |

### R3 — `create_sessionmaker` docstring closes the documentation gap

| ID | Acceptance criterion |
|---|---|
| AC-3.1 | `create_sessionmaker` has a non-empty docstring (currently absent). |
| AC-3.2 | `N(D_sm)` contains `async_sessionmaker`. |
| AC-3.3 | `N(D_sm)` contains `expire_on_commit` and `false`. |
| AC-3.4 | `N(D_sm)` contains `async with` **or** `context manager`. |

### R4 — `Base` docstring preserved

| ID | Acceptance criterion |
|---|---|
| AC-4.1 | `Base` still has a non-empty docstring (existing `db.py:20` not removed). |

### R5 — Change is documentation-only (no behaviour change)

| ID | Acceptance criterion |
|---|---|
| AC-5.1 | Module-level definitions in `db.py` are exactly `{Base, create_engine, create_sessionmaker}`. |
| AC-5.2 | Imported names in `db.py` unchanged vs `BASE_REV`. |
| AC-5.3 | `ast.dump` of docstring-stripped `db.py` equals docstring-stripped `BASE_REV` version. |
| AC-5.4 | `return` expression source of `create_engine` / `create_sessionmaker` byte-identical to `BASE_REV`. |
| AC-5.5 | Sorted changed-path set vs `BASE_REV` is exactly `[backend/src/app/db.py, specs/db-session-lifecycle.md]`. **See §7 conflict.** |
| AC-5.6 | `app/health.py`, `app/main.py`, `app/config.py` identical to `BASE_REV`. |

### R6 — Documented identifiers resolve and no false claim introduced

| ID | Acceptance criterion |
|---|---|
| AC-6.1 | Each docstring identifier greps with exit 0: `create_engine`/`create_sessionmaker` in `db.py`; `app.state.sessionmaker` in `main.py`; `get_session` in `health.py`; `database_url` in `config.py`; `pool_pre_ping`/`expire_on_commit` in `db.py`. |
| AC-6.2 | No forbidden literal in `db.py` docstrings: `at import time`, `shared across requests`, `module-level engine`, `module-level sessionmaker`. |
| AC-6.3 | Docstring containing `pool_pre_ping` also contains `true`; docstring containing `expire_on_commit` also contains `false` (case-insensitive). |

### R7 — Existing gates stay green

| ID | Acceptance criterion |
|---|---|
| AC-7.1 | `uv run ruff check .` (in `backend/`) exits 0. |
| AC-7.2 | `uv run ruff format --check .` (in `backend/`) exits 0. |
| AC-7.3 | `uv run mypy` (in `backend/`) exits 0. |
| AC-7.4 | `uv run pytest` (in `backend/`) exits 0 with the pre-existing test set. |
| AC-7.5 | No line of `db.py` exceeds 100 characters (`tool.ruff.line-length = 100`). |

### Verification scenarios (from spec §4)

* **S1** module-docstring token check; **S2** function-docstring token check;
  **S3** definition/import inventory; **S4** behaviour-equivalence AST dump;
  **S5** change-footprint diff; **S6** identifier resolution + forbidden
  literals; **S7** gates; **S8** human accuracy review.

Traceability (criteria → scenarios) is maintained in `specs/db-session-lifecycle.md` §5.

## 5. Ordered task list

Dependencies are explicit; a task may start only when all listed predecessors
are complete. Tasks T2–T5 may be executed as one edit pass but are tracked
separately because they satisfy distinct requirements.

| # | Task | Depends on | Satisfies |
|---|---|---|---|
| T1 | **Freeze the baseline.** Record `BASE_REV` (`git merge-base HEAD main`); capture `BASE_REV:backend/src/app/db.py`; confirm current `health.py`/`main.py`/`config.py` match the code facts cited in §2; run the four gates once to record a green baseline. | — | AC-5.6 (baseline), pre-condition for S3/S4/S5 |
| T2 | **Rewrite the module docstring** in `db.py`: engine → sessionmaker → `app.state.sessionmaker` → `get_session` per request → engine `dispose`; keep the per-application-instance/`isolated` rationale. | T1 | AC-1.1–AC-1.6 |
| T3 | **Extend the `create_engine` docstring**: `Settings.database_url`, `pool_pre_ping=True`, created via `create_app`. | T2 | AC-2.1–AC-2.4 |
| T4 | **Add the `create_sessionmaker` docstring**: returns an `async_sessionmaker`, `expire_on_commit=False`, sessions obtained via `async with` (context manager). | T2 | AC-3.1–AC-3.4 |
| T5 | **Confirm the `Base` docstring** is present and non-empty (edit only if needed for accuracy). | T2 | AC-4.1 |
| T6 | **Docstring and inventory mechanical checks** (S1, S2, S3, S6): module/function tokens, definition set `{Base, create_engine, create_sessionmaker}`, unchanged imports, identifier greps, forbidden-literal scan. | T3, T4, T5 | AC-1.x, AC-2.x, AC-3.x, AC-4.1, AC-5.1, AC-5.2, AC-6.1–AC-6.3 |
| T7 | **Behaviour-equivalence and footprint checks** (S4, S5): docstring-stripped AST equality, byte-identical `return` expressions, changed-path set, unchanged supporting files. | T6 | AC-5.3–AC-5.6 |
| T8 | **Run all gates** (S7): ruff check, ruff format check, mypy, pytest, 100-char line scan — all in `backend/`. | T6 | AC-7.1–AC-7.5 |
| T9 | **Accuracy review** (S8) + resolve §7 footprint decision: does a human confirm every documented lifecycle step exists in code, and is the changed-path allowlist updated or the planning artifact excluded? | T7, T8 | AC-6.1, AC-6.3 (human backstop); S5/AC-5.5 resolution |
| T10 | **Package for review**: attach diff, gate output, S1–S8 evidence, and the AC-to-evidence map; request sign-off to move to construction. | T9 | Reviewable change request |

Critical path: **T1 → T2 → T4 → T6 → T7 → T9 → T10** (T3/T5 in parallel;
T8 parallel with T7 after T6).

## 6. Constraints and assumptions

* Python 3.12 and the pinned `uv.lock` toolchain; no new dependency.
* Ruff excludes pydocstyle (`D`), so the spec — not lint — is the authority for
  docstring presence/content.
* The per-application-instance engine is intentional for test isolation
  (`main.py:26`, `main.py:34`; `test_health.py:34-38` overrides the
  dependency). Documentation must describe that design, not change it.
* `get_session` stays in `app/health.py`; `db.py` references it only by name.
* App code imports cleanly without `DATABASE_URL`; no runtime environment is
  needed for the documentation checks in S1–S3/S6.

## 7. Risks, conflicts, and open decisions

1. **AC-5.5 vs. this planning artifact (must resolve before construction).**
   AC-5.5 pins the changed-path set to exactly
   `[backend/src/app/db.py, specs/db-session-lifecycle.md]`. This change-request
   artifact is an additional path. If it is committed to the tracked tree, S5
   fails as literally written. Recommended resolution: amend AC-5.5 to add
   `specs/db-session-lifecycle-change-request.md` to the allowlist (or, if the
   planning artifact lives outside the implemented change, state that the
   footprint is measured over production paths only). Owner: spec author, at T1.
2. **Token-based criteria can be satisfied by coincidence.** AC set uses literal
   substring checks, so token presence does not prove prose correctness; S8
   (human review) is the backstop and is a required task (T9), not optional.
3. **Forbidden literals (AC-6.2) are easy to trip** when describing why the
   engine is *not* module-level. Draft wording must avoid `module-level engine`,
   `module-level sessionmaker`, `at import time`, `shared across requests`.
4. **Line-length (AC-7.5).** Long identifier strings (`app.state.sessionmaker`,
   `async_sessionmaker`) can push lines past 100 chars; wrap docstrings in T2–T4.

## 8. Definition of done

* `db.py` module, `create_engine`, `create_sessionmaker`, and `Base` docstrings
  meet R1–R4.
* No behaviour change: R5 checks (S3–S5) pass.
* Every documented identifier resolves and no false claim is present: R6 / S6
  plus human S8 sign-off.
* `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, and
  `uv run pytest` all exit 0 in `backend/`, and no `db.py` line exceeds 100
  characters (R7).
* The §7 footprint decision is recorded and the affected AC updated.
