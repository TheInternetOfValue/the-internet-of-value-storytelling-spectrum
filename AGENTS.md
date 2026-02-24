# Project: Three.js 2D Puzzle (React + Vite)

## Game Overview
- 2D sliding puzzle built with Three.js using an orthographic camera
- Core loop: tap/click tile adjacent to empty slot, complete grid to win
- Target platform: desktop web

## Tech Stack
- React 18 + TypeScript + Vite
- Three.js for rendering
- Vitest for unit tests

## Key Configs
- `package.json`: scripts (`dev`, `build`, `preview`, `test`) and deps
- `tsconfig.app.json`: strict TS, path alias `@/*`, JSON imports
- `vite.config.ts`: React plugin, alias `@`, Vitest config

## Core Structure
- `src/components/GameCanvas.tsx`: renderer + engine loop wiring
- `src/game/GameScene.ts`: scene, camera, tile rendering, input handling
- `src/game/GameState.ts`: central state, level loading, win status
- `src/game/levels/`: JSON level data + loader
- `src/game/systems/`: puzzle logic (move, win check, grid utils)
- `src/ui/`: HUD + debug overlay
- `src/engine/`: engine loop, input manager, asset loader

## Development Commands
- `npm install`
- `npm run dev`
- `npm run test`
- `npm run build`

## Style Rules
- Keep CSS global in `src/index.css`; avoid component-scoped CSS or CSS modules.

## Skills Usage (Embed + When To Use)
Use the skill docs below as canonical guidance. Include relevant tips in new work and reference these checklists when adding features.

### `skills/asset-optimization/SKILL.md`
Use when adding textures, sprites, or any asset pipeline changes.
- Prefer power-of-two textures for WebGL
- Keep UI textures small and compress if shipping larger assets
- Budget texture memory and avoid unnecessary large canvases

### `skills/audio-systems/SKILL.md`
Use when introducing SFX/music or adding an audio pipeline.
- Use short SFX clips; stream long music tracks
- Avoid too many simultaneous voices
- Keep levels balanced: music lower than gameplay SFX

### `skills/game-design-theory/SKILL.md`
Use when adjusting the puzzle loop, progression, or difficulty.
- Maintain a fast feedback loop (<100ms) on input
- Keep challenge within the flow channel
- Add clear goals and milestones to reduce frustration

### `skills/gameplay-mechanics/SKILL.md`
Use when implementing new mechanics or feedback systems.
- Ensure action → effect feedback is immediate
- Keep mechanics data-driven and testable
- Adjust one variable at a time when balancing

### `skills/optimization-performance/SKILL.md`
Use when profiling or optimizing rendering performance.
- Target stable 60 FPS
- Limit draw calls and avoid per-frame allocations
- Use fixed timestep for deterministic game logic

## Code Quality Standards
- Make minimal, surgical changes
- **Abstractions**: Consciously constrained, pragmatically parameterised, doggedly documented