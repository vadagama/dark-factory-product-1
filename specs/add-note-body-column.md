# Specification — Add `body` column to `notes` (Alembic expand migration)

- **Change:** Add `body` column to `notes` with an Alembic migration
- **Stage:** specification
- **Status:** ready for implementation
- **Surface:** `backend/src/app/models.py`, `backend/migrations/versions/`, `backend/tests/`
- **Related constraints:** ADR-010 п.6 (expand/contract in the rollback window),
  chart migrations Job (`deploy/chart/templates/backend-migrations-job.yaml`,
  `post-install,post-upgrade` — migrations run **after** the new backend is deployed)

---

## 1. Problem

`notes` (created by migration `0001_initial.py`) stores only `id`, `title`
(`varchar(200)`, NOT NULL) and `created_at` (timestamptz, NOT NULL, default
`now()`). There is no field for long-form text, so the product cannot persist a
note's content.

The schema change cannot be shipped as a plain "add a required column" change:
the chart runs migrations as a **post-install/post-upgrade** hook Job, i.e. the
new backend image is serving before the new schema exists, and the previous
image keeps serving during the rollback window. A migration that is not
expand-only (adds a NOT NULL column without a default, rewrites data, or drops
or re-types existing objects) would break the running deployment. The change
must therefore be a single additive, reversible migration, and no code may
depend on `body` existing before the migration has run.

## 2. Scope

### 2.1 In scope

1. `Note` model mapping extended with a nullable text attribute `body`.
2. Exactly one new Alembic revision that `upgrade()`s by adding the nullable
   `body` column and `downgrade()`s by dropping it.
3. At least one automated test asserting the new column persists a value
   (integration against PostgreSQL) plus the hermetic model-metadata check.
4. Verification that the change keeps the running deployment compatible:
   the new image starts and serves against the pre-change schema (`0001`), and
   the previous image keeps working against the post-change schema.

### 2.2 Out of scope

- HTTP/API surface for `body` (no endpoint, request/response schema, or
  serialization change); `GET /` and `GET /api/healthz` are unchanged.
- Any frontend change.
- Backfilling, deriving, or migrating existing `body` values.
- `NOT NULL`, length limits, validation, defaults, indexes, or full-text search
  on `body`.
- The contract phase (dropping the column or tightening nullability later);
  that is a separate future change.
- Editing `0001_initial.py` (published migrations are immutable) or altering
  the type/nullability of `id`, `title`, `created_at`.
- Chart, CI workflow, Dockerfile, and dependency changes.

### 2.3 Assumptions and constraints

- **A1** The current head of the single linear Alembic chain is `0001`
  (`backend/migrations/versions/0001_initial.py`, `down_revision = None`).
- **A2** Target dialect is PostgreSQL 16 (chart StatefulSet and CI service
  container); `text` has no length argument.
- **A3** Migrations run as the `post-install,post-upgrade` hook Job, after the
  new backend is deployed; `alembic upgrade head` is the command
  (`deploy/chart/values.yaml`, `migrations.command`).
- **A4** Integration tests are gated by `APP_TEST_DATABASE_URL` and must skip
  (not fail) when it is unset; CI's `backend-test` job sets it.
- **A5** Repository gates are `ruff check`, `ruff format --check`, strict
  `mypy` (`src` + `tests`), and `pytest` (`backend/pyproject.toml`).

---

## 3. Requirements and acceptance criteria

### R1 — The `Note` model exposes a nullable text `body`

| Criterion | Statement |
|---|---|
| AC1.1 | `Note.__table__.columns` contains a column named `body`. |
| AC1.2 | `body` has SQLAlchemy type `Text` and `body.nullable is True`. |
| AC1.3 | The attribute is optional in Python: `Note(title="t")` yields `body is None`; `Note(title="t", body="x")` yields `body == "x"`, with no database involved. |
| AC1.4 | `id` (Uuid, primary key), `title` (`String(200)`, NOT NULL) and `created_at` (`DateTime(timezone=True)`, NOT NULL, `server_default=now()`) keep the exact name, type, nullability and PK status defined in `0001`. |

### R2 — Exactly one new revision continues the chain

| Criterion | Statement |
|---|---|
| AC2.1 | Exactly one module under `backend/migrations/versions/` declares `down_revision == "0001"`. |
| AC2.2 | That module's `revision` is `"0002"` (the zero-padded sequential convention established by `0001_initial.py`). |
| AC2.3 | `alembic heads` resolves to a single head whose revision is `0002`. |

### R3 — Upgrade adds the column additively (expand)

| Criterion | Statement |
|---|---|
| AC3.1 | From a database at `0001`, `alembic upgrade head` exits 0; `notes.body` then exists with `is_nullable = 'YES'` and PostgreSQL `data_type = 'text'`. |
| AC3.2 | A `notes` row inserted at `0001` is still present after the upgrade with identical `id`, `title`, `created_at`, and `body IS NULL` (no backfill, non-destructive). |
| AC3.3 | After the upgrade, `id`, `title` (`varchar(200)`, NOT NULL) and `created_at` (timestamptz, NOT NULL, default `now()`) retain the definitions from `0001`. |
| AC3.4 | The new revision's `upgrade()` performs exactly one `op.add_column` targeting `notes` and no other schema/data operation: no `op.execute`, `op.bulk_insert`, `op.alter_column`, `op.create_table`/`op.create_*`, or `op.drop_*`. |

### R4 — Downgrade reverses the upgrade

| Criterion | Statement |
|---|---|
| AC4.1 | From head, `alembic downgrade 0001` exits 0; `notes.body` no longer exists and `notes` still exists with `id`, `title`, `created_at` unchanged. |
| AC4.2 | After the downgrade, `alembic_version.version_num = '0001'`. |
| AC4.3 | `alembic upgrade head` after the downgrade re-adds `body`, so the upgrade → downgrade → upgrade cycle is repeatable. |
| AC4.4 | The new revision's `downgrade()` performs exactly `op.drop_column("notes", "body")` and no other operation. |

### R5 — An automated test asserts the new column persists

| Criterion | Statement |
|---|---|
| AC5.1 | The suite contains a test that brings the database to `head` and then writes a `Note` with a non-empty `body`, commits, re-reads the row in a fresh session, and asserts the read `body` equals the written value. |
| AC5.2 | A test asserts that a `Note` written without `body` reads back with `body IS NULL`. |
| AC5.3 | In CI's `backend-test` job (`APP_TEST_DATABASE_URL` set, PostgreSQL 16), the tests of AC5.1/AC5.2 are reported **passed**, not skipped. |
| AC5.4 | With `APP_TEST_DATABASE_URL` unset, `uv run pytest` exits 0 and the database-backed tests are reported skipped. |

### R6 — Backward compatibility with the running deployment

| Criterion | Statement |
|---|---|
| AC6.1 | `import app.models` and `app.main.create_app(Settings(database_url=...))` succeed with no database reachable (no connection at import or startup). |
| AC6.2 | With the database at `0001` (no `body` column), a running app returns `GET /` → 200 and `GET /api/healthz` → 200 `{"status":"ok","database":"ok"}`. |
| AC6.3 | The upgrade adds `body` as nullable and without a server default, so the previous image (which selects only `id`, `title`, `created_at`) keeps operating after the migration: post-upgrade `SELECT id, title, created_at FROM notes` returns pre-existing rows unchanged (AC3.2) and `body` is nullable (AC3.1). |

### R7 — Repository gates stay green

| Criterion | Statement |
|---|---|
| AC7.1 | In `backend/`, `uv run ruff check .` and `uv run ruff format --check .` exit 0. |
| AC7.2 | In `backend/`, `uv run mypy` exits 0 (strict, `src` + `tests`). |
| AC7.3 | In `backend/`, `uv run pytest` exits 0: unit tests always; integration tests run when `APP_TEST_DATABASE_URL` is set and skip otherwise. |

---

## 4. Scenarios

Scenarios are the executable acceptance evidence. Each names the criteria it
demonstrates and the verification mechanism. Integration scenarios are
hermetic-by-skip (A4) and must leave the database at `head` on completion so
they are order-independent.

### S1 — Model metadata (unit, hermetic) — AC1.1, AC1.2, AC1.4
- **Given** the `Note` model imported without a database,
- **When** `Note.__table__.columns` is inspected,
- **Then** `body` is present with type `Text` and `nullable is True`, and
  `id`/`title`/`created_at` match their `0001` definitions.

### S2 — Model construction (unit, hermetic) — AC1.3
- **Given** the `Note` model,
- **When** `Note(title="t")` and `Note(title="t", body="x")` are constructed,
- **Then** the first has `body is None` and the second `body == "x"`.

### S3 — Revision graph (unit/static, hermetic) — AC2.1, AC2.2, AC2.3
- **Given** `backend/migrations/versions/`,
- **When** the revision modules are parsed for `revision`/`down_revision`,
- **Then** exactly one module has `down_revision == "0001"` and `revision == "0002"`,
  and `alembic heads` reports the single head `0002`.

### S4 — Upgrade adds a nullable text column (integration) — AC3.1, AC3.3, AC6.3
- **Given** a database migrated to `0001`,
- **When** `alembic upgrade head` is applied,
- **Then** `notes.body` exists as nullable `text` and `id`/`title`/`created_at`
  keep their `0001` definitions.

### S5 — Upgrade is non-destructive (integration) — AC3.2, AC6.3
- **Given** a `notes` row `(id, title, created_at)` present at `0001`,
- **When** `alembic upgrade head` is applied,
- **Then** the row is still present with identical `id`, `title`, `created_at`
  and `body IS NULL`.

### S6 — Downgrade and re-upgrade (integration) — AC4.1, AC4.2, AC4.3
- **Given** a database at `head`,
- **When** `alembic downgrade 0001` is applied and then `alembic upgrade head`,
- **Then** `body` is absent and `version_num = '0001'` after the downgrade,
  `notes` and its `0001` columns survive, and `body` is present again after the
  re-upgrade.

### S7 — Persistence round-trip (integration) — AC5.1, AC5.2, AC5.3
- **Given** the schema at `head`,
- **When** a `Note` with `body = "<text>"` is committed and re-read in a fresh
  session, and a `Note` created without `body` is committed and re-read,
- **Then** the first reads back the exact `body` value and the second reads
  `body IS NULL`.

### S8 — Hermetic skip (unit, hermetic) — AC5.4
- **Given** `APP_TEST_DATABASE_URL` is unset,
- **When** `uv run pytest` runs,
- **Then** the exit code is 0 and the database-backed scenarios (S4–S7, S9)
  are reported skipped.

### S9 — New image against the pre-change schema (integration) — AC6.2
- **Given** a database at `0001` (no `body`) and the current application,
- **When** the app is started and `GET /` and `GET /api/healthz` are called,
- **Then** both return 200 (health body `{"status":"ok","database":"ok"}`),
  proving no import/startup path depends on `body`; the scenario then restores
  `head`.

### S10 — Startup without a database (unit, hermetic) — AC6.1
- **Given** no database is reachable,
- **When** `app.models` is imported and `create_app(Settings(database_url=...))`
  is called,
- **Then** neither raises nor opens a connection.

### S11 — Static expand-only assertion (unit/static, hermetic) — AC3.4, AC4.4, AC6.3
- **Given** the new revision module `0002`,
- **When** its `upgrade()` and `downgrade()` bodies are statically inspected,
- **Then** `upgrade()` contains exactly one `op.add_column` for `notes.body` and
  none of `op.execute`, `op.bulk_insert`, `op.alter_column`, `op.create_*`,
  `op.drop_*`; and `downgrade()` contains exactly `op.drop_column("notes", "body")`.

### S12 — Gates (commands) — AC7.1, AC7.2, AC7.3
- **Given** the change is applied,
- **When** the commands in §6 are run,
- **Then** ruff lint/format, mypy, and pytest all exit 0.

---

## 5. Traceability — criteria to scenarios

| Criterion | Scenario(s) | Verification |
|---|---|---|
| AC1.1 | S1 | unit test on `Note.__table__.columns` |
| AC1.2 | S1 | unit test: `Text` type, `nullable is True` |
| AC1.3 | S2 | unit test: constructor with/without `body` |
| AC1.4 | S1 | unit test: `id`/`title`/`created_at` definitions unchanged |
| AC2.1 | S3 | static parse of `migrations/versions/` |
| AC2.2 | S3 | static parse: `revision == "0002"` |
| AC2.3 | S3 | `alembic heads` single head `0002` |
| AC3.1 | S4 | integration: `information_schema.columns` after `upgrade head` |
| AC3.2 | S5 | integration: pre-inserted row unchanged, `body IS NULL` |
| AC3.3 | S4 | integration: `0001` column definitions preserved |
| AC3.4 | S11 | static assertion on `upgrade()` |
| AC4.1 | S6 | integration: `body` absent after `downgrade 0001` |
| AC4.2 | S6 | `SELECT version_num FROM alembic_version` = `0001` |
| AC4.3 | S6 | integration: re-`upgrade head` re-adds `body` |
| AC4.4 | S11 | static assertion on `downgrade()` |
| AC5.1 | S7 | integration: commit + fresh-session re-read of `body` |
| AC5.2 | S7 | integration: omitted `body` reads back NULL |
| AC5.3 | S7 | CI `backend-test` log: tests passed, not skipped |
| AC5.4 | S8 | local `uv run pytest` with env unset: exit 0, skipped |
| AC6.1 | S10 | unit test: import + `create_app` without DB |
| AC6.2 | S9 | integration: `/` and `/api/healthz` 200 at schema `0001` |
| AC6.3 | S4, S5, S11 | nullable/no-default column + unchanged legacy rows/columns |
| AC7.1 | S12 | `uv run ruff check .` && `uv run ruff format --check .` |
| AC7.2 | S12 | `uv run mypy` |
| AC7.3 | S12 | `uv run pytest` |

Reverse check: every scenario lists its criteria in §4, and every criterion in
§3 appears in at least one scenario above.

---

## 6. Verification commands

```sh
cd backend

# Gates (AC7.1–AC7.3); integration scenarios skip without the DSN (AC5.4)
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest

# Integration scenarios with a real PostgreSQL (AC3–AC6)
APP_TEST_DATABASE_URL=postgresql+psycopg://test:test@localhost:55432/dark_factory_product_1_test \
  uv run pytest

# Migration direction check on a disposable database (AC3.1, AC4.1, AC4.2)
DATABASE_URL=<dsn> uv run alembic upgrade head
DATABASE_URL=<dsn> uv run alembic current          # -> 0002 (head)
DATABASE_URL=<dsn> uv run alembic downgrade 0001
DATABASE_URL=<dsn> uv run alembic current          # -> 0001
DATABASE_URL=<dsn> uv run alembic upgrade head
```

## 7. Definition of done

All criteria AC1.1–AC7.3 are satisfied by their mapped scenarios; no schema
object other than `notes.body` changes; the only new migration is `0002`; and
the deploy pipeline's post-upgrade migrations Job can apply `0002` to a
`0001` database while the previous backend image remains functional.
