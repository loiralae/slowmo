# Contributing to SlowMo

1. Fork the repository and create a branch for your change.
2. Serve `dist/` at the origin root and make the smallest focused change.
3. Run `npm test`. Add a regression test for behavioral fixes, especially asynchronous playback/recording changes.
4. Open a pull request explaining the problem, resulting behavior, tests and device verification.

Preserve the simple workflow, current name/icon/lilac theme, large touch targets and compact overlays. Preserve source video aspect ratios and existing playback/loop/sync behavior. All media processing must remain local. Do not add analytics, uploads, accounts, subscriptions or cloud video processing.

For playback, audio, camera, orientation or full-screen changes, verify on a real iPad in both a browser tab and a Home Screen web app. Check portrait and landscape, short/early-stopped recordings, repeated Retry, reference Hidden/Side-by-Side, 0.65× playback, review, export and cancellation. Explain which device cases you could not test.

Use synthetic media for fixtures. Never commit personal footage, tokens, environment files, production hosting identifiers or private workspace notes. The optional browser fixture generates temporary `dist/__*` files; remove them with its cleanup command before any deployment.

Edits to application-shell assets should also advance the service worker cache name in `dist/sw.js`. Existing users can have old pages open, so keep startup/script order and cache behavior in mind.

GitHub commits and merged pull requests do not automatically deploy the existing live site. Production publication is a separate maintainer step.
