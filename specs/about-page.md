# Specification — New frontend About page using Small UIKit components

| Field | Value |
|---|---|
| Change | New frontend About page using Small UIKit components |
| Slug | `about-page` |
| Stage | specification |
| Attempt | 1 |
| Surface | `frontend` (React + Vite + TypeScript SPA), **app scope only** |
| Status | Draft — ready for implementation |
| Baseline | `frontend/src/App.tsx` renders `<HealthPage />` directly; `frontend/src/pages/HealthPage.tsx` and `frontend/src/pages/HealthPage.test.tsx` exist |

This document is the contract for the change. Every acceptance criterion (AC) is
expected to be checkable by the scenarios in §4 and the commands in §6; a
criterion that cannot be checked is a defect in this spec.

---

## 1. Problem

The SPA exposes exactly one destination. `frontend/src/App.tsx` renders
`<HealthPage />` unconditionally, and `frontend/src/pages/HealthPage.tsx` is a
networked view that calls `/api/healthz`. Consequently:

- users have no "About" section describing the product; and
- there is no static, API-independent page that exercises the Small UIKit
  (`@small/ui`) `Card` component and `StatusBadge` pattern; and
- because `App` has no in-page navigation, a second page could not be reached
  even if it existed.

## 2. Scope

### 2.1 In scope

1. A new module `frontend/src/pages/AboutPage.tsx` exporting a named
   `AboutPage` React component that renders a static "About" section.
2. Use of `Card` (with its compound parts) and `StatusBadge` from `@small/ui`
   on that page, imported from the package root only.
3. A new component test `frontend/src/pages/AboutPage.test.tsx`, following the
   patterns of `frontend/src/pages/HealthPage.test.tsx`.
4. In-page navigation in `frontend/src/App.tsx` that exposes the existing
   `HealthPage` and the new `AboutPage` as two destinations, defaulting to
   Health.
5. A test covering the navigation behavior: a new `frontend/src/App.test.tsx`,
   or additional cases inside `AboutPage.test.tsx`.
6. This specification file (`specs/about-page.md`).

### 2.2 Decisions fixed by this spec

- **Navigation mechanism.** In-page tabs built from the `@small/ui`
  `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components. No router, no
  URL change, no hash change.
- **Tab contract.** `TabsList` carries `aria-label="Sections"`; there are
  exactly two triggers with values/labels `health`/`Health` and `about`/`About`;
  the `Tabs` root uses `defaultValue="health"`.
- **About heading.** The page's `<h1>` text content is exactly `About`.
- **No new dependencies.** `frontend/package.json` and
  `frontend/package-lock.json` are unchanged.

### 2.3 Out of scope

- Any change under `backend/**`, `deploy/**`, or `.github/**`.
- Any change to the UIKit package: `frontend/packages/ui/**` (sources, tests,
  stories, tokens, policy) is untouched.
- URL routing, deep links, browser history, or adding a router dependency.
- Data fetching, API calls, mutations, auth, or persistence on the About page.
- New runtime or dev dependencies in `frontend/package.json`.
- Storybook stories or visual-regression baselines for the product page.
- Localization/i18n; copy other than the exact strings this spec fixes.
- Behavioral changes to `HealthPage.tsx` or `api/client.ts`.

### 2.4 Assumptions (verified against the baseline tree)

- **A1.** `@small/ui` exports `Card`, the `Card*` compound parts, and
  `StatusBadge` from its root (`frontend/packages/ui/src/index.ts`).
- **A2.** Vitest (app scope) includes `src/**/*.{test,spec}.{ts,tsx}`
  (`frontend/vite.config.ts`), so new `*.test.tsx` files are collected.
- **A3.** The frontend ESLint config spreads the Small UIKit import policy over
  app code (`frontend/eslint.config.js` +
  `frontend/packages/ui/policy/eslint-small-ui.mjs`).

---

## 3. Requirements and acceptance criteria

### R1 — About page module and export

- **AC1.1** `frontend/src/pages/AboutPage.tsx` exists.
- **AC1.2** It provides a named export `AboutPage`, importable as
  `import { AboutPage } from "./AboutPage"`.

### R2 — Static About content

- **AC2.1** Rendering `<AboutPage />` yields a `main` landmark
  (role `main`).
- **AC2.2** That `main` contains exactly one `h1`, whose text content is
  exactly `About`.
- **AC2.3** That `main` contains at least one `p` element whose trimmed text
  content is non-empty.
- **AC2.4** `AboutPage.tsx` contains no import from `../api/client`.
- **AC2.5** Rendering `<AboutPage />` calls neither `fetch` nor
  `client.fetchHealth`.
- **AC2.6** Rendering `<AboutPage />` renders no element with role `alert` and
  no text content equal to `Loading…`.

### R3 — Small UIKit composition (Card + StatusBadge)

- **AC3.1** `AboutPage.tsx` imports `Card` and `StatusBadge` with the import
  specifier `@small/ui` (package root).
- **AC3.2** The rendered output contains at least one element with class
  `small-card`, and at least one descendant whose class list contains an entry
  starting with `small-card__`.
- **AC3.3** The rendered output contains at least one element with class
  `small-status-badge`.
- **AC3.4** Every `.small-status-badge` element has a `data-status` attribute
  whose value is one of `neutral`, `info`, `success`, `warning`, `danger`.
- **AC3.5** Every `.small-status-badge` element has non-empty trimmed text
  content (the status word is accessible; color is not the sole carrier).

### R4 — UIKit import policy compliance

- **AC4.1** `npm run lint` (from `frontend/`) exits `0`.
- **AC4.2** No frontend source file changed by this change contains an import
  specifier that starts with `@small/ui/` or `@radix-ui/`.

### R5 — In-page navigation registration

- **AC5.1** `App` renders a `tablist` (role) whose accessible name is
  `Sections`, containing exactly two `tab` controls with accessible names
  `Health` and `About`.
- **AC5.2** On initial render the `Health` tab has `aria-selected="true"`, the
  `About` tab has `aria-selected="false"`, and a tab panel named `Health` is
  present.
- **AC5.3** Activating the `About` tab selects it and exposes a tab panel named
  `About` that contains the `h1` with text `About` and a `.small-card` element;
  the `h1` with text `dark-factory-product-1` is not in the accessibility tree.
- **AC5.4** After activating `About`, activating the `Health` tab restores a
  tab panel named `Health` containing the `h1` with text
  `dark-factory-product-1`; the About `h1` is no longer in the accessibility
  tree.
- **AC5.5** Tab switching does not change `window.location.pathname` or
  `window.location.hash`.

### R6 — Existing Health behavior preserved

- **AC6.1** `frontend/src/pages/HealthPage.tsx` and
  `frontend/src/pages/HealthPage.test.tsx` are byte-for-byte unchanged, and
  `HealthPage.test.tsx` passes.
- **AC6.2** With `fetchHealth` resolving `{ status: "ok", database: "ok" }`, the
  initial `App` render shows the `Health` tab panel with two `ok` markers and a
  `Refresh` button.
- **AC6.3** With `fetchHealth` rejecting with `new ApiError(0, "The API is
  unreachable")`, the initial `App` render shows an element with role `alert`
  containing `Backend unavailable` and a `Retry` button.

### R7 — Component test

- **AC7.1** `frontend/src/pages/AboutPage.test.tsx` exists.
- **AC7.2** It imports `render` and `screen` from
  `@testing-library/react` and `describe`, `it`, `expect` from `vitest`, and
  declares a top-level `describe("AboutPage", …)` block.
- **AC7.3** It contains assertions covering R2 (heading, prose, no alert, no
  network) and R3 (Card and StatusBadge presence/validity).
- **AC7.4** `npm run test` (from `frontend/`) exits `0` and reports the
  `AboutPage` suite as passing.

### R8 — Frontend-only change, no collateral edits

- **AC8.1** The change's file diff (against the base revision) contains only
  `frontend/src/pages/AboutPage.tsx`, `frontend/src/pages/AboutPage.test.tsx`,
  `frontend/src/App.tsx`, optionally `frontend/src/App.test.tsx`, and
  `specs/about-page.md`.
- **AC8.2** No file under `backend/`, `deploy/`, `.github/`, or
  `frontend/packages/ui/` is modified.
- **AC8.3** `frontend/src/pages/HealthPage.tsx`,
  `frontend/src/pages/HealthPage.test.tsx`, and `frontend/src/api/client.ts`
  are unchanged.
- **AC8.4** `frontend/package.json` and `frontend/package-lock.json` are
  unchanged.

### R9 — Build and type gates

- **AC9.1** `npm run typecheck` (from `frontend/`) exits `0`.
- **AC9.2** `npm run build` (from `frontend/`) exits `0`.
- **AC9.3** The UIKit gates `npm run ui:lint && npm run ui:typecheck &&
  npm run ui:test && npm run ui:gates` (from `frontend/`) exit `0` (the package
  is untouched, so this is a regression check).

---

## 4. Scenarios

Each scenario is a runnable check. `S*` IDs are the traceability targets for
the criteria in §5. Component-level scenarios execute under `npm run test`
(vitest + jsdom + Testing Library); static scenarios execute as shell commands.

- **S1 — AboutPage renders the static About section.**
  *Given* a test renders `<AboutPage />`, *then* `screen.getByRole("main")`
  exists; inside it exactly one `getByRole("heading", { level: 1 })` has text
  `About`; inside it at least one `<p>` has non-empty trimmed text.

- **S2 — AboutPage uses the Card component.**
  *Given* a rendered `<AboutPage />`, *then*
  `container.querySelector(".small-card")` is non-null and
  `container.querySelector('[class*="small-card__"]')` is non-null.

- **S3 — AboutPage uses the StatusBadge pattern.**
  *Given* a rendered `<AboutPage />`, *then* the set of
  `container.querySelectorAll(".small-status-badge")` is non-empty; every
  element's `data-status` is in
  `{neutral, info, success, warning, danger}`; every element's trimmed text is
  non-empty.

- **S4 — AboutPage is static (no network, no async states).**
  *Given* `fetch` is replaced with a spy and `client.fetchHealth` is spied,
  *when* `<AboutPage />` renders, *then* neither spy was called, no
  `role="alert"` element is present, no element has text `Loading…`, and
  `AboutPage.tsx` matches no `api/client` import.

- **S5 — Import policy.**
  *Given* the frontend ESLint config with the Small UIKit policy, *when*
  `npm run lint` runs, *then* it exits `0`; and a content search over the
  changed frontend source files finds no specifier starting with `@small/ui/`
  or `@radix-ui/`.

- **S6 — App defaults to Health.**
  *Given* `client.fetchHealth` is mocked to resolve
  `{ status: "ok", database: "ok" }`, *when* `<App />` renders, *then*
  `getByRole("tablist", { name: "Sections" })` exists; `getByRole("tab",
  { name: "Health" })` has `aria-selected="true"`; `getByRole("tab",
  { name: "About" })` has `aria-selected="false"`; `getByRole("tabpanel",
  { name: "Health" })` contains the `h1` `dark-factory-product-1` and exactly
  two `ok` markers.

- **S7 — Switching to About shows the About section.**
  *Given* `<App />` is rendered with `fetchHealth` mocked, *when* the user
  activates the `About` tab, *then* the `About` tab is selected and
  `getByRole("tabpanel", { name: "About" })` contains the `h1` `About` and a
  `.small-card`; `queryByRole("heading", { name: "dark-factory-product-1" })`
  is `null`.

- **S8 — Switching back to Health re-mounts HealthPage.**
  *Given* the `About` tab is active, *when* the user activates the `Health`
  tab, *then* `getByRole("tabpanel", { name: "Health" })` contains the `h1`
  `dark-factory-product-1`, and `queryByRole("heading", { name: "About" })` is
  `null`.

- **S9 — No URL-based routing.**
  *Given* `<App />` is rendered, *when* tabs are switched, *then*
  `window.location.pathname` equals its pre-switch value and
  `window.location.hash` is `""` before and after.

- **S10 — No new dependencies / no router.**
  *Given* the change is applied, *when* `frontend/package.json` and
  `frontend/package-lock.json` are diffed against the base, *then* they show no
  changes.

- **S11 — Health healthy behavior is preserved.**
  *Given* `client.fetchHealth` resolves
  `{ status: "ok", database: "ok" }`, *when* `<App />` renders, *then* two
  elements matching `strong` have text `ok` and a `Refresh` button is present.

- **S12 — Health error behavior is preserved.**
  *Given* `client.fetchHealth` rejects with
  `new ApiError(0, "The API is unreachable")`, *when* `<App />` renders, *then*
  `getByRole("alert")` has text content containing `Backend unavailable` and a
  `Retry` button is present.

- **S13 — Lint, typecheck, tests and build pass.**
  *When* `npm run lint`, `npm run typecheck`, `npm run test`, and
  `npm run build` run from `frontend/`, *then* each exits `0`.

- **S14 — Diff is frontend-only.**
  *When* `git diff --name-only <base>` is inspected, *then* every changed path
  is in the allowed set of AC8.1 and no path under `backend/`, `deploy/`,
  `.github/`, or `frontend/packages/ui/` appears.

- **S15 — UIKit gates remain green.**
  *When* `npm run ui:lint`, `npm run ui:typecheck`, `npm run ui:test`, and
  `npm run ui:gates` run from `frontend/`, *then* each exits `0`.

---

## 5. Traceability — criteria to scenarios

| Criterion | Verifying scenario(s) |
|---|---|
| AC1.1 | S1, S14 |
| AC1.2 | S1 |
| AC2.1 | S1 |
| AC2.2 | S1 |
| AC2.3 | S1 |
| AC2.4 | S4 |
| AC2.5 | S4 |
| AC2.6 | S4 |
| AC3.1 | S5 |
| AC3.2 | S2 |
| AC3.3 | S3 |
| AC3.4 | S3 |
| AC3.5 | S3 |
| AC4.1 | S5, S13 |
| AC4.2 | S5 |
| AC5.1 | S6 |
| AC5.2 | S6 |
| AC5.3 | S7 |
| AC5.4 | S8 |
| AC5.5 | S9 |
| AC6.1 | S11, S12, S14 |
| AC6.2 | S6, S11 |
| AC6.3 | S12 |
| AC7.1 | S14 |
| AC7.2 | S1 |
| AC7.3 | S1, S2, S3, S4 |
| AC7.4 | S13 |
| AC8.1 | S14 |
| AC8.2 | S14, S15 |
| AC8.3 | S11, S12, S14 |
| AC8.4 | S10 |
| AC9.1 | S13 |
| AC9.2 | S13 |
| AC9.3 | S15 |

Reverse check: every scenario S1–S15 appears in at least one row above.

---

## 6. Verification commands

Run from the repository root unless noted.

```sh
# Static / diff scope
git diff --name-only <base>            # S14 (allowed set of AC8.1)
git diff --stat -- backend deploy .github frontend/packages/ui   # S14 (must be empty)
git diff -- frontend/package.json frontend/package-lock.json     # S10 (must be empty)

# No API import on the About page
grep -n "api/client" frontend/src/pages/AboutPage.tsx            # S4 (no matches)

# App gates (from frontend/)
cd frontend
npm run lint          # S5, S13
npm run typecheck     # S13
npm run test          # S1–S4, S6–S9, S11–S13
npm run build         # S13

# UIKit gates — regression only, package untouched (from frontend/)
npm run ui:lint && npm run ui:typecheck && npm run ui:test && npm run ui:gates   # S15
```

Scenario-to-test mapping: S1–S4 live in
`frontend/src/pages/AboutPage.test.tsx`; S6–S9 and S11–S12 live in
`frontend/src/App.test.tsx` (or are added to `AboutPage.test.tsx`); S5 and
S13–S15 are the commands above; S10 and S14 are the `git diff` commands.

## 7. Definition of done

The change is complete when all of the following hold:

1. The allowed diff set of AC8.1 is the only change (S14).
2. `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`
   pass from `frontend/` (S13).
3. The UIKit gates pass unchanged (S15).
4. Every scenario S1–S15 has been executed and passes.
5. `frontend/src/pages/HealthPage.test.tsx` passes without modification (S11,
   S12, S14).
