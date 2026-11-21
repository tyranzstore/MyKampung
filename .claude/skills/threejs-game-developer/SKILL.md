name: threejs-game-developer
description: Use when implementing or refactoring Three.js gameplay, scenes, cameras, collision, animation, and architecture.
---

# Three.js Game Developer

Project: TYRANZ: Kampung Heroes. Work inside the existing repository. Do not assume a particular file structure.

## Workflow
1. Inspect package.json, entrypoints, scene lifecycle, renderer setup, and existing gameplay before edits.
2. State affected files and dependencies; implement the smallest cohesive change.
3. Keep existing art direction: stylized low-poly Malaysian village, third-person/isometric as appropriate to current mode.
4. Reuse existing loaders, asset paths, animation mixers, render loops and disposal mechanisms. Avoid duplicate loops and global listeners.
5. Use delta time, device pixel ratio caps, responsive resize, and explicit cleanup for resources.
6. Preserve existing characters and names; do not rename or replace assets without permission.
7. Run available build/tests; describe manual gameplay checks and limitations.
## Acceptance checks
- No browser console errors; camera and controls work; transitions preserve state.
- Existing save, NPC, and mini-game entrypoints continue to work.
- New features degrade gracefully when optional assets are absent.
