# SteuerFuchs V1 Production Readiness Gate

## Purpose
Define a binary release gate for V1. V1 ships only when all must-have checks are `PASS`.

## Gate Status
- Release target: `V1 (current candidate: 1.0.7)`
- Gate owner: `Maintainer`
- Policy/build gate status: `PASS` when `npm run release:preflight` and `npm run release:policy` succeed on the release commit.
- Manual hardware sign-off status: `PENDING` until `docs/release/final-qa-hardware-checklist.md` is fully executed and signed.
- Submission readiness source of truth: `docs/release/release-gate-policy.json`.

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
  - `npm run typecheck` passes.
  - Required unit/integration tests pass in CI.
- [ ] PASS: i18n dictionary parity check is green.
  Exit criteria:
  - EN is treated as master dictionary.
  - `npm run i18n:parity:ci` passes (DE keys exactly match EN keys).
- [ ] PASS: UTF-8 encoding guard is green.
  Exit criteria:
  - `npm run encoding:check` passes.
  - No replacement characters (`U+FFFD`) or BOM-encoded source files are present.
- [ ] PASS: Legal-sensitive DE copy freeze check is green.
  Exit criteria:
  - `npm run legal:de:freeze` passes.
  - Legal/privacy disclaimer copy in app remains semantic-equivalent and orthography-only.
- [ ] PASS: Release policy gate passes.
  Exit criteria:
  - `npm run release:policy` passes.
  - `docs/release/release-gate-policy.json` fields are valid.
  - If monetization is enabled, legal migration is complete and legal profile is `trader`.
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

### 5) Store Metadata and Legal Package
- [ ] PASS: App Store metadata is complete.
  Exit criteria:
  - Support URL is set in App Store Connect.
  - Privacy Policy URL is set in App Store Connect.
  - App Review contact name/email/phone is set in App Store Connect.
- [ ] PASS: Legal package is complete for selected legal profile.
  Exit criteria:
  - Website `/impressum` includes full name, full address, email, country, and responsible publisher statement.
  - Website `/privacy` includes local-first, permissions, export/OneDrive behavior, and privacy contact.
  - In-app legal copy does not contradict website legal pages.

### 6) Localization Hardening (V1)
- [ ] PASS: Product localization decisions are enforced.
  Exit criteria:
  - RTL is explicitly unsupported in v1.
  - Export content language is the current app language at generation time.
  - Export filenames stay stable/non-localized.
  - EN/DE legal text remains semantically equivalent.
- [ ] PASS: Startup localization behavior is stable.
  Exit criteria:
  - Language is resolved before first visible render.
  - No localized UI flash appears on startup.
- [ ] PASS: Localization release checks are verified.
  Exit criteria:
  - Deep links / restored routes show localized titles and body text.
  - Accessibility labels are localized in EN and DE.
  - Legal EN/DE sync is verified.
  - Manual localization QA matrix is signed off.

## Manual QA Checklist (Light/Dark + Core Flows)

### Theme
- [ ] System mode follows OS light/dark.
- [ ] Manual Light mode applies instantly across all tabs/routes.
- [ ] Manual Dark mode applies instantly across all tabs/routes.
- [ ] Text, cards, borders, and destructive actions remain readable in both modes.

### Core User Journey
- [ ] Fresh install: onboarding completes, profile settings persist.
- [ ] Add item flow: attachment step, required fields, validation, save success for both one-time and subscription purchase types.
- [ ] Add flow cancel/back cleanup: no staged files remain after exit.
- [ ] Item detail: calculations render, missing file placeholders do not crash.
- [ ] Edit item: add/remove attachment works and remains consistent across one-time and subscription items.
- [ ] Subscription validation: billing cadence is required; subscription end date format/order rules are enforced.
- [ ] Year-overlap behavior: subscriptions active in the selected year are included in Home/Items/Export (including prior-year starts still active this year).
- [ ] iOS stack-header spacing is consistent (no extra top gap below native header).
- [ ] iOS swipe-back works on read-only/detail routes with history.
- [ ] Unsaved edit/create flows require explicit discard confirmation before exit.
- [ ] Delete attachment and delete item paths complete safely.
- [ ] Settings: appearance/language changes persist; backup create/import overwrite confirmation and restore reinit work.

### Export Verification
- [ ] Export: PDF/ZIP generation and progress UI complete.
- [ ] Subscription period/cadence/ongoing labels are visible and correct in export selection and generated PDF.
- [ ] Subscription yearly detail schedule is truncated at the selected tax year.
- [ ] Monthly/yearly subscription calculations in exports match selected-year allocation expectations.

### Localization Matrix (Manual, Required)
- [ ] Device locale German -> first launch resolves DE.
- [ ] Device locale non-German (example Serbian) -> first launch resolves EN.
- [ ] Switching language updates existing screens without restart.
- [ ] Deep links reopen in the selected app language.
- [ ] Export content uses selected app language.
- [ ] Exported filenames remain stable/non-localized.
- [ ] German copy does not break layouts (buttons, tabs, dialogs, empty states).
- [ ] Accessibility labels are correct in EN and DE.
- [ ] Items/Export search still works with umlaut sample data (title/vendor search path unchanged).

## Release Steps (EAS + Versioning)

1. Freeze release branch and stop feature merges.
2. Set versioning:
   - Update `package.json` version and `expo.version` in `app.json`.
   - Keep EAS remote versioning enabled (`eas.json > cli.appVersionSource = remote`).
   - Keep profile `autoIncrement` enabled for native build numbers.
3. Run canonical local gate:
   - `npm run release:preflight`
4. Optional troubleshooting (if preflight fails):
   - `npm run lint`
   - `npm run typecheck`
   - `npm run encoding:check`
   - `npm run i18n:parity:ci`
   - `npm run legal:de:freeze`
   - `npm run test:ci`
   - `npm run release:policy`
5. Run manual QA checklist above on a release candidate build.
6. Build artifacts:
   - `eas build --platform android --profile production`
   - `eas build --platform ios --profile production`
7. Smoke-test produced binaries.
8. Tag release commit (`v${package.version}`) and publish release notes.

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

## V1 De-Scoped Localization Work
- No locale-aware sorting migration unless trivial and already low-risk.
- No automated deep-link localization tests if manual QA matrix is signed off.
- No dedicated untranslated accessibility-string detection script in v1.
