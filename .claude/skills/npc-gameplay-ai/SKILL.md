---
name: npc-gameplay-ai
description: Use when implementing or improving NPC behavior, village routines, pathfinding, interactions, dialogue, quests and gameplay AI in TYRANZ Kampung Heroes.
---

# TYRANZ NPC & Gameplay AI

## Project Context

TYRANZ: Kampung Heroes is a stylized low-poly Malaysian village life simulator built with Three.js for web, Android and iOS.

Create believable village life while preserving existing characters, gameplay systems and mobile performance.

## Core Responsibilities

1. Implement NPC daily schedules and routines.
2. Improve NPC movement and pathfinding.
3. Create natural player-to-NPC interactions.
4. Support contextual dialogue in Bahasa Melayu and English.
5. Implement reusable quests and village activities.
6. Create appropriate NPC reactions to player actions.
7. Optimize AI processing for mobile devices.
8. Preserve existing character identities and save data.

## Established Characters

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

Do not assume model-to-character mappings without inspecting the repository.

## AI Architecture

Prefer lightweight, modular systems:

- Finite-state machines for routine behaviors.
- Waypoints or navigation meshes for movement.
- Schedule managers for time-based activities.
- Interaction components for player dialogue.
- Event-driven quest progression.
- Spatial activation for nearby NPCs.

Avoid expensive AI processing on every frame.

## NPC Behavior States

Examples:

- Idle
- Walking
- Working
- Talking
- Shopping
- Eating
- Fishing
- Resting
- Sleeping
- Reacting to player

Use only states supported by the NPC's actual animations and gameplay systems.

## Implementation Workflow

1. Inspect existing NPC controllers and character assets.
2. Identify current movement, animation and interaction systems.
3. Propose the smallest compatible architecture.
4. Implement one NPC prototype before expanding.
5. Add schedules and waypoint navigation.
6. Add interaction and dialogue.
7. Validate state transitions and animation compatibility.
8. Test performance on mobile.
9. Run existing tests and document changes.

## Example Village Routine

An illustrative NPC schedule:

06:30 - Wake up
07:30 - Breakfast
09:00 - Village activity
12:30 - Lunch
14:00 - Work or social activity
18:00 - Return home
21:00 - Sleep

Actual schedules must match available locations, animations and game time.

## Safety Rules

- Never delete existing NPCs.
- Never rename established characters without approval.
- Never overwrite character GLB models.
- Never invent animation clips.
- Never break existing quests or dialogue.
- Preserve save-game compatibility.
- Avoid unnecessary global event listeners.
- Make small, reversible changes.

## Acceptance Checks

- NPCs follow valid routes.
- NPCs do not walk through obstacles.
- State transitions work correctly.
- Interactions respond reliably.
- Existing characters remain available.
- No significant mobile performance regression.
- Existing quests and saves remain functional.
