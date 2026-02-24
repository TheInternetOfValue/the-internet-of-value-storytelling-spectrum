# Storytelling Spectrum Playground

Lightweight interactive exploration of the storytelling spectrum from:

`Thought -> Networked Thought -> Text -> Audio -> Images -> Moving Images (Without Audio) -> Moving Images (With Audio) -> Website -> Product -> Solution -> Protocol -> Math`

## Core Data

- `src/data/storytelling-dictionary.json`
  - Locked vocabulary
  - Axes
  - Core spine
  - Combination layer
  - Variable vocabulary
- `src/data/storytelling-rules.json`
  - One-step progression rules
  - Interaction action definitions
  - Unlock logic
  - Win condition

## Run

```bash
npm install
npm run dev
```

## Interaction Model

- `Advance One Step`
- `Craft Combination`
- `Apply Distribution Modifier`
- `Reflect Step`

This app is intentionally minimal and data-driven so changes to the concept happen primarily through the dictionary and rules files.
