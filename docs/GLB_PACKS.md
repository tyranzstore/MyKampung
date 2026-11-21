# GLB asset packs

Add new 3D models to the game by uploading them to GitHub. You never need to send models to Claude.

New models are **not** placed in the village or mini-games automatically. Once a pack is indexed, its models are available
in code through the asset manager, so a scene can use them safely (see "Using a pack in code").

The existing 237 models (`assets/models.json`, `assets/models2.json`, `MODEL_FILES`) are unchanged and load exactly as before.

## 1. Prepare the files

- Format: binary glTF (`.glb`). Textures may be embedded, or separate `.png` / `.jpg` / `.webp` files placed next to
  the `.glb` exactly as your exporter referenced them (for example `Textures/colormap.png`). Keep those paths.
- **Do not use Draco, Meshopt or KTX2/Basis compression.** The game has no decoder for them; such files are rejected.
- Mobile budget per model (checked automatically, profile `packAsset` in `tools/check_glb.mjs`):

  | | Target | Maximum |
  |---|---|---|
  | File size | 2 MB | 8 MB |
  | Triangles | 20,000 | 60,000 |
  | Draw calls (mesh primitives) | 10 | 40 |
  | Materials | 8 | 24 |
  | Textures | longest side 1024 px | 2048 px, at most 12 images |
  | Texture memory on the GPU | 16 MB | 48 MB |

- Any size and orientation is accepted: the game centres each model, puts its base on the ground and scales it in code.

## 2. Upload through the GitHub website

1. Open the repository on github.com and go to the folder **`assets/packs`**.
2. Click **Add file → Upload files**.
3. Drag your pack **folder** (for example `pasar_props/`) into the page. Dragging the folder keeps its subfolders and
   texture files. The folder name becomes the **pack id**: use letters, digits, `_`, `-` or `.` only, no spaces.
4. Under "Commit changes", choose **Create a new branch** (recommended) and click **Propose changes**, then open the pull request.
   You can also commit straight to a branch you are working on.
5. Wait about a minute. The **GLB packs** workflow (Actions tab) then:
   - checks every `.glb` file;
   - writes `assets/packs/index.json` and commits it to your branch ("Update assets/packs/index.json [GLB packs]");
   - turns red, with the reason, if a model is invalid. Invalid models stay in the index with `"valid": false`,
     and the game skips them.
6. Fix any red items, upload again, and merge the pull request when it is green.

To remove a pack, delete its folder in the same way. The workflow drops it from the index.

## 3. Optional: names, categories, scale and rotation

Add a `pack.json` file inside the pack folder. Every field is optional:

```json
{
  "name": "Pasar props",
  "category": "props",
  "models": {
    "Stall_A":        { "id": "pasar/stall", "category": "market", "scale": 0.01, "rotation": [0, 90, 0] },
    "crates/Crate_1": { "category": "market" }
  }
}
```

- Keys under `models` are the file path inside the pack, without `.glb`.
- `id`: defaults to `<pack id>/<file path without .glb>`, for example `pasar_props/crates/Crate_1`.
  Ids must be unique, in any letter case, and must not equal an existing game model key (for example `palm1` or `city/Car`).
  Clashes are rejected.
- `category`: defaults to the first subfolder name, then to the pack's `category`, then to `misc`.
- `scale`: a number, applied before the model is measured (useful for files exported in centimetres).
- `rotation`: `[x, y, z]` in **degrees**, applied before measuring. The game expects models to face +Z.

## 4. Using a pack in code

```js
import { loadModels, loadPack, getModel, unloadPack, putModel } from './models.js';

const M = await loadModels();               // legacy models, as today
const res = await loadPack('pasar_props');  // { ok, models: [...ids], skipped: [{ id, reason }] }; never throws
putModel(M, 'pasar/stall', root, x, z, { h: 2.4 });  // pack ids work with putModel / putAnimated
getModel('pasar/stall');                     // the source model, or null if it is not loaded
unloadPack('pasar_props');                   // remove its clones from the scene first: they share GPU buffers
```

- Nothing is downloaded at game start. The index is fetched on the first `loadPack` or `getModel` call. Each model
  loads once and is cached.
- Legacy keys always win: a pack model can never replace an existing model.
- Rigged models with animations work with `putAnimated` as before.

## 5. Running the tools yourself (optional)

```bash
node tools/index_packs.mjs
```

```bash
node tools/index_packs.mjs --strict
```

```bash
node tools/check_glb.mjs assets/packs/pasar_props/Stall_A.glb --profile packAsset
```

```bash
node test/packs/packs.test.mjs
```

`tools/build_models.py`, which builds the legacy base64 pack, skips `assets/packs`.
