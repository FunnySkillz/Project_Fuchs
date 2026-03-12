# SteuerFuchs Functionality Reference

Last updated: 2026-03-12

This document is the implementation-level feature catalog for the current app behavior.
It is intended for product, QA, and engineering alignment.

## 1) App Bootstrap and Flow Control

### Startup

- App boot initializes local database and applies migrations (`v1` to `v6`).
- If initialization fails, user sees an init error screen with:
  - Retry initialization
  - Export debug report
  - Reset local data

### Onboarding Gate

- If no valid `ProfileSettings` exist:
  - Route to `/(onboarding)/welcome`
  - Continue to `/(onboarding)/profile-setup`
- After successful onboarding save:
  - Route to `/(tabs)/home`

### App Lock Gate

- If app lock is enabled in settings:
  - User is prompted for biometric auth on startup/resume
  - PIN fallback is available if configured
- Failed PIN verification has retry budget and temporary lockout.

## 2) Navigation Structure

### Tabs

- `Home`
- `Items`
- `Add` (redirect to `/item/new`)
- `Export`
- `Settings`

### Stacks

- Item stack:
  - Add item
  - Item detail
  - Edit item
- Settings stack:
  - Settings index
  - Appearance
  - Tax & Calculation
  - Security
  - Backup & Sync
  - Legal & Privacy
  - Danger Zone

## 3) Home Dashboard

- Loads default tax year from profile settings.
- Aggregates:
  - Count of items for tax year
  - Estimated deductible total
  - Estimated refund impact (based on marginal rate)
  - Missing receipt count
  - Missing notes count
- Action cards deep-link to Items with pre-applied filters:
  - Missing receipt
  - Missing notes

## 4) Item Management

### 4.1 Add Item

- Supports mandatory and optional fields:
  - Title, purchase date, total amount
  - Category, usage type, work %
  - Warranty months, vendor, notes
  - Useful life override
- Attachment sources:
  - Camera
  - File picker (PDF/image)
  - Extra photos
- Attachment handling:
  - Draft attachments are staged locally
  - Draft cleanup occurs on discard/cancel
  - Draft attachments are promoted to permanent storage on save
- Validation:
  - Field-level validation errors with focus+scroll to first invalid

### 4.2 Item List

- Search by title/vendor.
- Filters:
  - Year
  - Usage type
  - Category
  - Missing receipt
  - Missing notes
- Sorting logic:
  - Default purchase date/created date
  - Alternative modes from session state (service-backed)
- Row actions:
  - Tap for detail
  - Swipe to delete
  - Delete confirmation when attachments exist

### 4.3 Item Detail

- Displays:
  - Core item fields
  - Attachment gallery with missing-file warning states
  - Deduction and refund calculation cards
  - Warranty-until calculation
- Actions:
  - Edit item
  - Delete item (+ linked attachments)

### 4.4 Edit Item

- Full field editing and attachment management.
- Unsaved changes guard:
  - Native back/hardware back interception
  - Discard confirmation modal

## 5) Tax Calculation Behavior

- Core deduction logic:
  - Work share resolution by usage type (`WORK`, `PRIVATE`, `MIXED`, `OTHER`)
  - GWG immediate deduction threshold
  - AfA spreading over useful life (with optional half-year rule)
  - Yearly schedule generation
  - Estimated refund via marginal rate (bps)
- Useful life resolution order:
  1. Item override
  2. Category default useful life
  3. Fallback default
- Austrian marginal rate estimate:
  - Bracket table support for current configured years
  - Nearest supported year fallback

## 6) Export Features

### Export Screen

- Item selection and filtering before export.
- Formats:
  - PDF export
  - ZIP export (includes generated PDF + attachment folders)
- Options:
  - Include detail pages in PDF/ZIP pipeline
  - Select all filtered / clear filters
- UX:
  - Progress feedback for ZIP
  - Persisted selection session state
  - Export history list with share-again actions

### Save Destination

- Local app export directory is always used.
- Android only:
  - User can pick and persist destination folder via SAF
  - App can copy generated export file into selected folder

## 7) Backup and Restore

- Backup:
  - Creates ZIP containing:
    - SQLite DB
    - Attachments
    - `manifest.json`
    - `meta.json`
- Restore:
  - Imports backup ZIP with validation checks
  - Requires explicit overwrite confirmation in UI
  - Restores DB + attachment files
  - Returns restore summary counts

## 8) OneDrive (Optional, Export-Only)

- OneDrive integration is optional and does not block local export.
- Build-time requirement:
  - `EXPO_PUBLIC_ONEDRIVE_CLIENT_ID`
- If variable is missing:
  - UI shows "not configured" guidance
  - Connect button is hidden
- When configured:
  - Connect/disconnect OAuth
  - Select folder
  - Verify folder access
  - Run test export pipeline
  - Optional upload-after-export preference

## 9) Settings Areas

### Appearance

- Theme mode:
  - `system`
  - `light`
  - `dark`
- Preference persists to profile settings.

### Tax & Calculation

- Profile and rule fields:
  - Tax year default
  - Monthly gross income
  - Salary payments per year (12/14)
  - Auto marginal rate estimate
  - Manual marginal rate override
  - GWG threshold
  - Half-year rule toggle
  - Werbungskosten toggle/info
  - Advanced default work %
- Includes sample preview card and info/disclaimer card.

### Security

- App lock toggle with biometric confirmation.
- PIN fallback setup/change:
  - 4-6 numeric digits
  - Current PIN verification on change
  - Error/success feedback

### Backup & Sync

- Create/share backup ZIP
- Import backup with confirmation
- OneDrive section (config-dependent)

### Legal & Privacy

- Tax-disclaimer copy
- Privacy statement
- Permission usage summary

### Danger Zone

- Delete all local data from device:
  - DB reset
  - Attachment files
  - PIN data
  - Emits local-data-deleted event

## 10) Data and Storage

### Persistent Data

- SQLite entities:
  - `ProfileSettings`
  - `Category`
  - `Item`
  - `Attachment`
  - `ExportRun`
- Soft-delete strategy is used for core entities.

### File Storage

- Attachments:
  - Permanent folder
  - Draft staging folder
  - Thumbnail generation for images
- Exports:
  - Stored in app document `exports` directory

### Sensitive Store

- PIN hash/salt + lockout metadata
- Selected export folder URI (Android)
- OneDrive tokens/folder selection

## 11) UI and Design Constraints

- Tab scene background is centralized in `src/app/(tabs)/_layout.tsx`:
  - `sceneStyle: { backgroundColor: theme.background }`
- Settings stack background is controlled by stack `contentStyle`.
- Stack screens with visible native header use bottom safe-area ownership pattern.

See:

- `docs/design/theme-qa.md`
- `docs/design/navigation-layout-qa.md`

## 12) Non-Goals (Current)

- No direct tax filing submission
- No OCR extraction in current scope
- No mandatory cloud sync
- No backend user accounts
