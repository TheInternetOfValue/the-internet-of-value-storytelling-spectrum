# Storytelling Spectrum Playground

3D journey exploration of the storytelling spectrum:

`Thought -> Networked Thought -> Text -> Audio -> Images -> Moving Images (Without Audio) -> Moving Images (With Audio) -> Website -> Product -> Solution -> Protocol -> Math`

## Journey Mode

- Scene-first interaction with a Three.js spectrum map.
- One legal move at a time (no skips).
- Click the glowing next node in 3D space or use `Advance One Step`.
- Combination arcs unlock/craft over progression.
- Reflection and gain/loss are tracked per step.

## Source Of Truth

- `src/data/storytelling-dictionary.json`
  - Locked vocabulary + core spine + combination layer + variable vocabulary.
- `src/data/storytelling-rules.json`
  - Progression legality + actions + unlock logic + win condition.

## Run

```bash
npm install
npm run dev -- --host
```

Open `http://localhost:5173`.
