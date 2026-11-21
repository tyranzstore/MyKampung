# Tok Abah — GLB asset spec (Phase 1)

The new semi-realistic Tok Abah replaces the current Tok Abah **only after** the file passes
`node tools/check_glb.mjs assets/tyranz/TokAbah.glb` and has been checked in the game.
Until then the existing Tok Abah stays exactly as he is.

## Character
- **Tok Abah**, village elder. Grey/white beard.
- **Outfit:** black Baju Melayu, coordinated grey-and-beige kain pelikat, white kopiah.
- **Style:** semi-realistic but soft, matte materials so he sits well in the low-poly village.
  In the village he is about 60–100 px tall on a phone; the camera zooms in on him when he talks.

## File
| Item | Requirement |
|---|---|
| Format | glTF 2.0 **binary** (`.glb`), everything embedded (no external textures or `.bin`) |
| Path | `assets/tyranz/TokAbah.glb` (new file — no existing model is overwritten) |
| File size | target **≤ 1.5 MB**, maximum **2.5 MB** |
| Compression | **no** Draco, Meshopt or KTX2/Basis (the game's loader has no decoders for them). `KHR_mesh_quantization`, `KHR_texture_transform` and `EXT_texture_webp` are fine |
| Contents | one scene, one character; no cameras or lights |

## Geometry
| Item | Target | Maximum |
|---|---|---|
| Triangles (whole model) | **≤ 10,000** | 15,000 |
| Mesh primitives (draw calls) | ≤ 3 | 4 |
| Materials | ≤ 3 (e.g. body/clothes, head/beard, kopiah) | 4 |
| Morph targets | none needed (use a jaw bone for talking) | warning above 8 |

## Scale, axis and origin
- **Y-up**, real-world **metres**. Standing height **1.65–1.70 m** (accepted 1.55–1.85 m).
- **Origin at the feet**, centred between them (lowest point at y = 0).
- **Facing +Z** (same as `assets/tyranz/Hero.glb`). This is checked by eye in the game, not by the script.
- Bind pose: T-pose or A-pose.

## Rig
| Item | Requirement |
|---|---|
| Skin | one skinned mesh (`JOINTS_0` / `WEIGHTS_0`) |
| Joints | **15–65**, target **≤ 60** (a standard humanoid without individual finger bones, or with simple fingers) |
| Influences | **max 4 bones per vertex** |
| Needed for the animations | hips/root, spine, neck, head, jaw (optional, for talking), shoulders, arms, hands, legs, feet |
| Bone names | any consistent humanoid naming (Mixamo, Blender Rigify-export, etc.) |

## Textures
| Item | Target | Maximum |
|---|---|---|
| Size (longest side) | **1024 px** | 2048 px |
| Number of images | 1–3 (base colour; optional normal; optional roughness/metal) | 4 |
| GPU memory (all textures) | ≤ 12 MB (one 1024² base colour ≈ 5.3 MB) | 16 MB |
| Format | PNG, JPEG or WebP, power-of-two sizes, embedded | — |

## Animations
Exact, lowercase clip names. All clips loop, run **in place** (no root motion: the game moves him),
at 30 fps.

| Clip | Required | Length | Notes |
|---|---|---|---|
| `idle` | **yes** | 2–10 s | standing, breathing, small natural movement |
| `walk` | **yes** | 0.5–2 s (one cycle) | relaxed elderly walk, in place |
| `talk` | **yes** | 2–8 s | standing, gestures, head/jaw movement |
| `sit` | **yes** | 2–10 s | seated loop, for a bench about 0.45 m high |
| `sit_down` | optional | ~1 s | transition stand → sit |
| `stand_up` | optional | ~1 s | transition sit → stand |
| `wave` | optional | 1–3 s | greeting |

Clips with other names are allowed but unused (warning). Names like `Idle` or `mixamo.com|Walk` fail —
rename them exactly as above.

## How to check a file
```
node tools/check_glb.mjs assets/tyranz/TokAbah.glb
```
Prints PASS / WARN / FAIL for every rule and ends with **READY** or **NOT READY** (exit code 0 / 1).
`--json` gives a machine-readable report. Then:
```
node test/npc/readiness.test.mjs
```
confirms the file is valid and the game's integration points are unchanged.

WARN items are allowed but should be fixed if easy. Any FAIL blocks the integration.

## NPC name mapping (checked, nothing renamed)
| Canonical name | In the game today | Status |
|---|---|---|
| Tok Abah | `abah` — Tok Abah | matches |
| Nek Ma | `kiah` — Nek Ma | matches |
| Pok Wan | `din` — Pok Wan | matches |
| Pok Ajis | `abu` — **Pak Ajis** | spelling differs — rename only with approval |
| Cikgu Eby | `ani` — **Cikgu Aqilah** | different name — confirm whether this is the same character |
| Mok Ngoh, Mok Yah, Yaya, Seola, Taeyang | — | not in the game yet |

Also in the game but not in the canonical list: Amin, Pak Hassan, Uncle Lim, Kak Long, Pak Mat.
