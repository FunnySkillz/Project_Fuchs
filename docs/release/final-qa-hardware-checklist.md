# Final QA Hardware Checklist (Issue #87)

Use this checklist for the final signed production release validation.

## 0) Preconditions

- [ ] `release:preflight` checks pass.
- [ ] `release:policy` checks pass.
- [ ] EAS Android credentials configured interactively once.
- [ ] EAS iOS credentials configured interactively once.
- [ ] App Store Connect metadata is filled:
  - Support URL
  - Privacy Policy URL
  - App Review contact (name/email/phone)

One-time credential setup (interactive):

```bash
eas credentials:configure-build -p android -e production
eas credentials:configure-build -p ios -e production
```

## 1) Build Signed Production Artifacts

```bash
eas build --platform android --profile production --non-interactive
eas build --platform ios --profile production --non-interactive
```

Record build references:

- Android build ID / URL: `________________________`
- iOS build ID / URL: `________________________`
- App version (`expo.version`): `________________________`

## 2) Install On Real Devices

- [ ] Android install succeeded (no installation errors).
- [ ] iOS install succeeded (TestFlight/internal distribution).

Devices:

- Android model / OS: `________________________`
- iPhone model / iOS: `________________________`

## 3) Core Flow QA

### Add item with receipt
- [ ] Create item with photo/PDF receipt attachment.
- [ ] Save succeeds and item appears in Items list.

### Edit item
- [ ] Open item detail and edit key fields.
- [ ] Save succeeds, values persist after reopen.
- [ ] Unsaved changes block accidental back navigation and show discard confirmation.

### Subscription scenarios
- [ ] Create/edit both `ONE_TIME` and `SUBSCRIPTION` items successfully.
- [ ] Finite monthly subscription in selected year shows expected selected-year amount and schedule.
- [ ] Ongoing subscription started in a prior year is included for the selected current year in Home/Items/Export.
- [ ] Yearly subscription cadence is prorated across years and reflected correctly in selected-year view.
- [ ] Subscription labels (period/cadence/ongoing) are visible and correct in Items, Detail, Export, and PDF.

### Delete item
- [ ] Delete from list/detail succeeds.
- [ ] With attachments: confirm dialog appears and delete completes.

### Backup/Restore
- [ ] Create backup ZIP.
- [ ] Import backup (overwrite) succeeds.
- [ ] Data remains consistent after restore.

### Settings changes
- [ ] Change appearance/language/tax/security settings.
- [ ] Changes persist after app restart.

### Localization verification (EN/DE)
- [ ] Device locale German -> first launch resolves DE.
- [ ] Device locale non-German (example Serbian) -> first launch resolves EN.
- [ ] Switching app language updates current screens without restart.
- [ ] Deep links / restored routes reopen in selected app language.
- [ ] Export content language follows selected app language.
- [ ] Exported filenames remain stable/non-localized.
- [ ] German text does not break layouts in buttons, tabs, dialogs, and empty states.
- [ ] Accessibility labels are correct in EN and DE.

## 4) Stability

- [ ] No crashes.
- [ ] No ANRs / app freezes.
- [ ] No navigation dead-ends.
- [ ] iOS stack-header screens have no extra top gap (`Settings -> Appearance`, `Settings -> Language`, `Item Detail`, `Edit Item`).
- [ ] iOS swipe-back works on read-only screens with navigation history.

Observed issues:

- `________________________`
- `________________________`

## 5) Sign-Off

- QA owner: `________________________`
- Date: `________________________`
- Verdict: `PASS / FAIL`
