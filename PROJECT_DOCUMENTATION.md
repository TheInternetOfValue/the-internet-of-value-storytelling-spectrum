# Project Documentation

## 1. Overview

This project is an interactive 3D experience that models how an idea transforms across formats, from raw thought to formal math.

The system has three layers:
- **Core spine progression**: legal one-step movement across storytelling formats.
- **Combination layer**: emergent artifacts from combining visited formats.
- **Distribution layer**: channel modifiers that alter impact characteristics.

Everything is data-driven through JSON + typed contracts.

## 2. Core Journey Model

### 2.1 Core Spine

Ordered formats:

1. Thought
2. Networked Thought
3. Text (Structured)
4. Audio
5. Images
6. Moving Images (Without Audio)
7. Moving Images (With Audio)
8. Website
9. Product
10. Solution
11. Protocol
12. Math

### 2.2 Axes

Primary impact axes used in live interaction:
- Degree of Sensory Activation
- Ease of Consumption
- Creation Effort

Additional axes in dictionary (for extended semantics):
- Biases / Perceptions / Bullshit
- Effectiveness of Storytelling

### 2.3 Progression Rules

- No skipping across the spine.
- One legal next move at a time.
- Gate challenges required for:
  - Product -> Solution
  - Solution -> Protocol
  - Protocol -> Math

## 3. Data Contracts

## 3.1 `storytelling-dictionary.json`

Contains:
- `core_spine[]`
- `combination_layer[]`
- `extended_artifacts[]`
- `variable_vocabulary.distribution[]`

Distribution modifiers include:
- `id`
- `label`
- `description`
- `color_hex`
- `metric_delta`

## 3.2 `storytelling-rules.json`

Contains:
- run start and target
- progression edges
- action metadata
- unlock logic
- scoring range
- win condition

## 3.3 `project-iov-profile.json`

Project-specific mapping for external resource routing:
- `default_links`
- `resource_links` keyed by:
  - core node id (`text_structured`, `moving_images_with_audio`, etc.)
  - artifact id (`recorded_course`, `meme_infographic`, etc.)
  - distribution id (`feed`, `search`, etc.)

This enables the same game logic to point to concrete assets for The Internet of Value.

## 4. UI / Interaction Architecture

## 4.1 Scene-first Controls

All primary interaction occurs in-scene:
- click next node -> advance
- click combo marker -> preview/craft
- click distribution beacon -> preview/apply

Keyboard shortcut:
- `Space` or `Right Arrow` triggers legal advance.

## 4.2 Overlay Behavior

Impact card:
- anchored near click position
- auto-dismisses after delay
- pinned when hovered/tapped
- manual dismiss available
- includes project resource links while focused (to avoid card overlap)

Distribution card:
- shows active distribution and impact preview
- color-coded by modifier.

## 4.3 Resource Links Layer

Scene overlay shows contextual links:
- current context label (node/artifact/modifier)
- external links from project profile
- when impact card is active, links are rendered inside impact card
- when impact card is dismissed, floating scene links card is shown

Priority:
1. currently focused interaction context
2. fallback to current node
3. fallback to profile `default_links`

## 4.4 Camera and Navigation

- Orbit controls are always in explore mode.
- Pan is enabled for better navigation across dense high-sensory regions.
- Smart auto-focus is triggered on:
  - node click
  - legal step transitions
- Manual drag/orbit/pan cancels auto-focus immediately to preserve user control.

## 5. Key Source Files

- `src/App.tsx`
  - Run orchestration
  - state transitions wiring
  - gate validation UI
  - impact overlay state
  - in-scene resource link routing
- `src/components/SpectrumScene.tsx`
  - Three.js scene bootstrapping
  - camera/controls, raycast click routing
  - node/combo/modifier visuals
  - birth effects and axis labels
  - camera assist and focus transitions
- `src/lib/storytellingGame.ts`
  - pure transition functions
  - legal move helpers
  - impact projections
- `src/lib/projectProfile.ts`
  - profile loading and link resolution
- `src/types/storytelling.ts`
  - all shared TS models

## 6. Build, Run, Deploy

```bash
npm install
npm run dev -- --host
npm run build
npm run preview
```

Local dev:
- `http://localhost:5173`

Static deploy:
- Use `dist/` after `npm run build`.
- Works with Netlify/Vercel static hosting.

## 7. Extending To Another Project

To reuse this engine for a different project:

1. Copy `src/data/project-iov-profile.json` to a new profile file.
2. Replace link mappings only (keep keys aligned to node/artifact/modifier ids).
3. Update `src/lib/projectProfile.ts` to import new profile.
4. Optionally expose profile switching via URL mode if multi-project support is desired.

No scene rewrite is needed.

## 8. Known Constraints

- Large JS bundle warning from Vite due to Three.js scene in a single entry bundle.
- Asset links are external and assumed valid; broken links are not validated in runtime.
- Some fallback links are placeholders and should be replaced with final canonical URLs.

## 9. Quality Checklist

Before commit/publish:
- `npm run build` passes
- no side panel regressions (scene-first UX intact)
- gate overlays still validate correctly
- combo/distribution click behavior works (preview -> apply/craft)
- contextual links update based on selected context
- link/impact overlays do not visually collide
- high-sensory nodes remain reachable via pan + auto-focus
