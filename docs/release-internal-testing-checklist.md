# Internal Testing Release Checklist (Issue #59)

## 1. App Config Verification

- [ ] `expo.name` is set to `SteuerFuchs`.
- [ ] `expo.slug` is set to `SteuerFuchs`.
- [ ] Icon and splash assets resolve in `app.json`.
- [ ] iOS bundle id is `com.funnyskillz.steuerfuchs`.
- [ ] Android package is `com.funnyskillz.steuerfuchs`.

## 2. Permissions & Privacy Strings

- [ ] iOS InfoPlist strings are present:
  - `NSCameraUsageDescription`
  - `NSPhotoLibraryUsageDescription`
  - `NSPhotoLibraryAddUsageDescription`
- [ ] Android permissions are minimal and expected:
  - `CAMERA`
  - `READ_MEDIA_IMAGES`
  - `READ_EXTERNAL_STORAGE`
- [ ] `RECORD_AUDIO` remains blocked.
- [ ] `expo-image-picker` plugin permission text is user-friendly.

## 3. EAS Profiles

- [ ] `dev` profile exists for internal dev-client testing.
- [ ] `preview` profile exists for internal distribution testing.
- [ ] `production` profile remains reserved for store builds.

Commands:

```bash
# Dev client build
eas build --platform android --profile dev
eas build --platform ios --profile dev

# Internal preview build
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

## 4. Install & Smoke Test (Core Flows)

- [ ] App installs on Android test device.
- [ ] App installs on iOS test device.
- [ ] Onboarding/profile setup completes.
- [ ] Add item flow works (attachments + core fields).
- [ ] Item detail/edit/delete flows work.
- [ ] Calculation totals show on Home/Items/Detail.
- [ ] Export PDF works and opens share sheet.
- [ ] Export ZIP works and opens share sheet.
- [ ] Backup/restore flow works.

## 5. Release Readiness Notes

- [ ] `npm test` passes locally.
- [ ] `npx tsc --noEmit` passes locally.
- [ ] No blocking crashes in smoke tests.
- [ ] Known limitations documented before wider rollout.
