# Laura's Linguistics — Android

An Expo Android app loading https://lauraslinguistics.base44.app with native Android dictation and text-to-speech. Separate app identity: `com.molious.lauraslinguistics`.

## Required before use

Publish the Laura's Linguistics Base44 checkpoint **Android native dictation and read aloud support** (`6acc8b07e5c6b3569ba28631`). The copies in `web-adapter/` document the changes already applied remotely. The APK alone cannot update the published website.

## Build

On Windows, follow START-HERE.txt and run BUILD-ANDROID.cmd. The Expo project is already registered and linked.

Manual alternative:

1. `npm ci`
2. `npm run typecheck && npm test`
3. Sign in with `npx eas-cli@latest login --device`.
4. The project is already linked; set `EAS_NO_VCS=1` if building without Git.
5. `npx eas-cli@latest build --platform android --profile preview`

The preview profile generates an installable APK; production generates an Android App Bundle. Signing keys stay with Expo. No credentials are included in this package.

## Behaviour

- Dictation starts only on a microphone tap. Android may end an utterance after silence; tap again to add more.
- Text appears while speaking. Tapping Stop requests the recognizer's final result. Capture is limited to 60 seconds per tap.
- Dictation and read aloud stop when the app leaves the foreground. No audio recording is saved by this code.
- Long results are read in sequential chunks rather than clipped to one Android utterance.
- The app needs internet for the hosted translator. Android's speech recognition provider may also process audio using its network service; offline speech recognition is not guaranteed.
- The web view only exposes the native bridge to the trusted main frame. Older Android System WebViews without frame-origin verification do not receive native speech services.
- No GPS features or location permissions are added.

## Verification

TypeScript check, Android JavaScript export, Android prebuild, and nine origin/voice lifecycle regression checks pass. Base44 changed-hook ESLint and frontend build pass. These are source checks, not a physical-device test.

On an Android phone, check microphone permission, dictation plus manual correction, translation, Listen/Stop on each section, long text, sign-in, background cancellation, and connection recovery. Expo login and project registration succeeded in the preparation workspace. Cloud build submission was blocked by its network policy; APK compilation and device testing remain unconfirmed.
