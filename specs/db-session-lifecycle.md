# Specification: Document the database session lifecycle in `backend/src/app/db.py`

| Field | Value |
|---|---|
| Change | Document the database session lifecycle in `backend/src/app/db.py` |
| Stage | specification |
| Attempt | 1 |
| Kind | Documentation-only (docstrings); no behaviour change |
| Artifact path | `specs/db-session-lifecycle.md` |
| Primary file under change | `backend/src/app/db.py` |
| Read-only evidence | `backend/src/app/main.py`, `backend/src/app/health.py`, `backend/src/app/config.py`, `backend/src/app/models.py`, `backend/tests/unit/test_health.py` |
| Baseline | `BASE_REV` = merge-base of this change with `main`. Every "currently"/"existing" claim below is relative to `BASE_REV`. |

This document is the contract for the change. Section 1 states the baseline
facts with the check that decides each one, Section 3 states the acceptance
criteria, and Section 5 maps every criterion to at least one scenario in
Section 4. A criterion that cannot be checked is a defect in this
specification.

## 1. Problem

`backend/src/app/db.py` owns the three pieces that define how the product talks
to PostgreSQL, but it does not document how they compose into a session
lifecycle. A reader must cross-read three modules to reconstruct the flow, and
one of the pieces is entirely undocumented.

### 1.1 Baseline facts

Line numbers are `BASE_REV`-relative and each row carries the quoted source text
that anchors it; the checks in Section 4 use the text, not the numbers, so line
drift does not invalidate them.

| ID | Claim | Anchor | Check |
|---|---|---|---|
| F1 | `create_engine(settings)` returns `create_async_engine(settings.database_url, pool_pre_ping=True)` | `db.py:23-25` | `grep -n "pool_pre_ping" backend/src/app/db.py` and `grep -n "database_url" backend/src/app/db.py` both match |
| F2 | `create_sessionmaker(engine)` returns `async_sessionmaker(engine, expire_on_commit=False)` and has **no docstring** | `db.py:28-29` | `ast.get_docstring` of the function at `BASE_REV` is `None` (S10) |
| F3 | `create_app` builds one engine per application instance, stores the sessionmaker on the app state, and disposes the engine on lifespan shutdown | `engine = create_engine(settings)` (`main.py:25`), `app.state.sessionmaker = create_sessionmaker(engine)` (`main.py:33`), `await engine.dispose()` (`main.py:30`); function spans `main.py:19-35` | `grep -n "engine = create_engine(settings)"`, `grep -n "app.state.sessionmaker = create_sessionmaker(engine)"`, `grep -n "engine.dispose()"` in `backend/src/app/main.py` all match |
| F4 | `get_session` is a FastAPI dependency that reads the sessionmaker from the app state and yields one session per request | `health.py:32-36`; `request.app.state.sessionmaker` (`health.py:34`); `async with sessionmaker() as session:` (`health.py:35`) | `grep -n "async def get_session"`, `grep -n "request.app.state.sessionmaker"`, `grep -n "async with sessionmaker() as session"` in `backend/src/app/health.py` all match |
| F5 | `Settings.database_url` is a required setting | `config.py:21` | `grep -n "database_url: str" backend/src/app/config.py` matches |
| F6 | The `BASE_REV` module docstring mentions the per-application-instance engine but not the sessionmaker's storage location, the per-request consumer, or engine teardown | `db.py:1-6` | `N(D_mod)` at `BASE_REV` lacks `app.state.sessionmaker`, `get_session`, `per request`, `dispose` (S10) |

### 1.2 Consequences of the missing documentation

1. The only module-level definition in `db.py` without a docstring is exactly
   the one whose contract is least obvious (`create_sessionmaker`: why
   `expire_on_commit=False`, and where the returned factory is stored) — F2.
2. The request-scoped session lifetime is invisible from `db.py`: the module
   docstring never names `app.state.sessionmaker` or `get_session` — F6.
3. Engine teardown is undiscoverable from `db.py`: `dispose` appears only in
   `main.py` — F3, F6.

## 2. Scope

### 2.1 In scope

1. The module docstring of `backend/src/app/db.py`, extended to describe the
   lifecycle end to end: engine → sessionmaker → app state → per-request
   session → engine disposal.
2. The docstring of `create_engine` (extended: settings source, `pool_pre_ping`,
   caller).
3. The docstring of `create_sessionmaker` (absent today — F2 — and therefore
   added).
4. The `Base` docstring (preserved unchanged; see AC-4.1).
5. This specification file.

### 2.2 Out of scope

1. Any change to runtime behaviour, control flow, signatures, annotations, type
   hints, imports, module-level definitions, statements, or return expressions
   in `db.py` (enforced by R5).
2. Changes to `app/health.py`, `app/main.py`, `app/config.py`, `app/models.py`,
   `migrations/**`, `backend/tests/**`, `frontend/**`, `deploy/**`, or
   `.github/**`.
3. Moving `get_session` out of `app/health.py` (for example into a new
   `app/deps.py`); `db.py` references it by name only. That refactor is a
   separate change (`specs/extract-shared-fastapi-dependencies.md`).
4. Renaming `create_engine` / `create_sessionmaker` / `Base`, or adding
   helpers, aliases, module-level singletons, or new public names.
5. New or modified tests; the existing suite must pass unchanged.
6. Enabling ruff `D` / pydocstyle, or adding a documentation lint/CI gate.
7. Documenting `migrations/env.py`, connection-pool tuning beyond the
   `pool_pre_ping` fact, or endpoints.
8. Editing `README.md`, `specs/db-session-lifecycle-change-request.md`, or any
   other prose.

### 2.3 Decisions fixed by this specification

- **Docstrings only.** The deliverable is prose attached to the module and to
  `create_engine`, `create_sessionmaker`, `Base`. No executable line changes.
- **Pinned identifier spellings.** The docstrings must use exactly
  `create_engine`, `create_sessionmaker`, `app.state.sessionmaker`,
  `Settings.database_url` / `database_url`, `pool_pre_ping`,
  `expire_on_commit`, `async_sessionmaker`, `create_app`, `get_session`,
  `dispose`, and `Base` where those concepts are named, so that the checks in
  Section 4 are decidable. Wording around the identifiers is free.
- **`get_session` stays in `app/health.py`.** `db.py` names it in prose only.
- **`Base` docstring text is not rewritten** (byte-for-byte equality, AC-4.1).
- **Baseline citations are anchored by quoted text, not line numbers.**

### 2.4 Assumptions (verified against the baseline tree)

- **A1** `backend/pyproject.toml` selects ruff rules `E, W, F, I, UP, B, C4,
  SIM, RUF` (no `D`), configures `line-length = 100`, and runs mypy with
  `files = ["src", "tests"]`, `strict = true`. Lint is therefore not the
  authority for docstring content; this specification is.
- **A2** `import app.db` needs neither `DATABASE_URL` nor a reachable database:
  `Settings` is only referenced, never instantiated, at module level.
- **A3** The per-application-instance engine is intentional (test isolation):
  `backend/tests/unit/test_health.py:34-38` overrides the `get_session`
  dependency, so no global engine is required.
- **A4** No other in-flight change modifies `db.py`. If the sibling change
  `specs/extract-shared-fastapi-dependencies.md` merges first, `get_session` is
  defined in `app/deps.py` instead of `app/health.py`; see Section 8, note 2.
- **A5** The four backend gates (R7) are green at `BASE_REV`; the change must
  keep them green.

## 3. Requirements and acceptance criteria

Notation used by every criterion. For a docstring `d`:

- `N(d) = " ".join(d.split()).lower()` — whitespace-normalised, lower-cased
  text. "`N(d)` contains `x`" means `x in N(d)` (case-insensitive literal
  substring).
- `idx(d, x)` is the index of the first occurrence of `x` in `N(d)`.
- `D_mod`, `D_engine`, `D_sm`, `D_base` are the docstrings of the module,
  `create_engine`, `create_sessionmaker`, and `Base` in `db.py`.

### R1 — The module docstring documents the lifecycle end to end

| ID | Acceptance criterion |
|---|---|
| AC-1.1 | `backend/src/app/db.py` has a module docstring: `ast.get_docstring(ast.parse(src))` is not `None` and is non-empty after `.strip()`. |
| AC-1.2 | `N(D_mod)` contains `create_engine` and `database_url`. |
| AC-1.3 | `N(D_mod)` contains `create_sessionmaker` and `app.state.sessionmaker`. |
| AC-1.4 | `N(D_mod)` contains `get_session` and (`per request` or `per-request`). |
| AC-1.5 | `N(D_mod)` contains `dispose`. |
| AC-1.6 | `N(D_mod)` contains `per application instance` or `isolated`. |
| AC-1.7 | `N(D_mod)` presents the chain in lifecycle order: `idx(D_mod, "create_engine") < idx(D_mod, "create_sessionmaker") < idx(D_mod, "app.state.sessionmaker")`. |

### R2 — The `create_engine` docstring states its inputs, options, and caller

| ID | Acceptance criterion |
|---|---|
| AC-2.1 | `create_engine` has a non-empty docstring (`inspect.getdoc(create_engine)`). |
| AC-2.2 | `N(D_engine)` contains `database_url` (the DSN comes from `Settings.database_url`, F1/F5). |
| AC-2.3 | `N(D_engine)` contains `pool_pre_ping` and `true` (the option is set to `True`, F1). |
| AC-2.4 | `N(D_engine)` contains `create_app` (the engine is built per application instance by `create_app`, F3). |

### R3 — The `create_sessionmaker` docstring closes the documentation gap

| ID | Acceptance criterion |
|---|---|
| AC-3.1 | `create_sessionmaker` has a non-empty docstring (`inspect.getdoc`), whereas at `BASE_REV` the same check is `None` (F2, S10). |
| AC-3.2 | `N(D_sm)` contains `async_sessionmaker` (the returned factory type). |
| AC-3.3 | `N(D_sm)` contains `expire_on_commit` and `false` (the `expire_on_commit=False` argument, F2). |
| AC-3.4 | `N(D_sm)` contains `async with` or `context manager` (sessions are obtained as `async with sessionmaker() as session`, F4). |

### R4 — The `Base` docstring is preserved

| ID | Acceptance criterion |
|---|---|
| AC-4.1 | `Base.__doc__` is non-empty and byte-identical to `Base.__doc__` at `BASE_REV:backend/src/app/db.py`. (Read the class attribute, not `inspect.getdoc`, which can inherit a docstring from `DeclarativeBase`.) |

### R5 — The change is documentation-only

| ID | Acceptance criterion |
|---|---|
| AC-5.1 | The top-level definition names of `db.py`, in file order, are exactly `["Base", "create_engine", "create_sessionmaker"]` — no addition, removal, rename, or reordering. |
| AC-5.2 | The import statements of `db.py` (module names, imported names, order) are identical to `BASE_REV`'s. |
| AC-5.3 | Behaviour equivalence: `ast.dump` of `db.py` with docstrings stripped equals `ast.dump` of `BASE_REV:backend/src/app/db.py` with docstrings stripped (S4). |
| AC-5.4 | The `return` expressions of `db.py`, in file order, are byte-identical (`ast.unparse`) to `BASE_REV`'s — exactly two, from the two factories (F1, F2). |
| AC-5.5 | The set of paths changed versus `BASE_REV` under `backend/` is exactly `{backend/src/app/db.py}`. |
| AC-5.6 | `git diff BASE_REV...HEAD -- backend/src/app/health.py backend/src/app/main.py backend/src/app/config.py` prints nothing (F3, F4, F5 anchors are untouched). |
| AC-5.7 | Every path changed versus `BASE_REV` is in the allowlist `{backend/src/app/db.py, specs/db-session-lifecycle.md, specs/db-session-lifecycle-change-request.md}` or starts with `.factory/`. |
| AC-5.8 | Outside docstrings, `db.py` is textually unchanged: the sorted list of non-blank lines that do not belong to a docstring span is identical to `BASE_REV`'s (no comment, blank-line-to-code, or unrelated text edit). |

### R6 — Documented identifiers resolve and no false claim is introduced

| ID | Acceptance criterion |
|---|---|
| AC-6.1 | Every identifier used in the `db.py` docstrings resolves in the repository, per this table: `create_engine`, `create_sessionmaker`, `pool_pre_ping`, `expire_on_commit`, `database_url` → grep match in `backend/src/app/db.py`; `database_url`, `Settings` → grep match in `backend/src/app/config.py`; `create_app`, `app.state.sessionmaker`, `engine.dispose`/`dispose` → grep match in `backend/src/app/main.py`; `get_session` → grep match in `backend/src/app/health.py` (or in `backend/src/app/deps.py` if that module defines it at `BASE_REV`, A4); `app.models` → the file `backend/src/app/models.py` exists. |
| AC-6.2 | No forbidden literal occurs in any `db.py` docstring (checked against `N(D_mod)`, `N(D_engine)`, `N(D_sm)`, `N(D_base)`): `at import time`, `shared across requests`, `module-level engine`, `module-level sessionmaker`, `global engine`. These are false-claim tripwires: the engine is created inside `create_app`, not at import, and is per application instance. |
| AC-6.3 | Option polarity is stated correctly: the docstring containing `pool_pre_ping` also contains `true`, and the docstring containing `expire_on_commit` also contains `false` (case-insensitive). |
| AC-6.4 | No `db.py` docstring contains a placeholder marker: `todo`, `tbd`, `fixme`, or `placeholder`. |

### R7 — Existing gates stay green with the new text

| ID | Acceptance criterion |
|---|---|
| AC-7.1 | `uv run ruff check .` (run in `backend/`) exits 0. |
| AC-7.2 | `uv run ruff format --check .` (run in `backend/`) exits 0. |
| AC-7.3 | `uv run mypy` (run in `backend/`) exits 0. |
| AC-7.4 | `uv run pytest` (run in `backend/`, with `APP_TEST_DATABASE_URL` unset) exits 0 with the pre-existing test set (integration tests skip, A3). |
| AC-7.5 | No line of `backend/src/app/db.py` exceeds 100 characters (`tool.ruff.line-length = 100`). |

### R8 — The module stays import-hermetic and the docstrings are introspectable

| ID | Acceptance criterion |
|---|---|
| AC-8.1 | With `DATABASE_URL` unset and no database reachable, `import app.db` succeeds and the module exposes no `AsyncEngine` instance (no engine is created at import time): the one-liner of S8 exits 0. |
| AC-8.2 | After `import app.db`, `inspect.getdoc` returns a non-empty string for the module, `create_engine`, and `create_sessionmaker` in a single run, exit 0 (the docstrings are attached to those objects, not stray string expressions). `Base` is decided by AC-4.1 through `Base.__doc__`. |

## 4. Scenarios

Each scenario is the executable or mechanical check that decides the criteria
mapped to it in Section 5. Run from the repository root unless stated; set
`BASE_REV` first (`BASE_REV=$(git merge-base HEAD main)`).

Shared helper used by S1, S2, S6, S10 (run in a `cd backend && PYTHONPATH=src
python` process):

```python
import ast
import inspect
import subprocess

import app.db as db

def N(doc):
    return " ".join((doc or "").split()).lower()
```

- **S1 — Module docstring tokens.** Load `app.db`, take
  `mod = inspect.getdoc(db)` and assert: non-empty and `.strip()` non-empty
  (AC-1.1); the tokens `create_engine`, `database_url`, `create_sessionmaker`,
  `app.state.sessionmaker`, `get_session`, `dispose` (AC-1.2, AC-1.3, AC-1.5);
  `per request` or `per-request` (AC-1.4); `per application instance` or
  `isolated` (AC-1.6); and `N(mod).index("create_engine") <
  N(mod).index("create_sessionmaker") < N(mod).index("app.state.sessionmaker")`
  (AC-1.7).

- **S2 — Function and class docstring tokens.** Same process asserts:
  `inspect.getdoc(db.create_engine)` non-empty plus `database_url`,
  `pool_pre_ping` and `true`, `create_app` (AC-2.1–AC-2.4);
  `inspect.getdoc(db.create_sessionmaker)` non-empty plus `async_sessionmaker`,
  `expire_on_commit` and `false`, and `async with` or `context manager`
  (AC-3.1–AC-3.4); and `inspect.getdoc` non-empty for the module,
  `create_engine`, and `create_sessionmaker` in one run (AC-8.2). `Base` is
  checked on `db.Base.__doc__` against the baseline (never `inspect.getdoc`,
  see AC-4.1):

  ```python
  base_rev = subprocess.check_output(
      ["git", "merge-base", "HEAD", "main"], text=True
  ).strip()
  base_src = subprocess.check_output(
      ["git", "show", f"{base_rev}:backend/src/app/db.py"], text=True
  )
  base_base_doc = next(
      node.body[0].value.value
      for node in ast.parse(base_src).body
      if isinstance(node, ast.ClassDef)
      and node.name == "Base"
      and isinstance(node.body[0], ast.Expr)
      and isinstance(node.body[0].value, ast.Constant)
      and isinstance(node.body[0].value.value, str)
  )
  assert db.Base.__doc__ and db.Base.__doc__ == base_base_doc   # AC-4.1
  ```

- **S3 — Definition and import inventory.** Parse `db.py` and
  `BASE_REV:backend/src/app/db.py`; assert the top-level definition names of the
  new file, in file order, are exactly
  `["Base", "create_engine", "create_sessionmaker"]` and equal to the baseline's
  (AC-5.1), and that
  `[ast.unparse(n) for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))]`
  is identical for both revisions (AC-5.2).

- **S4 — Behaviour-equivalence, return expressions, and non-docstring text.**
  Run from the repository root with the merge-base SHA as `argv[1]`:

  ```python
  import ast, pathlib, subprocess, sys

  base_rev = sys.argv[1]
  base = subprocess.check_output(
      ["git", "show", f"{base_rev}:backend/src/app/db.py"], text=True
  )
  new = pathlib.Path("backend/src/app/db.py").read_text(encoding="utf-8")

  doc_holders = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)

  def _doc_nodes(tree):
      for node in ast.walk(tree):
          if isinstance(node, doc_holders) and node.body:
              first = node.body[0]
              if (
                  isinstance(first, ast.Expr)
                  and isinstance(first.value, ast.Constant)
                  and isinstance(first.value.value, str)
              ):
                  yield node, first

  def stripped(src):
      tree = ast.parse(src)
      for node, _ in _doc_nodes(tree):
          node.body = node.body[1:] or [ast.Pass()]
      return ast.dump(tree)

  def returns(src):
      return [
          ast.unparse(n.value)
          for n in ast.walk(ast.parse(src))
          if isinstance(n, ast.Return) and n.value is not None
      ]

  def outside_docstrings(src):
      tree = ast.parse(src)
      spans = set()
      for _, first in _doc_nodes(tree):
          spans.update(range(first.lineno, (first.end_lineno or first.lineno) + 1))
      return sorted(
          line.strip()
          for number, line in enumerate(src.splitlines(), 1)
          if number not in spans and line.strip()
      )

  assert stripped(base) == stripped(new), "behaviour changed"          # AC-5.3
  assert returns(base) == returns(new), "return expressions changed"   # AC-5.4
  assert outside_docstrings(base) == outside_docstrings(new)           # AC-5.8
  print("S4 OK")
  ```

- **S5 — Change footprint.**

  ```sh
  git diff --name-only "$BASE_REV"...HEAD | sort
  git diff --name-only "$BASE_REV"...HEAD -- backend/            # AC-5.5
  git diff --name-only "$BASE_REV"...HEAD -- \
      backend/src/app/health.py backend/src/app/main.py backend/src/app/config.py  # AC-5.6
  ```

  `git diff --name-only ... -- backend/` prints exactly
  `backend/src/app/db.py` (AC-5.5); the command filtered to `health.py`,
  `main.py`, `config.py` prints nothing (AC-5.6); every path from the first
  command is in the allowlist of AC-5.7 or starts with `.factory/` (AC-5.7).

- **S6 — Identifier resolution, forbidden literals, placeholders, polarity.**
  One `grep -n` per identifier in the file named by AC-6.1 must exit 0, and
  `backend/src/app/models.py` must exist; in the token process of S1/S2, assert
  that no forbidden literal of AC-6.2 and no placeholder of AC-6.4 appears in
  any of the four normalized docstrings, and that the `pool_pre_ping`/`true` and
  `expire_on_commit`/`false` co-occurrence holds (AC-6.3).

- **S7 — Gates.** In `backend/`: `uv run ruff check .` (AC-7.1),
  `uv run ruff format --check .` (AC-7.2), `uv run mypy` (AC-7.3),
  `env -u APP_TEST_DATABASE_URL uv run pytest` (AC-7.4); then scan
  `backend/src/app/db.py` for lines longer than 100 characters (AC-7.5).

- **S8 — Hermetic import, no engine at import.**

  ```sh
  cd backend && env -u DATABASE_URL PYTHONPATH=src python -c \
    "import app.db; from sqlalchemy.ext.asyncio import AsyncEngine; \
     assert not [v for v in vars(app.db).values() if isinstance(v, AsyncEngine)]"
  ```

  Exits 0 with no database reachable (AC-8.1).

- **S9 — Accuracy review (advisory).** A reviewer reads the four docstrings
  against F1–F4 and confirms that each documented lifecycle step exists in the
  code. This is a human backstop for AC-6.1/AC-6.3 after S6 passes; it never
  overrides a failing mechanical check and cannot be the only evidence for a
  criterion.

- **S10 — Baseline gap confirmation.** Parse `BASE_REV:backend/src/app/db.py`
  and assert `ast.get_docstring` of `create_sessionmaker` is `None` (AC-3.1's
  "currently absent" clause) and that the `BASE_REV` module docstring lacks
  `app.state.sessionmaker`, `get_session`, `per request`, and `dispose`
  (F2, F6). This scenario decides the correctness of the Problem statement, not
  the post-change state.

## 5. Traceability: criteria → scenarios

| Requirement | Acceptance criterion | Scenario(s) |
|---|---|---|
| R1 | AC-1.1 | S1 |
| R1 | AC-1.2 | S1 |
| R1 | AC-1.3 | S1 |
| R1 | AC-1.4 | S1 |
| R1 | AC-1.5 | S1 |
| R1 | AC-1.6 | S1 |
| R1 | AC-1.7 | S1 |
| R2 | AC-2.1 | S2 |
| R2 | AC-2.2 | S2 |
| R2 | AC-2.3 | S2 |
| R2 | AC-2.4 | S2 |
| R3 | AC-3.1 | S2, S10 |
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
| R5 | AC-5.7 | S5 |
| R5 | AC-5.8 | S4 |
| R6 | AC-6.1 | S6, S9 |
| R6 | AC-6.2 | S6 |
| R6 | AC-6.3 | S6, S9 |
| R6 | AC-6.4 | S6 |
| R7 | AC-7.1 | S7 |
| R7 | AC-7.2 | S7 |
| R7 | AC-7.3 | S7 |
| R7 | AC-7.4 | S7 |
| R7 | AC-7.5 | S7 |
| R8 | AC-8.1 | S8 |
| R8 | AC-8.2 | S2 |

Reverse coverage: S1 (R1), S2 (R2, R3, R4, R8), S3 (R5), S4 (R5), S5 (R5),
S6 (R6), S7 (R7), S8 (R8), S9 (R6, advisory), S10 (R3, Problem statement).
Every criterion maps to at least one scenario and every scenario decides at
least one criterion.

## 6. Verification commands

```sh
export BASE_REV=$(git merge-base HEAD main)

# S1, S2, S6, S10 — docstring tokens, identifier greps, forbidden literals,
# polarity. Run the assertion lists of S1/S2/S6 in one interactive process:
cd backend && PYTHONPATH=src python

# S8 — hermetic import, no engine created at import
env -u DATABASE_URL PYTHONPATH=src python -c \
  "import app.db; from sqlalchemy.ext.asyncio import AsyncEngine; \
   assert not [v for v in vars(app.db).values() if isinstance(v, AsyncEngine)]"

# S3, S4, S10 — inventories and behaviour equivalence (repository root):
# paste the Section 4 S3/S4 snippets into a file and run
#   python <file>.py "$BASE_REV"

# S5 — footprint (repository root)
git diff --name-only "$BASE_REV"...HEAD | sort
git diff --name-only "$BASE_REV"...HEAD -- backend/
git diff --name-only "$BASE_REV"...HEAD -- backend/src/app/health.py \
    backend/src/app/main.py backend/src/app/config.py

# S7 — gates (from backend/)
uv run ruff check . && uv run ruff format --check . && uv run mypy
env -u APP_TEST_DATABASE_URL uv run pytest
awk 'length > 100 {print FILENAME":"FNR}' backend/src/app/db.py   # AC-7.5
```

S9 (accuracy review) is recorded in the change's review notes. When a real
PostgreSQL DSN is available, running `uv run pytest` with
`APP_TEST_DATABASE_URL` set is a recommended extra regression signal; it is not
a criterion of this change (R5 already pins behaviour equivalence).

## 7. Definition of done

1. `D_mod`, `D_engine`, `D_sm`, and `D_base` satisfy R1–R4 (S1, S2, S10).
2. No behaviour change: S3, S4, S5 all pass (R5), including the production
   footprint `backend/src/app/db.py` as the only changed path under `backend/`.
3. Every identifier named in the docstrings resolves, no forbidden literal or
   placeholder is present, and option polarity is correct (S6); the accuracy
   review S9 is signed off.
4. `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, and
   `env -u APP_TEST_DATABASE_URL uv run pytest` exit 0 in `backend/`, and no
   `db.py` line exceeds 100 characters (S7).
5. `import app.db` succeeds with `DATABASE_URL` unset and creates no engine
   (S8).

## 8. Notes for planning

1. **Footprint allowlist (resolves the open conflict in
   `specs/db-session-lifecycle-change-request.md` §7.1).** An exact-set
   footprint cannot hold, because the planning artifact and this specification
   are themselves changed paths. AC-5.5 keeps the strict, meaningful invariant
   (only `backend/src/app/db.py` changes under `backend/`) and AC-5.7 admits the
   two specification artifacts plus `.factory/` change records. The planning
   artifact's AC-5.5 wording must be replaced with this specification's
   AC-5.5/AC-5.7.
2. **Sibling refactor interaction.** If
   `specs/extract-shared-fastapi-dependencies.md` (moving `get_session` to
   `app/deps.py`) merges before `BASE_REV` is frozen, AC-6.1's `get_session`
   grep target becomes `backend/src/app/deps.py`; if it merges after this
   change, the docstring prose stays correct but scenario S6 must be re-pointed.
   In both cases the docstring text itself does not need to change, because
   `db.py` names `get_session` and not its module.
3. **Token checks are necessary, not sufficient.** AC-1.x–AC-3.x are literal
   substring checks; they cannot prove the prose is coherent. S9 is therefore a
   required review step, and its sign-off is recorded with the change evidence.
4. **Corrected baseline citations.** The earlier artifacts cite
   `main.py:26`, `main.py:34`, `main.py:31`, and `main.py:21-36`; the verified
   anchors are `main.py:25`, `main.py:33`, `main.py:30`, and `main.py:19-35`
   (F3). This specification cites the verified values, and every scenario greps
   the quoted source text so that line drift cannot invalidate a check.
5. **Docstring inheritance trap.** `Base` must be checked through
   `Base.__doc__`, not `inspect.getdoc(Base)`, because the latter can fall back
   to the `DeclarativeBase` docstring and mask a removed docstring (AC-4.1).
