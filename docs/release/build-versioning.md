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

Rule:

- If `monetization_enabled` is `true`, then `legal_profile` must be `trader` and `legal_migration_complete` must be `true`.
