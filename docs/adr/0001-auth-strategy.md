# ADR 0001: Identity and Authentication Strategy for V1 (Local-First)

- Status: Accepted
- Date: 2026-02-28
- Decision Makers: Project maintainers

## Context

SteuerFuchs V1 is defined as a local-first mobile application focused on private, offline handling of tax-relevant data. The team needs a clear boundary for identity and authentication to avoid introducing unnecessary backend scope, account complexity, and privacy risk.

Requirements for V1:

- Keep data local on device by default.
- Avoid mandatory online identity providers.
- Support basic privacy protection for device access.
- Allow optional cloud integration only for explicit export/backup actions.

## Decision

For V1, the identity/authentication strategy is:

1. No app account login (no email/password, no mandatory OAuth, no backend identity service).
2. Identity is local-only via on-device Profile + Settings.
3. Optional App Lock is supported for privacy (biometric and/or PIN, based on platform capabilities).
4. Optional OneDrive OAuth is supported only for export/backup workflows.

## Confirmed Flows

### 1. Local Profile Setup

- User opens app and configures profile/settings locally (tax year, marginal tax rate, defaults).
- Data is stored on device only (local database/storage).
- App functions fully without network connectivity.

### 2. App Lock (Optional)

- User can enable app lock in settings.
- Unlock uses biometric prompt where available, with PIN fallback if configured.
- Failed unlock blocks access to app content until successful unlock.
- App lock state/config is stored locally.

### 3. OneDrive Connect/Disconnect (Optional)

- User explicitly initiates "Connect OneDrive" from export/backup-related settings.
- OAuth token is used only for export/backup actions.
- Core app usage (item tracking, calculations, local exports) remains available without OneDrive.
- User can disconnect OneDrive at any time, revoking local usage of token and returning to local-only mode.

## Consequences

### Positive

- Lower implementation complexity for V1.
- Strong alignment with privacy-first positioning.
- Reduced legal/compliance surface from avoiding account infrastructure.
- Better offline reliability.

### Tradeoffs

- No cross-device identity/session sync in V1.
- Recovery is device-dependent unless user exports/backs up.
- Future cloud sync requires a new ADR and scoped V2+ architecture decisions.

## Out of Scope for V1

- Multi-user accounts
- Backend-managed auth sessions
- Mandatory cloud sync
- Federated login beyond optional OneDrive export/backup integration

