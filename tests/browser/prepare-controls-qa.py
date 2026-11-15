"""Temporary local-only player-control audit; requires generated dist/__tone.mp4."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2];dist=root/'dist'
names=['__controls.html','__controls-app.html','__controls-parent.js','__controls-qa.js','__tone.mp4']
if '--clean' in sys.argv:
    for name in names:(dist/name).unlink(missing_ok=True)
else:
    (dist/'__controls-qa.js').write_text((root/'tests/browser/player-controls.js').read_text())
    (dist/'__controls-app.html').write_text((dist/'index.html').read_text().replace('</head>','<script src="/__controls-qa.js" defer></script></head>'))
    (dist/'__controls.html').write_text('<!doctype html><html><body><button id="run">Run control audit</button><pre id="report" style="position:fixed;left:790px;top:0;max-width:520px;font-size:12px;white-space:pre-wrap"></pre><iframe id="app" src="/__controls-app.html" style="width:756px;height:1126px"></iframe><script src="/__controls-parent.js"></script></body></html>')
    (dist/'__controls-parent.js').write_text("document.getElementById('run').onclick=()=>document.getElementById('app').contentWindow.runControlAudit();")
