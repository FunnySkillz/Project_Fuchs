# SteuerFuchs V1 Production Readiness Gate

## Purpose
Define a binary release gate for V1. V1 ships only when all must-have checks are `PASS`.

## Gate Status
- Release target: `V1.0.0`
- Gate owner: `Maintainer`
- Current status: `BLOCKED` until all checklist items are `PASS`

## Must-Have Checklist (Pass/Fail)

### 1) Data Safety
- [ ] PASS: Add/Cancel/Delete flows leave no orphan attachment files.
  Exit criteria:
  - Add Item Step 1 cancel/back removes staged files.
  - Deleting one attachment removes DB row (soft delete) and file + thumbnail.
  - Deleting an item removes linked attachment binaries.
- [ ] PASS: Backup ZIP is full fidelity.
  Exit criteria:
  - ZIP contains SQLite DB, attachment binaries, and versioned manifest.
  - Manifest contains item/attachment mapping.
- [ ] PASS: Restore validates backup before overwrite.
  Exit criteria:
  - Reject unsupported backup versions/schemas.
  - Reject missing manifest or missing required payloads.
  - Safe overwrite confirmation exists in UI.

### 2) UX Resilience
- [ ] PASS: Required loading, empty, and error states are present on core screens.
  Exit criteria:
  - Home, Items, Add Item, Detail, Export, Settings render non-crashing fallback states.
- [ ] PASS: Permission failures are handled with user-facing guidance.
  Exit criteria:
  - Camera/file picker denials show actionable messages.
  - No crashes on denied permission paths.
- [ ] PASS: App startup failure recovery exists.
  Exit criteria:
  - Migration/open failure screen is shown.
  - User can retry or trigger safe local reset.

### 3) Build and CI Baseline
- [ ] PASS: Type check and tests are green.
  Exit criteria:
  - `npx tsc --noEmit` passes.
  - Required unit/integration tests pass in CI.
- [ ] PASS: Lint baseline is clean enough to enforce.
  Exit criteria:
  - No new lint warnings/errors introduced by release branch.
- [ ] PASS: Production build artifacts can be generated.
  Exit criteria:
  - Android and iOS EAS build commands complete successfully on release commit.
- [ ] PASS: Final hardware QA is completed on signed production artifacts.
  Exit criteria:
  - `docs/release/final-qa-hardware-checklist.md` is fully executed and signed off.

### 4) Privacy and Local-First Guarantees
- [ ] PASS: Local-first behavior is preserved when cloud integration is unavailable.
  Exit criteria:
  - Core app flows work fully offline/local.
  - OneDrive is optional and never blocks local export.
- [ ] PASS: Disclaimer and privacy statement are visible in-app.
  Exit criteria:
  - Legal copy is accessible from Settings.
  - Disclaimer explicitly states "No tax advice, estimates only."
- [ ] PASS: Security controls match platform capability.
  Exit criteria:
  - PIN/lock behavior is implemented only where support is real (no fake security claims).

## Manual QA Checklist (Light/Dark + Core Flows)

### Theme
- [ ] System mode follows OS light/dark.
- [ ] Manual Light mode applies instantly across all tabs/routes.
- [ ] Manual Dark mode applies instantly across all tabs/routes.
- [ ] Text, cards, borders, and destructive actions remain readable in both modes.

### Core User Journey
- [ ] Fresh install: onboarding completes, profile settings persist.
- [ ] Add item flow: attachment step, required fields, validation, save success.
- [ ] Add flow cancel/back cleanup: no staged files remain after exit.
- [ ] Item detail: calculations render, missing file placeholders do not crash.
- [ ] Edit item: add/remove attachment works and remains consistent.
- [ ] iOS stack-header spacing is consistent (no extra top gap below native header).
- [ ] iOS swipe-back works on read-only/detail routes with history.
- [ ] Unsaved edit/create flows require explicit discard confirmation before exit.
- [ ] Delete attachment and delete item paths complete safely.
- [ ] Export: PDF/ZIP generation and progress UI complete.
- [ ] Settings: backup create, backup import overwrite confirmation, restore reinit.

## Release Steps (EAS + Versioning)

1. Freeze release branch and stop feature merges.
2. Set versioning:
   - Update `package.json` version and `expo.version` in `app.json`.
   - Keep EAS remote versioning enabled (`eas.json > cli.appVersionSource = remote`).
   - Keep profile `autoIncrement` enabled for native build numbers.
3. Run local gate commands:
   - `npx tsc --noEmit`
   - `npm test`
   - `npm run lint` (or project lint command)
4. Run manual QA checklist above on a release candidate build.
5. Build artifacts:
   - `eas build --platform android --profile production`
   - `eas build --platform ios --profile production`
6. Smoke-test produced binaries.
7. Tag release commit (`v1.0.0`) and publish release notes.

## Open-Issue to Checklist Mapping

| Issue | Checklist Item |
| --- | --- |
| #71 | Data Safety 1.1 (orphan cleanup in add/cancel/delete flows) |
| #72 | Data Safety 1.2 (full-fidelity backup ZIP) |
| #73 | Data Safety 1.3 (validated restore with safe overwrite) |
| #74 | Build and CI 3.1 (backup/restore integration tests) |
| #75 | UX Resilience 2.2 (permission hardening and graceful fallbacks) |
| #76 | UX Resilience 2.3 (startup failure recovery screen + safe reset) |
| #77 | Build and CI 3.1 (core logic unit tests) |
| #78 | Build and CI 3.1 (DB migration/seed/repository integration tests) |
| #85 | Privacy/Local-First 4.2 (in-app disclaimer + privacy statement + metadata checks) |

## Release Decision Rule
V1 is releasable only when:
- All must-have checklist items are `PASS`.
- All mapped P1/P2 blocking issues are closed.
