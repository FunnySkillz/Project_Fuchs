# Fuchs - App

A privacy-first mobile application for Austrian employees to organize, calculate, and export purchase evidence for the annual Arbeitnehmerveranlagung (Steuerausgleich).

This app runs fully offline.
No backend. No forced cloud. No data collection.

## Vision

Make tax-relevant purchase tracking simple, structured, and audit-ready.

Instead of:
- Digging through emails
- Searching for receipts
- Recalculating mixed-use percentages manually
- Guessing depreciation

You:
- Capture receipts
- Enter structured data
- Get clear deduction estimates
- Export a clean PDF or ZIP package

## Core Principles

- Local-first architecture
- No user account required
- No data leaves the device unless explicitly exported
- Deterministic calculations
- Explicit tax assumptions (transparent, configurable)
- Strong test coverage (unit + integration + workflow tests)

## Tech Stack

- React Native (Expo)
- TypeScript (strict mode)
- NativeWind (Tailwind for RN)
- SQLite (expo-sqlite)
- Local file storage (expo-file-system)
- Jest + React Native Testing Library
- Optional: OneDrive OAuth for export-only

## Features (V1)

### Profile Setup

- Tax year default
- Marginal tax rate
- GWG threshold (default 1.000 EUR)
- Optional half-year depreciation rule
- Default mixed-use percentage

### Item Management

- Capture receipt photo
- Upload PDF receipt
- Add additional product photos
- Store:
  - Product name
  - Purchase date
  - Price (stored as cents)
  - Category
  - Usage type (`WORK` / `PRIVATE` / `MIXED`)
  - Work percentage
  - Warranty duration
  - Notes for Finanzamt

### Deduction Estimation

- Mixed-use calculation
- GWG threshold handling
- Useful life (default 36 months for Laptop/Computer)
- Optional half-year rule
- Estimated refund impact (based on marginal rate)

### Inventory View

- Filter by:
  - Year
  - Category
  - Usage type
  - Missing receipt
  - Missing notes
- Search by title/vendor
- View detailed breakdown

### Export

- Generate PDF summary
- Generate ZIP (PDF + receipts/photos)
- Optional upload to OneDrive
- Export history tracking

## Architecture Overview

### Local-First Data Model

SQLite schema includes:
- ProfileSettings
- Category
- Item
- Attachment
- ExportRun

All tables:
- Use UUID primary keys
- Store money as INTEGER cents
- Include CreatedAt, UpdatedAt
- Support soft-delete via DeletedAt
- Use foreign keys + indexes
- UpdatedAt enforced via DB triggers

### Domain Layer

Pure logic:
- Calculation engine
- Money parsing
- Validation rules

Testable without React Native runtime.

### Repository Layer

Typed data access:
- ItemRepository
- CategoryRepository
- AttachmentRepository
- ExportRunRepository

Soft-delete strategy enforced at repository level.

### File Handling

- Files copied into app sandbox
- Thumbnails generated for images
- Attachments deleted on item delete
- No external references

## Tax Logic (Austrian Context)

This app provides structured guidance, not legal advice.

Supported in V1:
- GWG threshold (default 1.000 EUR)
- Immediate deduction below threshold
- AfA (depreciation) above threshold
- Default 3-year useful life for computers
- Optional half-year rule
- Mixed-use percentage handling
- Estimated refund impact via marginal tax rate

Users remain responsible for final tax declaration.

## Testing Strategy

This project does not rely on shallow tests.

### 1. Unit Tests

- Money parsing and formatting
- Calculation engine (GWG, mixed use, schedule)
- Validation rules

Pure, deterministic, fast.

### 2. Integration Tests

- SQLite migrations
- Trigger behavior (UpdatedAt)
- Soft delete + restore
- File storage lifecycle
- Export generation (PDF + ZIP)

Real SQLite + temp filesystem.

### 3. Workflow Tests

Using React Native Testing Library:
- Add item happy path
- Cancel flow (no orphan files)
- Validation errors
- Delete flow
- Filter logic
- Settings update recalculation

No full e2e, but realistic UI workflow coverage.

## Project Structure

```text
app/
  routes and screens

src/
  domain/
  db/
  repositories/
  services/
  models/
  components/
  utils/

tests/
  unit/
  integration/
  workflow/
```

## Development

Install dependencies:

```bash
npm install
```

Run app:

```bash
npx expo start
```

Run tests:

```bash
npm test
```

Build preview:

```bash
eas build --profile preview
```

## Security & Privacy

- No backend
- No tracking
- No analytics
- No automatic cloud sync
- Optional OneDrive export requires explicit user action
- App lock (biometric or PIN) supported
- All sensitive data remains on device unless exported by user

## Roadmap (Post V1)

- OCR for receipts (offline or paid cloud)
- Multi-device encrypted sync
- Accountant export templates
- Advanced category depreciation presets
- Export directly formatted for FinanzOnline upload
- Backup/restore assistant

## Non-Goals (V1)

- Direct tax filing
- Legal tax advice
- Automatic OCR extraction
- SaaS cloud storage
- Multi-user accounts

## Philosophy

This is not a flashy fintech startup app.

This is:
- Structured
- Predictable
- Transparent
- Built like proper software

Local-first. Typed. Tested. Controlled.
