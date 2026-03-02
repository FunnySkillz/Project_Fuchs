# Preview Auto Deploy From `main`

This project is configured to publish an EAS preview update on every push to `main`.

## What is automated

- Workflow: `.github/workflows/preview-update-on-main.yml`
- Trigger: `push` to `main` (and manual `workflow_dispatch`)
- Action: `eas update --channel preview --auto --non-interactive`
- Build profile channel: `preview` in `eas.json`
- Runtime strategy: `app.json > expo.runtimeVersion.policy = appVersion`

## One-time setup

1. Create an Expo access token (Expo account settings).
2. Add GitHub repository secret:
   - Name: `EXPO_TOKEN`
   - Value: your Expo access token

## Important behavior

- This workflow publishes OTA updates (JavaScript/assets) to the `preview` channel.
- A device only receives these updates if the installed binary is built for channel `preview`.
- Native code/config changes still require a new EAS Build and reinstall.

## First install / channel migration

If you previously installed a preview build without channel `preview`, install one fresh preview build after this change so your phone is pinned to the correct channel.
