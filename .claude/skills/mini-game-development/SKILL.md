---
name: mini-game-development
description: Use when designing, building, integrating, debugging or upgrading mini-games in TYRANZ Kampung Heroes using Three.js for mobile and web.
---

# TYRANZ Mini-Game Development

## Project Context

TYRANZ: Kampung Heroes is a stylized low-poly Malaysian village life simulator built with Three.js.

The game includes or plans activities such as:
- Futsal
- Volleyball
- Fishing
- Drag racing (cars and motorcycles)
- Shopping mall simulator
- Photography simulator

Maintain visual consistency with the main game.

## Core Responsibilities

1. Build enjoyable, accessible mini-games.
2. Integrate mini-games into the existing village world.
3. Reuse existing characters, assets and game systems.
4. Create responsive mobile touch controls.
5. Maintain consistent camera behavior.
6. Implement clear gameplay objectives and feedback.
7. Integrate rewards with the existing economy.
8. Optimize performance for mobile browsers.
9. Preserve existing working mini-games.

## Required Mini-Game Architecture

Each mini-game should support:

- Initialization
- Asset loading
- Entering gameplay
- Input handling
- Update loop
- Pause/resume
- Scoring and rewards
- Exiting gameplay
- Cleanup and resource disposal

Use the existing project architecture when available.

Do not create duplicate global game loops.

## Gameplay Quality Standards

- Player controls must be easy to understand.
- Important action buttons must be visible.
- Camera angles must clearly show gameplay.
- Objectives and scoring must be understandable.
- Animations should provide useful feedback.
- Avoid unnecessarily complicated controls.
- Support mobile screen sizes.
- Keep gameplay enjoyable without requiring purchases.

## Mini-Game Requirements

### Futsal
- Clear view of the playing field.
- Responsive movement, passing and shooting.
- Reliable ball physics and goal detection.
- Accessible penalty gameplay.
- Appropriate AI opponents.

### Volleyball
- Clear court visibility.
- Responsive serving, receiving and attacking.
- Predictable ball trajectories.
- Reliable scoring and match flow.

### Fishing
- Casting, waiting, hooking and reeling.
- Different fish species and rarity.
- Appropriate sea-fishing environments.
- Reward and inventory integration.

### Drag Racing
- Cars and motorcycles.
- Acceleration, gear shifting and race timing.
- Vehicle customization and upgrades.
- Fair progression and race rewards.

### Shopping Simulator
- Shopping cart interaction.
- Separated store sections.
- Product selection and checkout.
- Clear item prices and totals.

### Photography Simulator
- Use the existing player character.
- Third-person 3D camera interaction.
- Framing, focus and photo capture.
- Save or display captured photos when supported.

## Integration Workflow

1. Inspect the existing mini-game system.
2. Identify shared engine dependencies.
3. Propose the smallest compatible implementation.
4. Create or modify one mini-game at a time.
5. Integrate entry and exit points.
6. Add controls, scoring and rewards.
7. Test cleanup and return to the village.
8. Verify other mini-games still function.
9. Test on desktop and mobile.
10. Document changes and limitations.

## Safety Rules

- Never delete existing mini-games without approval.
- Never overwrite original GLB assets.
- Never invent existing APIs or filenames.
- Never break the main village.
- Never create duplicate animation loops.
- Never award paid currency directly from client code.
- Preserve save-game compatibility.
- Make small, reversible changes.

## Acceptance Checks

- Mini-game starts correctly.
- Controls work on mobile.
- Scoring is accurate.
- Rewards are validated.
- Pause and resume work.
- Player can exit safely.
- Main village resumes correctly.
- No major performance regressions.
- Other mini-games remain functional.
