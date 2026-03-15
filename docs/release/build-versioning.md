# Build Profiles and Versioning

This document defines the release build strategy for SteuerFuchs.

## EAS Profiles

Profiles are configured in `eas.json`:

- `preview`
  - `distribution: internal`
  - `channel: preview`
  - `android.buildType: apk`
  - `autoIncrement: true`
- `production`
  - `distribution: store`
  - `channel: production`
  - `android.buildType: app-bundle`
  - `autoIncrement: true`

## Identifiers

Native app identifiers are fixed in `app.json`:

- iOS bundle identifier: `com.funnyskillz.steuerfuchs`
- Android package: `com.funnyskillz.steuerfuchs`

## Versioning Strategy

- User-facing app version: `expo.version` in `app.json`
- EAS version source: `remote` (`eas.json > cli.appVersionSource`)
- Runtime version policy: `appVersion` (`app.json > expo.runtimeVersion.policy`)
- Build numbers:
  - managed by EAS remotely (not hardcoded in `app.json`)
  - profile `autoIncrement: true` increments native build numbers on each build

Release rule:

1. Update semantic app version (`expo.version`) for each release train.
2. Keep `autoIncrement: true` enabled on preview and production profiles.
3. Do not manually decrement build numbers.

## Build Commands

Preview builds (internal QA):

```bash
eas build --platform android --profile preview --non-interactive
eas build --platform ios --profile preview --non-interactive
```

Production builds:

```bash
eas build --platform android --profile production --non-interactive
eas build --platform ios --profile production --non-interactive
```

## One-Time Android Credentials Bootstrap

If Android credentials are not configured yet, run once with interactive prompts:

```bash
eas credentials:configure-build -p android -e preview
eas credentials:configure-build -p android -e production
```

After this one-time setup, `eas build --non-interactive` can run in automation.

## Verification

After build completion:

1. Install preview APK on Android test device.
2. Run core flows:
   - onboarding/profile setup
   - add/edit/delete item
   - export PDF/ZIP
   - backup/restore
3. Confirm startup and navigation work without crashes.

## Release Policy Gate

Release policy is tracked in:

- `docs/release/release-gate-policy.json`

Validation command:

```bash
npm run release:policy
```

Policy interface:

- `monetization_enabled: boolean`
- `legal_profile: "private_individual" | "trader"`
- `legal_migration_complete: boolean`
- `submission_ready: boolean`
- `rtl_supported_v1: false`
- `export_content_language_policy: "app_language_at_generation_time"`
- `export_filenames_localized: false`
- `dictionary_parity_check_passed: boolean`
- `deep_links_localized_verified: boolean`
- `accessibility_labels_localized_verified: boolean`
- `legal_text_semantic_sync_verified: boolean`
- `language_ready_before_first_render_verified: boolean`
- `no_localized_flash_verified: boolean`
- `manual_localization_qa_signed_off: boolean`

Rule:

- If `monetization_enabled` is `true`, then `legal_profile` must be `trader` and `legal_migration_complete` must be `true`.
- If `submission_ready` is `true`, all localization verification fields above must be `true`.

## Localization Safety Commands

Dictionary parity is mandatory (EN is the master dictionary):

```bash
npm run i18n:parity
```

Release preflight now enforces:

```bash
npm run release:preflight
```
