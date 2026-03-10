# SteuerFuchs Lessons Learned (V1)

Last updated: 2026-03-10

## Purpose

Capture recurring project struggles and convert them into concrete engineering rules for the next milestones.

## 1) Navigation Ownership Was Unclear

**Struggle**
- Some screens used native stack headers while others also rendered custom in-content headers.
- This created double top spacing, inconsistent back affordances, and visual drift across Item and Settings routes.

**Lesson learned**
- Header ownership must be explicit per screen type (native header vs custom header), never both.

**Action for future**
- Keep stack screens on native header by default.
- Only render custom headers when native header is intentionally disabled.
- Enforce this via design QA checklist updates before merging.

## 2) Swipe-Back and Unsaved-Changes Behavior Were Mixed Together

**Struggle**
- Read-only/detail screens and edit/create flows were initially treated similarly.
- This caused confusion around when swipe-back should work and when navigation must be blocked.

**Lesson learned**
- Read-only/detail routes should remain frictionless.
- Edit/create routes need explicit discard guards and should block accidental exits.

**Action for future**
- Classify every new route as `read-only` or `mutable` during implementation.
- Apply guard behavior only to mutable flows and keep gestures enabled for read-only flows.

## 3) Safe-Area and Inset Handling Drifted Across Screens

**Struggle**
- Different screens used different combinations of `SafeAreaView` edges and auto-inset behavior.
- Small differences produced noticeable iOS layout inconsistencies.

**Lesson learned**
- Spacing and inset ownership must be standardized and documented once.

**Action for future**
- Reuse the rules in `docs/design/navigation-layout-qa.md`.
- Treat top spacing regressions as release blockers during visual QA.

## 4) Export Destination Was Not Discoverable to Users

**Struggle**
- Exports were saved to app-local storage only, and users could not clearly find or open generated files.

**Lesson learned**
- File-producing features need explicit destination UX and a direct path to open/share output.

**Action for future**
- Keep local fallback storage, but always expose:
  - where the file is stored,
  - how to share/open it,
  - optional user-selected folder behavior where platform supports it.

## 5) Platform Differences Were Underestimated

**Struggle**
- Android and iOS differ significantly in file system permissions, directory picking, and back navigation UX.

**Lesson learned**
- Platform constraints should be part of initial design, not patch work after implementation.

**Action for future**
- Add platform capability checks during feature design.
- Define platform-specific acceptance criteria in QA checklists before coding.

## 6) UI Consistency Needed Earlier Alignment

**Struggle**
- Label/icon patterns (Edit text vs pencil icon, delete text vs trash icon, button styling) diverged between similar flows.

**Lesson learned**
- Reusable visual patterns reduce rework and improve trust.

**Action for future**
- Maintain a small UI pattern reference for high-frequency controls (header actions, primary/secondary/destructive buttons).
- Require visual QA across all analogous screens when changing one of them.

## 7) QA Timing Was Sometimes Too Late

**Struggle**
- Many spacing/navigation inconsistencies were discovered after several related screens had already diverged.

**Lesson learned**
- QA must be continuous, not a final pass only.

**Action for future**
- Run focused visual QA whenever touching navigation/layout primitives.
- Keep `docs/release/final-qa-hardware-checklist.md` and related design QA docs updated in the same PR as UI behavior changes.

## 8) Test Environment Drift Created Noise

**Struggle**
- Some suites required specific mocks (navigation hooks, CSS imports), and failures were not always tied to the feature being changed.

**Lesson learned**
- Stable test scaffolding is part of product velocity.

**Action for future**
- Maintain central test mocks for cross-cutting dependencies.
- Add a lightweight “test harness health” check when introducing new app-wide dependencies.

## Summary Rules We Keep

- Decide route behavior early: `read-only` vs `mutable`.
- Keep native header ownership single-source.
- Standardize safe-area and insets across stack screens.
- For exports/backups, always expose destination + open/share path.
- Treat cross-screen visual consistency as a system-level requirement.
