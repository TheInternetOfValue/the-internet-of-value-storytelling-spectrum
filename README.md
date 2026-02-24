# The Internet of Value Storytelling Spectrum

Scene-first 3D interactive model of storytelling progression:

`Thought -> Networked Thought -> Text -> Audio -> Images -> Moving Images (Without Audio) -> Moving Images (With Audio) -> Website -> Product -> Solution -> Protocol -> Math`

## What This Does

- Enforces one legal step at a time (no skipping).
- Lets users craft combination artifacts through in-scene combo markers.
- Applies distribution modifiers through in-scene beacons.
- Shows project resource links inside the scene, context-switched by clicked node/artifact/distribution.
- Shows contextual impact gain/loss on 3 axes:
  - Degree of Sensory Activation
  - Ease of Consumption
  - Creation Effort
- Uses camera assist (pan + smart auto-focus) to keep high-sensory nodes easier to navigate.
- Resolves overlay conflicts by rendering one primary card at a time (impact card and links are unified when focused).

## Run

```bash
npm install
npm run dev -- --host
```

Open: `http://localhost:5173`

## Build

```bash
npm run build
npm run preview
```

## Data Sources

- Dictionary: `src/data/storytelling-dictionary.json`
- Rules: `src/data/storytelling-rules.json`
- IOV Project Links: `src/data/project-iov-profile.json`

## Docs

- Full technical documentation: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
- Agent guidance and project conventions: [AGENTS.md](./AGENTS.md)
