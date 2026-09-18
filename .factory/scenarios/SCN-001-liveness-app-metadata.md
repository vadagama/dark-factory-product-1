---
schema: dark-factory.dev/scenario/v1
id: scenario:dark-factory-product-1:liveness:app-metadata
type: scenario
title: The liveness probe path reports the configured app name and the package version
product: dark-factory-product-1
status: draft
change: chg:dark-factory-product-1:2026:0002
---

The liveness probe path `GET /` is requested while the process is running. The
API answers `200` with the JSON object `{"app": <Settings.app_name>,
"version": app.__version__}`: the application name comes from the `Settings`
instance the app was built with (surfaced as `request.app.title` by
`create_app`), and the version comes from the package attribute
`app.__version__` (`backend/src/app/__init__.py`). The body carries exactly
those two keys. The chart's liveness probe
(`deploy/chart/values.yaml`, `backend.probes.liveness.path: /`) relies on this
contract. Specification: `.factory/changes/CHG-0001-liveness-unit-test.md`.
