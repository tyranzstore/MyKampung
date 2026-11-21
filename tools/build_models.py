# Rebuild assets/models.json from every .glb under assets/ (run from the project root)
import os, base64, json
out = {}
EXCLUDE = 'assets/packs'  # GLB packs load on demand from their own files (js/models.js loadPack); never base64 them here
for root, dirs, files in os.walk('assets'):
    r = root.replace(os.sep, '/')
    if r == EXCLUDE or r.startswith(EXCLUDE + '/'): dirs[:] = []; continue
    for f in files:
        if f.endswith('.glb'):
            p = os.path.join(root, f); out[p[len('assets/'):-4]] = base64.b64encode(open(p, 'rb').read()).decode()
open('assets/models.json', 'w').write(json.dumps(out, separators=(',', ':')))
print(len(out), 'models')
