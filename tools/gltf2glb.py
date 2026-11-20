# Pack a .gltf (+ one .bin) into a .glb, keeping image URIs external (textures served next to the models)
import json, struct, sys, os
def pack(src, dst, img_prefix=''):
    j = json.load(open(src)); d = os.path.dirname(src)
    assert len(j['buffers']) == 1
    b = open(os.path.join(d, j['buffers'][0]['uri']), 'rb').read()
    j['buffers'] = [{'byteLength': len(b)}]
    for im in j.get('images', []):
        if 'uri' in im: im['uri'] = img_prefix + os.path.basename(im['uri'])
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    b += b'\0' * ((4 - len(b) % 4) % 4)
    open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(b)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(b), 0x004E4942) + b)
    return os.path.getsize(dst)
if __name__ == '__main__':
    print(pack(sys.argv[1], sys.argv[2]))
