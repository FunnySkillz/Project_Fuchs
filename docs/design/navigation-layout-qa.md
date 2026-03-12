# Navigation and Layout QA Guide

Last updated: 2026-03-12

Use this guide for stack-based screens (Item and Settings stacks) so iOS header spacing and swipe-back behavior stay consistent.

## Scope

Applies to routes where the native stack header is visible, including:

- `src/app/item/*`
- `src/app/(tabs)/settings/*`

## Implementation Rules

### 1) Safe Area Ownership

- Use `SafeAreaView` from `react-native-safe-area-context`.
- For screens with a visible native header, use `edges={["bottom"]}`.
- Do not add top safe-area edges on these screens (it creates double top spacing under the header).

### 2) Scroll Inset Ownership

For the primary vertical `ScrollView` on stack screens:

- Set `contentInsetAdjustmentBehavior="never"`.
- Set `automaticallyAdjustContentInsets={false}`.
- Provide explicit container spacing:
  - `paddingTop: 24`
  - `paddingBottom: insets.bottom + 24`

This keeps spacing deterministic across iOS versions and prevents auto-inset drift.

### 3) Top Spacing Pattern

- On scroll-based stack screens, keep the outer wrapper at horizontal padding only (`px="$5"`).
- Avoid additional wrapper `py` on the main content branch when explicit `paddingTop` is already applied inside the `ScrollView`.

### 4) Back Behavior and Gestures

- Read-only/detail entry screens should allow native iOS swipe-back when history exists.
- Enter such screens with `router.push(...)` so a back stack exists.
- Edit/create flows with unsaved state must intercept exit via navigation guards (`beforeRemove`, hardware back) and confirm discard.
- Keep stack gestures enabled (`gestureEnabled: true`) for card presentation screens.

### 5) Fallback Navigation

- Only show explicit fallback buttons like `Back to Settings` / `Back to Items` when `canGoBack` is false.
- Use `router.replace(...)` for fallback destinations to avoid creating dead-end loops.

### 6) Tab Scene Background Ownership

- For tab root screens (`home`, `items`, `export`, `settings`), keep page background centralized in:
  - `src/app/(tabs)/_layout.tsx`
  - `screenOptions.sceneStyle.backgroundColor = theme.background`
- Do not add per-screen wrapper background colors on tab root routes unless needed for a specific local component.
- Keep Settings stack background control unchanged in `src/app/(tabs)/settings/_layout.tsx` via `contentStyle`.

## Manual QA Checklist (Layout + Navigation)

- [ ] iOS: no extra top gap under header on `Settings -> Appearance`, `Item Detail`, and `Edit Item`.
- [ ] iOS: swipe-back works on read-only/detail routes when opened from a list/settings screen.
- [ ] iOS/Android: unsaved edit/create flows block accidental exit and show discard confirmation.
- [ ] iOS/Android: loading, error, and content states keep consistent top alignment.
- [ ] iOS/Android: no navigation dead-ends when entering screens directly (fallback back buttons visible when needed).
- [ ] iOS/Android: Home, Items, Export, and Settings root scenes use the same background tone.
- [ ] iOS: top/bottom overscroll bounce does not flash a different background on tab root screens.
