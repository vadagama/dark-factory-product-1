# Specification: Document the database session lifecycle in `backend/src/app/db.py`

| Field | Value |
|---|---|
| Change | Document the database session lifecycle in `backend/src/app/db.py` |
| Stage | specification |
| Attempt | 1 |
| Kind | Documentation-only (docstrings) |
| Artifact path | `specs/db-session-lifecycle.md` |
| Primary file under change | `backend/src/app/db.py` |
| Related files (read-only evidence) | `backend/src/app/main.py`, `backend/src/app/health.py`, `backend/src/app/config.py` |

## 1. Problem

`backend/src/app/db.py` owns the three pieces that define how the product talks
to PostgreSQL, but the module does not document how they compose into a
lifecycle. A reader must reconstruct the flow by cross-reading three files:

1. `db.create_engine` reads `Settings.database_url` and calls
   `create_async_engine(..., pool_pre_ping=True)` (`db.py:23-25`).
2. `db.create_sessionmaker` wraps that engine in an
   `async_sessionmaker(..., expire_on_commit=False)` (`db.py:28-29`) — **and has
   no docstring at all**.
3. `main.create_app` creates one engine per application instance
   (`main.py:26`), stores the sessionmaker on `app.state.sessionmaker`
   (`main.py:34`), and disposes the engine in the lifespan shutdown
   (`main.py:31`); `create_app` spans `main.py:21-36`.
4. `health.get_session` reads `request.app.state.sessionmaker` (`health.py:34`)
   and yields one session per request via `async with sessionmaker() as session`
   (`health.py:32-36`).

Consequences of the missing documentation:

* The only un-documented function in the module is exactly the one whose
  contract is least obvious (`create_sessionmaker`, including *why*
  `expire_on_commit=False` and *where* the resulting factory is stored).
* The module docstring mentions the per-application-instance engine but does
  not state where the sessionmaker lives (`app.state.sessionmaker`) or who
  yields sessions (`get_session`), so the request-scoped session lifetime is
  invisible from `db.py`.

This change adds and completes documentation only. It must not alter behaviour.

## 2. Scope

### 2.1 In scope

* The module docstring of `backend/src/app/db.py`, extended to describe the full
  lifecycle: engine → sessionmaker → app state → per-request session → engine
  disposal.
* The docstring of `create_sessionmaker` (currently absent).
* The docstrings of `create_engine` and `Base` (extended only as needed to keep
  every lifecycle statement accurate and complete).
* This specification artifact.

### 2.2 Out of scope

* Any change to runtime behaviour, control flow, signatures, annotations,
  type hints, imports, module-level definitions, or return expressions in
  `db.py`.
* Changes to `app/health.py`, `app/main.py`, `app/config.py` — including
  moving `get_session` into `db.py`, which is explicitly **not** done here.
* Renaming `create_engine` / `create_sessionmaker` / `Base`, or adding new
  helpers, aliases, or module-level singletons.
* New or modified tests (the change is documentation-only; the existing suite
  must keep passing unchanged).
* Documenting `migrations/env.py`, `app/models`, or connection-pool tuning
  decisions.
* Enabling new lint rules (for example ruff `D`/pydocstyle) or adding a
  documentation CI gate.
* Editing `README.md` or any other prose outside this spec.

## 3. Requirements and acceptance criteria

Notation used by every criterion below: for a docstring `d`, `N(d)` is
`" ".join(d.split()).lower()` — whitespace-normalised, lower-cased text. A
criterion of the form "`N(d)` contains `x`" is checked as
`"x" in N(d)` (case-insensitive literal substring).

`BASE_REV` is the change's merge-base with `main`.

### R1 — The module docstring documents the lifecycle end to end

| ID | Acceptance criterion |
|---|---|
| AC-1.1 | `backend/src/app/db.py` has a module docstring: `ast.get_docstring(module)` is not `None` and is non-empty after `.strip()`. |
| AC-1.2 | The module docstring names both the engine factory and its settings source: `N(D_mod)` contains `create_engine` and `database_url`. |
| AC-1.3 | The module docstring names the sessionmaker factory and its storage location: `N(D_mod)` contains `create_sessionmaker` and `app.state.sessionmaker`. |
| AC-1.4 | The module docstring names the per-request consumer and the session lifetime: `N(D_mod)` contains `get_session` and `per request`. |
| AC-1.5 | The module docstring states engine teardown: `N(D_mod)` contains `dispose`. |
| AC-1.6 | The module docstring states the per-application-instance scope: `N(D_mod)` contains `per application instance` **or** `isolated`. |

### R2 — The `create_engine` docstring is accurate about its inputs and options

| ID | Acceptance criterion |
|---|---|
| AC-2.1 | `create_engine` has a non-empty docstring (`inspect.getdoc(create_engine)` is a non-empty string). |
| AC-2.2 | `N(D_engine)` contains `database_url` (the URL comes from `Settings.database_url`). |
| AC-2.3 | `N(D_engine)` contains `pool_pre_ping` (the option is set to `True` at `db.py:25`). |
| AC-2.4 | `N(D_engine)` contains `create_app` (the engine is created once per application instance, `main.py:26`). |

### R3 — The `create_sessionmaker` docstring closes the documentation gap

| ID | Acceptance criterion |
|---|---|
| AC-3.1 | `create_sessionmaker` has a non-empty docstring (currently absent — `db.py:28-29`). |
| AC-3.2 | `N(D_sm)` contains `async_sessionmaker` (the returned factory type). |
| AC-3.3 | `N(D_sm)` contains `expire_on_commit` and `false` (the `expire_on_commit=False` argument is documented). |
| AC-3.4 | `N(D_sm)` contains `async with` **or** `context manager` (sessions are obtained as `async with sessionmaker() as session`, `health.py:35`). |

### R4 — The `Base` docstring is preserved

| ID | Acceptance criterion |
|---|---|
| AC-4.1 | `Base` still has a non-empty docstring (`inspect.getdoc(Base)`), i.e. the existing docstring at `db.py:20` is not removed. |

### R5 — The change is documentation-only (no behaviour change)

| ID | Acceptance criterion |
|---|---|
| AC-5.1 | The set of module-level definitions in `db.py` is exactly `{Base, create_engine, create_sessionmaker}` — no additions, removals, or renames. |
| AC-5.2 | The set of imported names in `db.py` is unchanged versus `BASE_REV:backend/src/app/db.py`. |
| AC-5.3 | Behaviour equivalence: `ast.dump` of `db.py` with docstrings stripped equals `ast.dump` of `BASE_REV:backend/src/app/db.py` with docstrings stripped (Scenario S4). |
| AC-5.4 | The `return` expression source text of `create_engine` and of `create_sessionmaker` is byte-identical to `BASE_REV`. |
| AC-5.5 | The sorted set of paths changed versus `BASE_REV` is exactly `[backend/src/app/db.py, specs/db-session-lifecycle.md]`. |
| AC-5.6 | `app/health.py`, `app/main.py`, and `app/config.py` are identical to `BASE_REV` (`git diff BASE_REV...HEAD -- <path>` produces no output for each). |

### R6 — Documented identifiers resolve to real code and no false claim is introduced

| ID | Acceptance criterion |
|---|---|
| AC-6.1 | Every project identifier used in the docstrings resolves by grep with exit code 0: `create_engine` and `create_sessionmaker` in `backend/src/app/db.py`; `app.state.sessionmaker` in `backend/src/app/main.py`; `get_session` in `backend/src/app/health.py`; `database_url` in `backend/src/app/config.py`; `pool_pre_ping` and `expire_on_commit` in `backend/src/app/db.py`. |
| AC-6.2 | No forbidden literal appears anywhere in the docstrings of `db.py`: `at import time`, `shared across requests`, `module-level engine`, `module-level sessionmaker`. |
| AC-6.3 | `pool_pre_ping` is documented as enabled and `expire_on_commit` as disabled: the docstring containing `pool_pre_ping` also contains `true`, and the docstring containing `expire_on_commit` also contains `false` (case-insensitive). |

### R7 — Existing gates stay green with the new text

| ID | Acceptance criterion |
|---|---|
| AC-7.1 | `uv run ruff check .` (run in `backend/`) exits 0. |
| AC-7.2 | `uv run ruff format --check .` (run in `backend/`) exits 0. |
| AC-7.3 | `uv run mypy` (run in `backend/`) exits 0. |
| AC-7.4 | `uv run pytest` (run in `backend/`) exits 0 with the pre-existing test set. |
| AC-7.5 | No line of `backend/src/app/db.py` exceeds 100 characters (`tool.ruff.line-length = 100`). |

## 4. Scenarios

Each scenario is the executable or mechanical check that decides the criteria
mapped to it in Section 5.

* **S1 — Module docstring tokens.** Read the module docstring with
  `python -c "import app.db, inspect; print(inspect.getdoc(app.db) or '')"`
  (from `backend/`, `PYTHONPATH=src`) and assert the token sets of
  AC-1.1…AC-1.6 against `N(D_mod)`.
* **S2 — Function docstring tokens.** Load `app.db` with `inspect`, take
  `getdoc(create_engine)`, `getdoc(create_sessionmaker)`, `getdoc(Base)` and
  assert non-emptiness plus the token sets of AC-2.1…AC-2.4, AC-3.1…AC-3.4,
  AC-4.1.
* **S3 — Definition and import inventory.** `ast.parse` of `db.py`; assert the
  module-level definition names equal `{Base, create_engine, create_sessionmaker}`
  (AC-5.1) and the imported dotted names equal those of
  `BASE_REV:backend/src/app/db.py` (AC-5.2).
* **S4 — Behaviour-equivalence dump.** The snippet below asserts AC-5.3 and
  AC-5.4 (run from the repository root, with `BASE_REV` set to the merge-base):

  ```python
  import ast, subprocess
  base = subprocess.check_output(["git", "show", f"{BASE_REV}:backend/src/app/db.py"], text=True)
  new = open("backend/src/app/db.py").read()

  def strip_docstrings(src: str) -> str:
      tree = ast.parse(src)
      for node in ast.walk(tree):
          if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
              first = node.body[0] if node.body else None
              if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                  node.body = node.body[1:] or [ast.Pass()]
      return ast.dump(ast.fix_missing_locations(tree))

  assert strip_docstrings(base) == strip_docstrings(new), "behaviour changed"

  def returns(src: str) -> list[str]:
      tree = ast.parse(src)
      return [ast.unparse(n.value) for n in ast.walk(tree)
              if isinstance(n, ast.Return) and n.value is not None]

  assert returns(base) == returns(new), "return expressions changed"
  print("S4 OK: behaviour-neutral")
  ```

* **S5 — Change footprint.** From the repository root:
  `git diff --name-only BASE_REV...HEAD | sort` must be exactly
  `backend/src/app/db.py` and `specs/db-session-lifecycle.md` (AC-5.5); the
  three `git diff BASE_REV...HEAD -- <path>` invocations for `health.py`,
  `main.py`, `config.py` must each print nothing (AC-5.6).
* **S6 — Identifier resolution and forbidden literals.** One `grep -n` per
  identifier listed in AC-6.1 must exit 0 in the named file; the four literals
  of AC-6.2 must yield no match inside the `db.py` docstrings; AC-6.3 is checked
  with the same normalised-token helper as S1/S2.
* **S7 — Gates.** The four commands of AC-7.1…AC-7.4 in `backend/`, plus the
  100-character line scan of AC-7.5 over `backend/src/app/db.py`.
* **S8 — Accuracy review.** A reviewer reads the `db.py` docstrings against the
  four cited code facts (`db.py:23-25`, `db.py:28-29`, `main.py:21-36`,
  `health.py:32-36`) and confirms each documented lifecycle step is present in
  the code. This is the human backstop for AC-6.1/AC-6.3; it never overrides a
  failing mechanical check in S1–S7.

## 5. Traceability: criteria → scenarios

| Requirement | Acceptance criterion | Scenario(s) |
|---|---|---|
| R1 | AC-1.1 | S1 |
| R1 | AC-1.2 | S1 |
| R1 | AC-1.3 | S1 |
| R1 | AC-1.4 | S1 |
| R1 | AC-1.5 | S1 |
| R1 | AC-1.6 | S1 |
| R2 | AC-2.1 | S2 |
| R2 | AC-2.2 | S2 |
| R2 | AC-2.3 | S2 |
| R2 | AC-2.4 | S2 |
| R3 | AC-3.1 | S2 |
| R3 | AC-3.2 | S2 |
| R3 | AC-3.3 | S2 |
| R3 | AC-3.4 | S2 |
| R4 | AC-4.1 | S2 |
| R5 | AC-5.1 | S3 |
| R5 | AC-5.2 | S3 |
| R5 | AC-5.3 | S4 |
| R5 | AC-5.4 | S4 |
| R5 | AC-5.5 | S5 |
| R5 | AC-5.6 | S5 |
| R6 | AC-6.1 | S6, S8 |
| R6 | AC-6.2 | S6 |
| R6 | AC-6.3 | S6, S8 |
| R7 | AC-7.1 | S7 |
| R7 | AC-7.2 | S7 |
| R7 | AC-7.3 | S7 |
| R7 | AC-7.4 | S7 |
| R7 | AC-7.5 | S7 |

## 6. Assumptions and constraints

* Python 3.12 and the pinned `uv.lock` toolchain (`ruff`, `mypy`, `pytest`) as
  configured in `backend/pyproject.toml`; no new dependency is introduced.
* Ruff's selected rule set excludes pydocstyle (`D`), so this specification —
  not lint — is the authority for docstring presence and content.
* The engine is intentionally per application instance for test isolation
  (`main.py:26` creates it inside `create_app`; `main.py:34` stores the
  sessionmaker on the app state; `test_health.py:34-38` overrides the
  dependency instead of touching a global); the documentation must describe
  that design, not propose changing it.
* `get_session` stays in `app/health.py`; `db.py` only references it by name in
  prose.
* Supporting files carry no change: if S5 fails, the change is out of scope by
  definition, not the specification.
