# Minimal OBJ+MTL -> GLB converter (positions, normals, one primitive per material, flat Kd colours)
import sys, struct, json, os
def conv(obj, out, scale=1.0):
    d = os.path.dirname(obj); V=[]; VN=[]; prims={}; cur='default'; mtl={}; mtlfile=None
    for line in open(obj):
        p=line.split()
        if not p: continue
        if p[0]=='mtllib': mtlfile=os.path.join(d,' '.join(p[1:]))
        elif p[0]=='v': V.append([float(x)*scale for x in p[1:4]])
        elif p[0]=='vn': VN.append([float(x) for x in p[1:4]])
        elif p[0]=='usemtl': cur=p[1]
        elif p[0]=='f':
            idx=[]
            for t in p[1:]:
                s=t.split('/'); vi=int(s[0]); ni=int(s[2]) if len(s)>2 and s[2] else 0
                idx.append((vi-1 if vi>0 else len(V)+vi, (ni-1 if ni>0 else len(VN)+ni) if ni else None))
            for k in range(1,len(idx)-1):
                prims.setdefault(cur,[]).extend([idx[0],idx[k],idx[k+1]])
    if mtlfile and os.path.exists(mtlfile):
        name=None
        for line in open(mtlfile):
            p=line.split()
            if not p: continue
            if p[0]=='newmtl': name=p[1]; mtl[name]=[.8,.8,.8]
            elif p[0]=='Kd' and name: mtl[name]=[float(x) for x in p[1:4]]
    import math
    buf=bytearray(); views=[]; accs=[]; meshprims=[]; mats=[]
    for mi,(m,tris) in enumerate(prims.items()):
        pos=[]; nor=[]
        for t in range(0,len(tris),3):
            a,b,c=[V[tris[t+i][0]] for i in range(3)]
            if any(tris[t+i][1] is None for i in range(3)):
                u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
                n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; l=math.sqrt(sum(x*x for x in n)) or 1; n=[x/l for x in n]; ns=[n,n,n]
            else: ns=[VN[tris[t+i][1]] for i in range(3)]
            pos+= [a,b,c]; nor+=ns
        for arr,typ in ((pos,'POSITION'),(nor,'NORMAL')):
            off=len(buf)
            for p3 in arr: buf+=struct.pack('<3f',*p3)
            views.append({'buffer':0,'byteOffset':off,'byteLength':len(arr)*12,'target':34962})
            acc={'bufferView':len(views)-1,'componentType':5126,'count':len(arr),'type':'VEC3'}
            if typ=='POSITION': acc['min']=[min(p[i] for p in arr) for i in range(3)]; acc['max']=[max(p[i] for p in arr) for i in range(3)]
            accs.append(acc)
        meshprims.append({'attributes':{'POSITION':len(accs)-2,'NORMAL':len(accs)-1},'material':mi})
        kd=mtl.get(m,[.8,.8,.8])
        mats.append({'name':m,'pbrMetallicRoughness':{'baseColorFactor':kd+[1],'metallicFactor':0,'roughnessFactor':.85}})
    gl={'asset':{'version':'2.0','generator':'obj2glb'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':os.path.basename(obj)[:-4]}],
        'meshes':[{'primitives':meshprims}],'materials':mats,'accessors':accs,'bufferViews':views,'buffers':[{'byteLength':len(buf)}]}
    js=json.dumps(gl,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4); buf+=b'\0'*((4-len(buf)%4)%4)
    out_b=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(buf))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(buf),0x004E4942)+bytes(buf)
    open(out,'wb').write(out_b)
    mn=[min(v[i] for v in V) for i in range(3)]; mx=[max(v[i] for v in V) for i in range(3)]
    return len(out_b), [round(mx[i]-mn[i],2) for i in range(3)], list(mtl.keys())
if __name__=='__main__':
    print(conv(sys.argv[1], sys.argv[2]))
