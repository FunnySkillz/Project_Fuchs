# Theme QA Checklist

Last updated: 2026-03-12

Use this checklist to keep theme behavior and background rendering consistent across light/dark modes.

## Source Of Truth

- Theme tokens:
  - `src/constants/theme.ts`
- Tab scene background:
  - `src/app/(tabs)/_layout.tsx`
  - `screenOptions.sceneStyle.backgroundColor = theme.background`
- Settings stack background:
  - `src/app/(tabs)/settings/_layout.tsx`
  - `screenOptions.contentStyle.backgroundColor = theme.background`

## Implementation Rules

### 1) Color Tokens

- Use theme tokens, not hardcoded hex values, for screen-level UI.
- Keep text, border, and surface contrast readable in both modes.

### 2) Tab Scene Background Ownership

- Keep tab root screen background centralized in Tabs `sceneStyle`.
- Do not set per-screen wrapper backgrounds (`SafeAreaView`, root `View`, root `Box`) unless there is a proven need.
- If a wrapper-specific override is required, document why in PR notes.

### 3) Stack Background Ownership

- For stack screens (Item + Settings), keep stack `contentStyle` as background owner.
- Avoid adding screen-level wrapper backgrounds that conflict with stack background.

## Screen QA Coverage

- [x] Home cards, badges, and action surfaces are readable in light/dark.
- [x] Items filter states and row cards are readable in light/dark.
- [x] Export filter states and totals cards are readable in light/dark.
- [x] Settings appearance/security/backup cards are readable in light/dark.
- [x] Danger/destructive actions remain readable in both modes.

## Manual QA Checklist

- [ ] Light mode: Home, Items, Export, Settings share the same page background.
- [ ] Dark mode: Home, Items, Export, Settings share the same page background.
- [ ] iOS overscroll/bounce on Home does not reveal a different background.
- [ ] iOS overscroll/bounce on Items does not reveal a different background.
- [ ] iOS overscroll/bounce on Export does not reveal a different background.
- [ ] iOS overscroll/bounce on Settings (index and subroutes) does not reveal a different background.
- [ ] Theme switching (`system/light/dark`) updates all tab/stack pages without stale colors.
