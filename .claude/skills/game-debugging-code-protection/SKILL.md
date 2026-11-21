
---
name: game-debugging-code-protection
description: Use when debugging, refactoring, reviewing, testing or modifying existing TYRANZ Kampung Heroes game code while protecting working features.
---

# TYRANZ Game Debugging & Code Protection

## Project Context

TYRANZ: Kampung Heroes is an existing Three.js Malaysian village game with multiple gameplay systems, GLB assets, characters and mini-games.

Protect existing functionality before introducing new features.

## Core Principles

1. Inspect before editing.
2. Preserve working systems.
3. Make small, reversible changes.
4. Validate assumptions against actual repository files.
5. Never claim tests passed unless executed.
6. Document risks and limitations.
7. Request approval before destructive changes.

## Pre-Change Workflow

Before modifying code:

1. Inspect the repository structure.
2. Identify the actual entry points and dependencies.
3. Locate affected game systems.
4. Identify existing tests and build commands.
5. Check relevant Git history when available.
6. Explain the proposed changes and risks.
7. Create or recommend a dedicated feature branch.

## Implementation Rules

- Never delete existing game features without approval.
- Never overwrite original GLB assets.
- Never rename established characters without permission.
- Avoid rewriting entire files for small fixes.
- Reuse existing architecture where possible.
- Preserve save-game and inventory compatibility.
- Avoid duplicate animation loops and global event listeners.
- Do not expose secrets or credentials.
- Do not modify unrelated systems.
- Keep changes reviewable.

## Debugging Workflow

1. Reproduce the issue where possible.
2. Identify the root cause.
3. Apply the smallest effective fix.
4. Add or update tests where appropriate.
5. Run available tests and build checks.
6. Verify affected gameplay manually when possible.
7. Report what was tested and what remains unverified.

## Regression Checklist

Check relevant systems after changes:

- Main village loading
- Player movement
- Camera controls
- Character animations
- NPC interactions
- Save and load
- Fishing
- Futsal
- Volleyball
- Drag racing
- Shopping mall
- Photo simulator
- Mobile touch controls
- GLB loading and textures

Only report a system as passing if it was actually tested.

## Git Safety

- Prefer feature branches.
- Review changed files before committing.
- Avoid force-pushing.
- Never commit credentials.
- Keep commits focused.
- Explain how to revert changes.
- Do not merge untested changes automatically.

## Acceptance Checks

- Requested issue is resolved or clearly documented.
- No unrelated files changed unnecessarily.
- Existing features remain functional.
- Tests and build checks are reported accurately.
- No new critical console errors.
- Changes are reversible.
