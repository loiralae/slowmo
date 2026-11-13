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

For the frozen-camera regression, open `/__retry.html?faults=1` and run the same audit. This deliberately repeats camera callback timestamps and injects a transient canvas drawing failure for each camera session; all four attempts must continue copying frames and produce reviewable recordings. This is a synthetic fault test, not a physical iPad test.
