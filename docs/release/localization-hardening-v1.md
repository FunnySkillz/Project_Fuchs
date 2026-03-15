# Localization Hardening (V1)

## Product Decisions (Locked for V1)
- RTL support is explicitly out of scope for v1 (`rtl_supported_v1 = false`).
- Export content language is the currently selected app language at generation time.
- Export filenames remain stable and non-localized.
- EN and DE legal text must stay semantically equivalent.

## Safety Rules
- EN is the master dictionary.
- DE must keep exact key parity with EN (`npm run i18n:parity`).
- Missing DE key fallback remains EN at runtime.
- Missing EN key behavior:
  - Development: fail hard.
  - Production: render key string safely.
- Missing interpolation param behavior:
  - Development: fail hard.
  - Production: keep template fallback and log warning.

## Release Checks (Required)
- Deep links / restore-state routes show localized titles and localized body text.
- Accessibility labels are localized in EN and DE.
- Legal EN/DE semantic sync is verified.
- Language is resolved before first visible render.
- No localized UI flash on startup.

## De-Scoped for V1
- No locale-aware sorting migration unless trivial and already low risk.
- No automated deep-link localization tests if manual QA matrix is signed off.
- No dedicated untranslated accessibility-string detection script for v1.

## Manual QA Matrix (Required)
- Device locale German -> first launch resolves DE.
- Device locale non-German (example Serbian) -> first launch resolves EN.
- Switching app language updates existing screens without restart.
- Deep links reopen in selected language.
- Export content language follows selected app language.
- Export filenames remain stable/non-localized.
- German text does not break layouts (buttons, tabs, dialogs, empty states).
- Accessibility labels verified in EN and DE.

## Go / No-Go Rule
Ship only when all are true:
- Dictionary parity check passes.
- Release gate policy passes.
- Manual localization QA matrix is signed off.
