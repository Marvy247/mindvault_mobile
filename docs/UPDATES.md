# Over-the-air updates

MindVault Mobile uses [`expo-updates`](https://docs.expo.dev/updates/) to deliver
JS bundle updates between store releases. Updates are checked on app launch
without blocking startup.

## Channels

- `preview` — pre-production builds. Subscribes to the preview channel.
- `production` — store builds. Subscribes to the production channel.

The `runtimeVersion` policy is `appVersion`, so an update is only served when
the app version in `app.json` matches the build's runtime version. Bump
`expo.version` (and `package.json` version) for each store release to avoid
serving updates to incompatible builds.

## Rollback procedure

If a shipped update causes a regression:

1. Revert the offending commit on `main`.
2. Republish the previous channel update via EAS:
   ```sh
   npx eas update --channel production --group <previous-runtime-version>
   ```
   Or roll back the channel entirely:
   ```sh
   npx eas update:rollback --channel production
   ```
3. Store builds that already downloaded the bad update will fetch the rolled-back
   bundle on the next launch (checks happen on load).

Never force-push or rewrite published update assets. A rollback publishes a new
asset pointing at the previous bundle; clients pick it up automatically.

## Local development

Updates are disabled in Expo Go and in dev-client builds. They apply only to
release/preview builds made with EAS. To test an update locally, build with
`npx eas build --profile preview --platform android` (or `ios`) and publish to
the `preview` channel with `npx eas update --channel preview`.
