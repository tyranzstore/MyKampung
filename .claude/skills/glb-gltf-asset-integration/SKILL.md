---
name: glb-gltf-asset-integration
description: Use when importing, inspecting, optimizing, animating or integrating GLB and GLTF 3D assets into TYRANZ Kampung Heroes.
---

# TYRANZ GLB / GLTF Asset Integration

## Project Context

TYRANZ: Kampung Heroes is a stylized low-poly Malaysian village game developed with Three.js for web, Android and iOS.

Assets include characters, buildings, vehicles, fishing boats, sea creatures, decorations and mini-game objects.

Maintain the existing game's visual style.

## Core Responsibilities

1. Import GLB/GLTF assets using the existing Three.js loading architecture.
2. Preserve original geometry, materials, textures and animations.
3. Inspect model scale, orientation, bounding boxes and pivot points.
4. Identify missing textures and unsupported extensions.
5. Correct placement and alignment without altering original source files.
6. Integrate animations using the existing AnimationMixer architecture.
7. Optimize rendering performance for mobile devices.
8. Prevent duplicate model loading and unnecessary memory usage.
9. Maintain asset paths and compatibility with existing gameplay.
10. Verify model appearance inside the actual game scene.

## Integration Workflow

### 1. Inspect
- Locate the current asset loader.
- Identify existing GLB/GLTF files.
- Check materials, textures, scale and animations.
- Determine which scenes use the asset.

### 2. Prepare
- Preserve the original asset.
- Create optimized copies only when necessary.
- Use consistent naming.
- Document any model transformations.

### 3. Integrate
- Reuse the existing loading system.
- Handle loading errors gracefully.
- Avoid duplicate AnimationMixers.
- Set appropriate shadows and collision boundaries.
- Ensure assets work with existing cameras and lighting.

### 4. Optimize
- Reduce unnecessary draw calls.
- Reuse materials where appropriate.
- Consider texture compression and LOD.
- Avoid excessive polygon counts.
- Dispose of resources safely.

### 5. Validate
- Test on desktop and mobile.
- Verify scale, orientation and animation.
- Check loading performance.
- Confirm existing assets remain functional.

## TYRANZ Character Protection

Preserve established character names, including:

- Tok Abah
- Nek Ma
- Pok Wan
- Pok Ajis
- Mok Ngoh
- Mok Yah
- Cikgu Eby
- Yaya
- Seola
- Taeyang
- Sofia
- Zafran

Do not assume which model belongs to which character without inspecting the repository.

## Safety Rules

- Never overwrite original GLB files without approval.
- Never remove existing characters.
- Never replace textures without permission.
- Never rename asset paths without updating dependencies.
- Never invent asset filenames or animations.
- Preserve save-game compatibility.
- Make small, reversible changes.

## Acceptance Checks

- Asset loads successfully.
- Correct scale and orientation.
- Materials and textures render correctly.
- Animations work when present.
- No new console errors.
- No broken existing assets.
- Mobile performance remains acceptable.
