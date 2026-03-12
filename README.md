# SteuerFuchs

SteuerFuchs is a local-first mobile app (Expo/React Native) for Austrian Arbeitnehmerveranlagung preparation.
It helps users track deductible purchases, estimate tax impact, and export records as PDF/ZIP.

The app has no backend and no analytics.
Data stays on-device unless the user explicitly shares/exports it.

## What The App Does

- Guides first-time users through onboarding profile setup (tax year, marginal rate, default work %, GWG threshold).
- Lets users create, edit, view, filter, and delete tax-relevant items with attachments.
- Calculates deductible impact using Austrian GWG/AfA logic and mixed-use percentages.
- Generates PDF and ZIP exports, including optional detail pages and export history.
- Supports local backup/restore and optional OneDrive upload for export-only workflows.
- Provides app lock controls (biometric + PIN fallback), legal/privacy copy, and destructive local reset.

## Current Functionality Snapshot (March 12, 2026)

### Onboarding and App Shell

- Onboarding gate:
  - New installs route to `/(onboarding)/welcome` and `/(onboarding)/profile-setup`.
  - Existing profiles route to `/(tabs)/home`.
- App initializes SQLite + migrations and shows an init error screen on startup failure.
- Init error recovery includes:
  - Retry initialization
  - Export debug report
  - Reset local data

### Home

- Shows yearly dashboard metrics:
  - Item count
  - Estimated deductible total for selected tax year
  - Estimated refund impact
  - Missing receipt / missing notes attention cards
- Attention cards deep-link into filtered item list.

### Items

- Search and filter by:
  - Year
  - Usage type
  - Category
  - Missing receipt
  - Missing notes
- Swipe-to-delete row interaction with confirmation for items that have attachments.
- Item row shows category/date, total amount, and deductible-this-year value.

### Add / Detail / Edit Item

- Add item flow supports:
  - Required fields and validation
  - Optional and advanced sections
  - Camera capture, file picker upload, and extra photos
  - Draft attachment staging and cleanup on discard
- Detail screen includes:
  - Attachment gallery with missing-file handling
  - Calculation breakdown
  - Warranty and category info
  - Delete item flow
- Edit screen supports:
  - Full field editing
  - Attachment add/remove
  - Unsaved-change discard guard

### Export

- Select items with search + filters.
- Export formats:
  - PDF
  - ZIP (embedded PDF + attachments + missing attachment note if needed)
- Tracks export runs by tax year.
- Supports share/re-share of generated outputs.
- Android-only saved destination folder copy is supported through SAF.

### Settings

- Appearance:
  - Theme mode selection (`system`, `light`, `dark`) persisted in `ProfileSettings`.
- Tax & Calculation:
  - Tax profile fields (tax year, monthly gross, salary payments 12/14)
  - Auto-estimated Austrian marginal rate + optional manual override
  - Deduction defaults (GWG, half-year rule, default work %, Werbungskosten toggle)
  - Live sample calculation preview
- Security:
  - App lock toggle with biometric confirmation
  - PIN set/change (4-6 digits) with lockout protection
- Backup & Sync:
  - Create/share backup ZIP
  - Restore from backup ZIP with overwrite confirmation
  - OneDrive connect/folder verification/test export (when configured)
- Legal & Privacy:
  - Disclaimer and privacy statement
  - Permission usage summary
- Danger Zone:
  - Delete all local data (DB, attachments, PIN, settings state)

## OneDrive Configuration

OneDrive is optional and export-only.
The UI action (`Connect OneDrive`) is displayed only when the build contains:

- `EXPO_PUBLIC_ONEDRIVE_CLIENT_ID`

In code this is evaluated by:

- `src/services/onedrive-auth.ts` via `isOneDriveConfigured()`
- `src/app/(tabs)/settings/backup-sync.tsx` for conditional UI rendering

### Configure In EAS

Add for each environment you build/publish:

```bash
eas env:create --environment development --name EXPO_PUBLIC_ONEDRIVE_CLIENT_ID --value <client-id>
eas env:create --environment preview --name EXPO_PUBLIC_ONEDRIVE_CLIENT_ID --value <client-id>
eas env:create --environment production --name EXPO_PUBLIC_ONEDRIVE_CLIENT_ID --value <client-id>
```

Verify:

```bash
eas env:list --environment preview
```

## Design Notes

- Theme tokens are centralized in `src/constants/theme.ts`.
- Settings stack uses `contentStyle` background from theme.
- Tab scene background is centralized in `src/app/(tabs)/_layout.tsx` via:
  - `sceneStyle: { backgroundColor: theme.background }`
- This prevents background mismatches between tab screens and stack screens.

See:

- `docs/design/theme-qa.md`
- `docs/design/navigation-layout-qa.md`

## Architecture Overview

- UI: Expo Router + React Navigation (Tabs + Stacks)
- State/Persistence:
  - SQLite repositories for domain data
  - Local file storage for attachments and exports
  - SecureStore for sensitive small state (PIN hash, OneDrive folder URI)
- Core modules:
  - `src/domain`: tax rules/validation
  - `src/repositories`: persistence access
  - `src/services`: exports, backup/restore, auth, file handling
  - `src/app`: route-level screens

## Testing

- Unit tests: domain logic and validation
- Integration tests: DB migrations/repositories, backup/restore, attachment lifecycle
- Screen/workflow tests: onboarding, home/items/export/settings flows

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run release:preflight
```

## Build Commands

```bash
# Preview/internal
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Production
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Documentation Map

- Full functionality catalog: `docs/functionalities.md`
- Design QA:
  - `docs/design/theme-qa.md`
  - `docs/design/navigation-layout-qa.md`
- Release docs:
  - `docs/release/production-readiness.md`
  - `docs/release/final-qa-hardware-checklist.md`
  - `docs/release/build-versioning.md`
- ADRs:
  - `docs/adr/0001-auth-strategy.md`
  - `docs/adr/0002-v1-scope.md`
