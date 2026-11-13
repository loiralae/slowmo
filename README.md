# SlowMo

A lightweight, client-side video player for dance practice. Built for iPad mini, with a lilac-purple interface and controls that stay available in the immersive player.

**[Open SlowMo](https://slowmo-cindy.creamspool17.chatgpt.site/)** · **MIT licensed**

Source synchronized with deployed SlowMo v20 (November 12, 2026). Camera startup improvements are covered by automated and synthetic-browser checks; physical iPad verification remains required.

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

The current snapshot includes 161 passing automated tests. They cover timeline mapping, short takes, media cancellation, Retry/startup ordering, storage races, export failures, camera orientation and presentation logic. See [the browser test instructions](tests/browser/README.md) for a synthetic camera/recording fixture that exercises real browser media APIs.

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
