"""Build a temporary, local-only browser fixture. Remove with --clean before publishing."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2]
dist=root/'dist'
names=['__tone.mp4','__retry-qa.js','__retry-app.html','__retry.html','__retry-parent.js']
if '--clean' in sys.argv:
    for name in names:
        (dist/name).unlink(missing_ok=True)
else:
    (dist/'__retry-qa.js').write_text((root/'tests/browser/recording-retry.js').read_text())
    (dist/'__retry-app.html').write_text((dist/'index.html').read_text().replace('</head>','<script src="/__retry-qa.js" defer></script></head>'))
    (dist/'__retry.html').write_text('<!doctype html><html><body><button id="run" style="display:block">Run recording retry audit</button><pre id="report" style="position:fixed;left:790px;top:0;max-height:90vh;overflow:auto;font-size:10px;max-width:550px;white-space:pre-wrap"></pre><iframe id="app" src="/__retry-app.html" style="width:756px;height:1126px"></iframe><script src="/__retry-parent.js"></script></body></html>')
    (dist/'__retry-parent.js').write_text("document.getElementById('run').onclick=()=>document.getElementById('app').contentWindow.runRecordingAudit();")
