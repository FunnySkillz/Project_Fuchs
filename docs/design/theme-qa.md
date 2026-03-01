# Theme QA Checklist

Last updated: 2026-03-01

## Global Rules

- [x] No hardcoded hex colors in app screens.
- [x] Light and dark mode both use shared theme tokens.
- [x] Border contrast remains visible in dark mode for cards and form controls.
- [x] Destructive actions are readable but visually restrained (outline-first where possible).

## Shared Components

- [x] `src/components/ui/input.tsx`: placeholder + focus state readable in light/dark.
- [x] `src/components/ui/text-area.tsx`: placeholder + focus state readable in light/dark.
- [x] `src/components/ui/select.tsx`: selected option + search input focus state readable in light/dark.

## Screen QA

- [x] Home: card borders readable in light/dark.
- [x] Items List: filter chip selected states use high-contrast selected style in dark mode.
- [x] Add Item Step 1: error, warning badges, and action buttons remain readable in dark mode.
- [x] Add Item Step 2: usage chips and validation messages readable in both modes.
- [x] Item Detail: attachment states (normal/missing) remain readable in both modes.
- [x] Export: filter chips selected states use high-contrast selected style in dark mode.
- [x] Settings: theme selector + danger zone readability verified in light/dark.

## Manual QA Notes

- Verify on device/emulator with `mode = light` and `mode = dark` from Settings.
- Confirm selected filter chips are distinguishable from unselected chips on Items and Export.
- Confirm focused text inputs show clear focus border in edit/add forms.
