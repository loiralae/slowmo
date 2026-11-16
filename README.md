# SlowMo

A lightweight, client-side video player for dance practice. Built for iPad mini, with a lilac-purple interface and controls that stay available in the immersive player.

**[Open SlowMo](https://slowmo-cindy.creamspool17.chatgpt.site/)** · **MIT licensed**

Source synchronized with deployed SlowMo v29 (November 15, 2026). The camera preview now copies the complete decoded frame into a bounded display-only canvas, preserving its actual proportions. The encoder still records the original camera track. Default front-camera selfie mirroring is preserved; physical iPad rendering/performance still requires verification.

## What it does

- Open videos directly through the browser's native Photos/file picker; no server uploads.
- Adjust speed from 0.25× to 2× in 0.05× steps, with presets and a saved speed preference.
- Use A/B loops, draggable boundaries, loop countdowns, saved practice sections, mirroring and double-tap seeking.
- Compare reference and practice videos with independent manual sync points, ±0.1-second alignment, shared controls and drift correction.
- Practice from memory with reference audio, optionally record your camera, then review automatically aligned takes or retry.
- Show or hide the reference beside the camera while recording.
- Export synchronized comparisons locally with reference audio when supported.
- Install on the Home Screen as a PWA.

## Run locally

There are no runtime dependencies or build step. Serve **`dist/` as the web root**:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Camera access and service workers need a secure context: localhost works for local development; testing on an iPad over your LAN requires HTTPS. Paths currently assume an origin-root deployment, not a GitHub Pages project subdirectory.

## Test

Requires Node.js 20 or later:

```sh
npm test
```

The current snapshot includes 214 passing automated tests. They cover timeline mapping, short takes, media cancellation, Retry/startup ordering, storage races, export failures, camera orientation and presentation logic. See [the browser test instructions](tests/browser/README.md) for a synthetic camera/recording fixture that exercises real browser media APIs.

Automated tests and desktop browser tests do not establish physical iPad camera, encoder, audio, full-screen or Share Sheet behavior. Test media changes on a real device.

## Code map

| File | Responsibility |
| --- | --- |
| `dist/app.js` | Single-video playback, speed, gestures, loops, viewport and immersive presentation |
| `dist/practice.js` | Comparison, memory practice, camera sessions, recording, review and Retry |
| `dist/timeline.js` | Shared timeline, offsets/scales and drift decisions |
| `dist/media.js` | Cancellable media waits, seeks and coordinated playback |
| `dist/camera.js` | Camera framing, orientation normalization and frame readiness |
| `dist/audio.js` | Reference soundtrack routing and local recording audio |
| `dist/export.js` | Client-side comparison composition, encoding and sharing |
| `dist/sections.js` | Video fingerprints and saved sections |
| `dist/takes.js` | Local recording storage in IndexedDB |
| `dist/sw.js` | Offline application shell caching |

The app uses plain HTML, CSS and JavaScript. `dist/` is the editable source directory, not generated/minified build output. Most automated tests run application code in controlled media/DOM environments; encoder fakes test failure handling rather than codec fidelity.

## Privacy and storage

Selected videos remain local browser object URLs. Recorded takes and section bookmarks use local browser storage; original selected videos are not duplicated into storage merely to save bookmarks. No backend processing, account, analytics or external video storage is required by the app.

Browser storage can be cleared or evicted. Export recordings you want to keep. A Share Sheet cannot guarantee that the user chose Photos; saving directly into Photos without a system share action is not assumed.

## Platform limits

- Video codecs depend on the browser/device. MOV and HEVC are supported only where the browser can decode them.
- Container full-screen is requested when available. Standalone iPad webviews may retain system UI; the immersive fallback fills the available viewport and respects safe areas.
- Browser recording and export codecs vary; MP4 is preferred when supported, otherwise a compatible WebM option is used.
- Recording uses one pass at a fixed practice speed to retain a linear time mapping. Startup/encoder lead-in is included in comparison timing; manual fine-tuning remains available for device latency.
- Export happens in real time and has duration/memory limits. Keep the app visible.
- Audio processing and camera capture can behave differently on physical iPad hardware. An advisory Web Audio latency hint is not a guaranteed Safari audio fix.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Fork the repository, commit to a branch and open a pull request. Maintainers may separately grant collaborator write access.

The existing live app is hosted separately. Publishing this repository does **not** enable automatic production deployment from GitHub. Maintainers must review and explicitly publish updates to the live site.

## License

[MIT](LICENSE). This covers the application code and included app icons. No user recordings or reference videos are included or licensed by this repository.

## v25 camera preview correction

The v24 orientation-normalized native display stretched the image on a real iPad; that approach is removed. Preview sizing no longer guesses camera axes from device orientation or uses object-fit:fill. A display-only canvas copies the complete decoded frame at its reported aspect ratio, bounded to 960 pixels on its longest edge. It uses a single animation loop capped at 30 redraws/second, skips unchanged frame times, and is stopped/removed on camera release. CSS contain-fitting centers the complete image within either pane. Mirroring affects only the displayed image.

The canvas is never captured, encoded or supplied to MediaRecorder. Saved video continues to use the original getUserMedia track with existing soundtrack and synchronization logic. Fresh native elements remain in use for each camera setup/Retry. A failed canvas draw exposes the native display fallback.

Tests include portrait, landscape and 4:3 frame proportions, a round pixel target to detect stretch, display cleanup, mirroring, capture-track identity, recording/retry and layout changes. Desktop synthetic-camera tests cannot establish physical iPad performance or native frame metadata. Close/reopen the updated app, test portrait Side by Side, Hidden, Retry and a separate landscape take; check the saved file remains smooth. Good to know → Copy layout report identifies v25 and includes preview pixel dimensions and draw count if a problem remains.

## v26: continuous rotation and adaptive recording panes

Rotating no longer deliberately stops a take. Native camera resize events redraw the preview and update layout without replacing the camera track, encoder, audio capture or session clock. Startup readiness accepts stable fresh frames at the current dimensions instead of waiting for the original dimensions to return. Hardware/encoder errors, actual media interruptions and normal take limits still stop recording.

Portrait guided recording keeps equal left/right panes. Landscape distributes width according to the reference and camera aspect ratios (with a 20% minimum per pane), maximizing their common fitted image height without cropping. A portrait reference with a wide camera gets approximately 24%/76% rather than 50%/50%; equal-aspect videos remain equal width. This changes layout only, not camera pixels or saved footage. The v25 aspect-preserving preview and direct native recording path remain.

Physical iPad test: reopen v26, start in portrait, rotate to landscape and back while recording, then Stop. Confirm the timer/music never restart, preview stays correctly proportioned and mirrored, and the saved take plays continuously across both rotations in SlowMo and Photos/Files. Native Safari MP4 orientation metadata and Home Screen behavior require this device test; desktop simulations cannot establish them.

## v27: reference-first landscape recording

Landscape guided recording prioritizes the reference video: its pane gets enough width to show the full available height, while the camera preview fits in the remaining space. Both keep their original aspect ratios. The existing 20% minimum pane width prevents either view becoming unusable for extreme video shapes; portrait remains equal left/right. For a 9:16 reference in a 1126×756 viewport, the reference is 425.25×756 instead of being reduced to match a wide camera image's height.

This is a display-layout adjustment. v26 continuous rotation, original-track recording, soundtrack, sync and v25 aspect-preserving selfie preview are unchanged. 192 automated tests pass, and a synthetic guided browser take verified the full-height reference and undistorted camera. Real iPad safe-area behavior requires device verification after reopening the updated app.

## v28: unobstructed playback

In the immersive/full-screen player, controls hide after 3 seconds of active playback. Tap the picture once to pause or resume; the paused player also offers a large central Play button. Double-tap left/right retains configurable skipping. Show controls reveals speed and loop settings without pausing. Paused media, slider drags, keyboard control interaction, open dialogs and recording preparation/takes keep their dedicated controls visible.

208 automated tests cover the current regression suite, including control timer/gesture races. The local browser control audit additionally checks real decoded playback at custom speeds with an A/B loop. Physical iPad Safari/Home Screen touch dispatch and fullscreen behavior still require device verification.

## v29: prioritize video startup

Video selection performs one media load and initiates Play before the fullscreen request. Saved-section fingerprint reads and database lookups start only when Sections is opened; the same fingerprint format preserves existing bookmarks. Normal playback without a Web Audio source skips the unnecessary audio-resume wait. Previously routed reference sound still resumes before playback. 214 regression tests pass, and the local browser audit checks playback starts with zero bookmark reads, then matches sections on demand. Photos/iCloud preparation and actual iPad codec/I/O latency require device testing; no device speedup is claimed from synthetic desktop timing.
