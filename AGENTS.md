# AGENTS.md

## Project Summary

This repository is a **scene-first 3D storytelling spectrum game** built with:
- React + TypeScript + Vite
- Three.js for rendering and interaction

The experience models the core spine:

`Thought -> Networked Thought -> Text -> Audio -> Images -> Moving Images (Without Audio) -> Moving Images (With Audio) -> Website -> Product -> Solution -> Protocol -> Math`

## Primary Goal

Keep this project minimal, fast, and interaction-first:
- one legal step at a time
- no skip logic
- in-scene interaction over side-panel controls
- data-driven vocabulary/rules/project links

## Canonical Data Files

- `src/data/storytelling-dictionary.json`
  - Core spine nodes
  - Combination recipes
  - Distribution modifiers
  - Artifact vocabulary
- `src/data/storytelling-rules.json`
  - Legal progression edges
  - Unlock logic
  - Win condition
- `src/data/project-iov-profile.json`
  - Project-specific resource links by node/artifact/modifier

## Core Runtime Files

- `src/App.tsx`
  - Game orchestration
  - Gate logic
  - Focused impact overlay
  - Contextual project links (in-scene + impact-card integrated)
- `src/components/SpectrumScene.tsx`
  - Three.js scene and interaction
  - Node/combo/modifier click handling
  - Visual effects and axis labels
  - Pan + smart auto-focus for navigation comfort
- `src/lib/storytellingGame.ts`
  - Game state transitions and pure logic helpers
- `src/lib/projectProfile.ts`
  - Project profile accessors (`getProjectLinks`, label resolution)
- `src/types/storytelling.ts`
  - Shared TypeScript contracts

## Interaction Contract

1. Advance by clicking the glowing legal next node (or `Space` / `Right Arrow`).
2. Combination markers:
   - first click = preview
   - second click = craft
3. Distribution beacons:
   - first click = preview
   - second click = apply
4. Impact overlay is contextual, anchored near click location, and auto-dismisses.
5. Resource links are contextual in-scene and should not visually compete with impact cards.

## Engineering Rules

- Keep changes surgical and data-driven.
- Avoid introducing side panels unless explicitly requested.
- Prefer extending JSON config over hardcoding behavior.
- Preserve mobile responsiveness.
- Keep CSS in `src/index.css` only.
- Never remove existing core spine entries.

## Build and Run

```bash
npm install
npm run dev -- --host
npm run build
```

## Documentation

When making non-trivial changes, update:
- `README.md` (quick start and behavior summary)
- `PROJECT_DOCUMENTATION.md` (deep technical doc)
- relevant JSON schema/types if data contracts change
