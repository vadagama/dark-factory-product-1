---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:liveness:database-independent
type: scenario
title: Liveness answers while the database is unreachable
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0002
---

PostgreSQL is unreachable (no server listens at the configured DSN, and
`APP_TEST_DATABASE_URL` is unset). A request to `GET /` still answers `200` with
the app metadata, because the handler touches no session and opens no
connection: an outage must not restart the API pod (module docstring of
`backend/src/app/health.py`; readiness, which does ping the database, is served
by `GET /api/healthz` instead). The same holds when the process environment
carries values that differ from the ones the app was built with — those come
from explicit constructor arguments. Specification:
`.factory/changes/CHG-0001-liveness-unit-test.md`.
