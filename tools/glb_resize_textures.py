#!/usr/bin/env python3
"""Make a mobile copy of a GLB with smaller embedded textures. The source file is never modified.

    python3 tools/glb_resize_textures.py SOURCE.glb OUTPUT.glb [--max 1024] [--quality 90]

Only the embedded images are re-encoded (high-quality Lanczos downscale, same format: JPEG stays JPEG,
PNG stays PNG). Geometry, UVs, materials, nodes and every other byte range are copied unchanged; the
binary buffer is rebuilt with the new image sizes and 4-byte alignment.
Requires Pillow.
"""
import argparse, io, json, struct, sys
from PIL import Image

def read_glb(path):
    b = open(path, 'rb').read()
    magic, ver, _ = struct.unpack('<III', b[:12])
    if magic != 0x46546C67 or ver != 2: sys.exit(f'{path}: not a glTF 2.0 .glb file')
    off, js, bin_ = 12, None, b''
    while off + 8 <= len(b):
        ln, typ = struct.unpack('<II', b[off:off + 8]); data = b[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A: js = json.loads(data.decode('utf8').rstrip('\0 '))
        elif typ == 0x004E4942: bin_ = data
        off += 8 + ln
    return js, bin_

def pad4(n): return (4 - n % 4) % 4

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--max', type=int, default=1024); ap.add_argument('--quality', type=int, default=90)
    a = ap.parse_args()
    js, bin_ = read_glb(a.src)
    if len(js.get('buffers', [])) != 1: sys.exit('expected exactly one buffer')
    new_views = {}  # bufferView index -> replacement bytes
    for i, img in enumerate(js.get('images', [])):
        if 'bufferView' not in img: continue
        bv = js['bufferViews'][img['bufferView']]; o = bv.get('byteOffset', 0)
        im = Image.open(io.BytesIO(bin_[o:o + bv['byteLength']])); fmt = im.format
        w, h = im.size; k = a.max / max(w, h)
        if k >= 1: print(f'image {i} {img.get("name", "")}: {w}x{h} already within {a.max}, kept'); continue
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        small = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') and fmt == 'PNG' else 'RGB').resize((nw, nh), Image.LANCZOS)
        out = io.BytesIO()
        if fmt == 'JPEG': small.save(out, 'JPEG', quality=a.quality, subsampling=0, optimize=True)
        else: small.save(out, 'PNG', optimize=True)
        new_views[img['bufferView']] = out.getvalue()
        print(f'image {i} {img.get("name", "")}: {w}x{h} {fmt} {bv["byteLength"]/1048576:.2f} MB -> {nw}x{nh} {len(out.getvalue())/1048576:.2f} MB')
    # rebuild the binary buffer in the original bufferView order, 4-byte aligned
    chunks, pos = [], 0
    for i, bv in enumerate(js['bufferViews']):
        o = bv.get('byteOffset', 0); data = new_views.get(i, bin_[o:o + bv['byteLength']])
        p = pad4(pos); chunks.append(b'\0' * p); pos += p
        bv['byteOffset'] = pos; bv['byteLength'] = len(data); chunks.append(data); pos += len(data)
    chunks.append(b'\0' * pad4(pos)); new_bin = b''.join(chunks)
    js['buffers'][0]['byteLength'] = len(new_bin)
    jb = json.dumps(js, separators=(',', ':')).encode('utf8'); jb += b' ' * pad4(len(jb))
    total = 12 + 8 + len(jb) + 8 + len(new_bin)
    with open(a.out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack('<II', len(new_bin), 0x004E4942)); f.write(new_bin)
    print(f'wrote {a.out}: {total/1048576:.2f} MB')

if __name__ == '__main__': main()
