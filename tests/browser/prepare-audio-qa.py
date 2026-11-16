"""Temporary local-only audio/repeat audit; requires generated dist/__tone.mp4."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2];dist=root/'dist'
names=['__audio.html','__audio-app.html','__audio-parent.js','__audio-qa.js','__tone.mp4']
if '--clean' in sys.argv:
    for name in names:(dist/name).unlink(missing_ok=True)
else:
    (dist/'__audio-qa.js').write_text((root/'tests/browser/audio-playback.js').read_text())
    (dist/'__audio-app.html').write_text((dist/'index.html').read_text().replace('</head>','<script src="/__audio-qa.js" defer></script></head>'))
    (dist/'__audio.html').write_text('<!doctype html><html><body><button id="run">Run audio and loop audit</button><pre id="report" style="position:fixed;left:790px;top:0;max-width:520px;font-size:12px;white-space:pre-wrap"></pre><iframe id="app" src="/__audio-app.html" style="width:756px;height:1126px"></iframe><script src="/__audio-parent.js"></script></body></html>')
    (dist/'__audio-parent.js').write_text("document.getElementById('run').onclick=()=>document.getElementById('app').contentWindow.runAudioAudit();")
