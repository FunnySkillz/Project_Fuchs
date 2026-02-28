# ADR 0002: V1 Scope and Non-Goals

- Status: Accepted
- Date: 2026-02-28
- Decision Makers: Project maintainers

## Context

The project needs a strict V1 feature boundary so implementation can move quickly without scope creep.
This ADR defines what is in scope for V1 and what is explicitly out of scope.

## Decision

### In Scope (V1)

- Local-first storage (SQLite + local files)
- Manual entry (no OCR)
- Receipt/photo attachments
- Item list + detail + edit
- Deduction estimation (GWG threshold + AfA splitting)
- PDF export + optional ZIP with attachments

### Out of Scope (V1)

- OCR
- Cloud sync (except OneDrive export)
- Backend
- Tax filing submission

## Consequences

### Positive

- Faster implementation and delivery cadence
- Reduced architecture risk in early milestones
- Better testability and deterministic offline behavior

### Tradeoffs

- Some automation and sync features are postponed to post-V1 work
- Users must perform manual data entry in V1

## Follow-up

- Revisit and revise this boundary in a future ADR when planning V2+ cloud sync and OCR.
