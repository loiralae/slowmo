# Local browser recording regression

This fixture uses real media decoding, Web Audio, MediaRecorder and IndexedDB, with a synthetic camera (no hardware permission, personal files or media uploads). Run only in a local development preview; do not publish its generated files.

Generate the reference fixture from the repository root:

```sh
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=360x640:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 14 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac dist/__tone.mp4
python tests/browser/prepare-recording-qa.py
```

Start the supported local preview, open `/__retry.html` and click **Run recording retry audit**. It records four attempts, including repeated/double-tapped Retry, 0.65x and 1x, a longer take and an early stop. It decodes each saved soundtrack, scans 10 ms RMS windows for unexpected silence in the continuous test tone, and compares audio onset against the automatic time mapping. It also verifies review playback and preservation of the immersive player. Browser throttling can add preparation time; that lead-in must remain part of the recorded clock and alignment.

The test creates disposable synthetic recordings in the local preview origin's IndexedDB. It does not touch the production origin or its recordings. A synthetic camera and a continuous tone cannot establish real iPad camera/encoder performance, speaker/Bluetooth latency, or absence of audible artifacts in music on physical hardware.

Before publishing:

```sh
python tests/browser/prepare-recording-qa.py --clean
```

The native-camera audit requires Chrome's test-only `MediaStreamTrackGenerator` and `VideoFrame` support. It injects steady synthetic camera pictures independently of page rendering callbacks, then records them through the real MediaRecorder. This avoids testing a compositor-throttled canvas source as if it were camera hardware. No generator or barcode code runs in the application itself. The old camera-copy constructor is deliberately disabled; all recording attempts must use the original injected camera track directly.

The audit tests a legacy saved mirror preference of off: front-camera setup and each Retry must still start mirrored. It plays each saved file to check dimensions and decoded frame cadence, then checks saved audio and automatic comparison. Browser frame callbacks may be coalesced in a remote browser; decoded frame counts and callback-observed picture changes are reported separately.

Download **Download recorded motion QA** after completion, then independently check encoded motion with:

```sh
python3 tests/browser/inspect-recording.py /absolute/path/to/download.mp4 --orientation portrait
```

The script decodes every frame with FFmpeg and reads the test-only binary marker. It requires at least 20 distinct moving pictures per second, so a file full of duplicated pictures cannot pass based on its nominal frame rate. Run `/__retry.html?landscape=1&faults=1` for landscape camera pixels with the former canvas processing disabled, and inspect that downloaded file using `--orientation landscape`. The test fixture's embedded player viewport remains portrait; the landscape case validates camera encoding and fitting, not physical device rotation.

Native camera presentation checks assert that framing uses no canvas overlay or second video decoder, the camera remains full-size during takes, and selfie mirroring occurs exactly once. Use `/__retry.html?framing=1` for visual inspection. On iPad, check smooth live and saved motion, front/rear cameras, portrait/landscape, reference shown/hidden, repeated Retry, reference audio and the Home Screen app. Encoding uses native camera dimensions after initial frames arrive. Rotate before a take; a camera dimension change ends the take with an explanation instead of silently altering its picture. Synthetic tests do not establish hardware camera/encoder latency, recording-format support or device-specific orientation metadata.

For camera-pane sizing, open `/__retry.html?layout=1` and run the audit. It checks 30 combinations: portrait/landscape viewport sizes, setup and recording, reference Hidden/Side-by-Side, safe-area values, and stale aspect-ratio variables. The camera element must fill its pane with `object-fit: contain`; an extra inner rectangle must not shrink it. Recording identity must remain unchanged through layout changes. A synthetic live recording remains briefly visible after completion for screenshot inspection. This is browser layout coverage, not a physical iPad rendering test.
