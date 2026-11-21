---
name: mobile-game-optimization
description: Optimize Three.js mobile gameplay, touch controls, rendering performance, loading, memory usage, and Android/iOS browser compatibility.
---

# TYRANZ Mobile Game Optimization

Project: TYRANZ: Kampung Heroes, a stylized low-poly Malaysian village game built with Three.js.

## Objectives
- Smooth gameplay on mid-range Android and iOS devices.
- Responsive touchscreen controls.
- Fast loading and stable memory usage.
- Preserve existing graphics, gameplay, characters and mini-games.

## Workflow
1. Inspect the existing renderer, game loop, asset loaders and controls before changing code.
2. Measure performance before optimizing; do not invent benchmark results.
3. Identify excessive draw calls, high polygon counts, large textures and unnecessary rendering work.
4. Optimize GLB/GLTF assets without overwriting original files.
5. Cap device pixel ratio when necessary and test visual quality.
6. Reuse geometries, materials and textures where appropriate.
7. Dispose of unused Three.js resources safely.
8. Improve touch controls, joystick responsiveness and camera behavior.
9. Prevent unnecessary event listeners and duplicate animation loops.
10. Test portrait/landscape handling and mobile browser resizing.
11. Keep performance improvements compatible with existing mini-games.

## Performance Targets
- Aim for 30 FPS or better on supported mid-range phones.
- Target 60 FPS on capable devices when practical.
- Reduce initial loading time without removing essential content.
- Avoid crashes caused by excessive memory usage.

These are targets, not guaranteed results.

## Safety Rules
- Never delete working gameplay to improve performance.
- Never replace existing character models without approval.
- Preserve existing save systems and player progression.
- Make small, testable changes.
- Explain performance tradeoffs.
- Run available build checks and tests.

## Acceptance Checks
- Existing characters and environments render correctly.
- Touch controls remain responsive.
- Mini-games still load and exit correctly.
- No new console errors or resource leaks.
- Performance improvements are supported by measurements.
