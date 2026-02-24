import dictionaryJson from "@/data/storytelling-dictionary.json";
import rulesJson from "@/data/storytelling-rules.json";
import type {
  AxisValues,
  CombinationRecipe,
  DistributionModifier,
  HistoryEvent,
  SignalProfile,
  SpineNode,
  StorytellingDictionary,
  StorytellingRules,
  StorytellingRunState,
} from "@/types/storytelling";

export const dictionary = dictionaryJson as StorytellingDictionary;
export const rules = rulesJson as StorytellingRules;

const metricKeys: Array<keyof SignalProfile> = [
  "fidelity",
  "persuasion",
  "reach",
  "distortion",
];

const axisKeys: Array<keyof AxisValues> = [
  "sensory_activation",
  "ease_of_consumption",
  "creation_effort",
  "bias_perception_load",
  "storytelling_effectiveness",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const spineById = new Map(dictionary.core_spine.map((node) => [node.id, node]));
export const combinationsById = new Map(
  dictionary.combination_layer.map((combo) => [combo.id, combo])
);
export const modifiersById = new Map(
  dictionary.variable_vocabulary.distribution.map((modifier) => [modifier.id, modifier])
);

export const getNode = (nodeId: string): SpineNode => {
  const node = spineById.get(nodeId);
  if (!node) {
    throw new Error(`Missing spine node: ${nodeId}`);
  }
  return node;
};

const getNextNodeId = (currentNodeId: string): string | null => {
  const edge = rules.progression_edges.find(([from]) => from === currentNodeId);
  return edge ? edge[1] : null;
};

const hasIngredient = (state: StorytellingRunState, ingredientId: string) =>
  state.visitedNodeIds.includes(ingredientId) || state.craftedArtifactIds.includes(ingredientId);

export const getAvailableCombinations = (state: StorytellingRunState): CombinationRecipe[] =>
  dictionary.combination_layer.filter((combo) => {
    if (state.craftedCombinationIds.includes(combo.id)) return false;
    return combo.inputs.every((inputId) => hasIngredient(state, inputId));
  });

export const getAvailableModifiers = (state: StorytellingRunState): DistributionModifier[] =>
  dictionary.variable_vocabulary.distribution.filter(
    (modifier) => !state.appliedModifierIds.includes(modifier.id)
  );

const emptySignalProfile = (): SignalProfile => ({
  fidelity: 0,
  persuasion: 0,
  reach: 0,
  distortion: 0,
});

const emptyAxisValues = (): AxisValues => ({
  sensory_activation: 0,
  ease_of_consumption: 0,
  creation_effort: 0,
  bias_perception_load: 0,
  storytelling_effectiveness: 0,
});

export const computeCurrentSignalProfile = (state: StorytellingRunState): SignalProfile => {
  const profile: SignalProfile = {
    ...getNode(state.currentNodeId).signal_profile,
  };

  state.craftedCombinationIds.forEach((comboId) => {
    const combo = combinationsById.get(comboId);
    if (!combo) return;
    metricKeys.forEach((key) => {
      profile[key] += combo.metric_delta[key];
    });
  });

  state.appliedModifierIds.forEach((modifierId) => {
    const modifier = modifiersById.get(modifierId);
    if (!modifier) return;
    metricKeys.forEach((key) => {
      profile[key] += modifier.metric_delta[key];
    });
  });

  metricKeys.forEach((key) => {
    profile[key] = clamp(profile[key], rules.scoring.range.min, rules.scoring.range.max);
  });

  return profile;
};

export const computeCurrentAxisValues = (state: StorytellingRunState): AxisValues => {
  const axisValues: AxisValues = {
    ...getNode(state.currentNodeId).axis_values,
  };

  const comboBoost = emptyAxisValues();
  state.craftedCombinationIds.forEach((comboId) => {
    const combo = combinationsById.get(comboId);
    if (!combo) return;

    comboBoost.sensory_activation += 2;
    comboBoost.ease_of_consumption += 1;
    comboBoost.creation_effort += 2;
    comboBoost.bias_perception_load += 1;
    comboBoost.storytelling_effectiveness += 2;
  });

  axisKeys.forEach((key) => {
    axisValues[key] = clamp(axisValues[key] + comboBoost[key], 0, 100);
  });

  return axisValues;
};

export const createInitialState = (): StorytellingRunState => ({
  currentNodeId: rules.run.start_node,
  visitedNodeIds: [rules.run.start_node],
  craftedCombinationIds: [],
  craftedArtifactIds: [],
  appliedModifierIds: [],
  reflections: [],
  history: [],
  turn: 0,
});

const pushHistory = (
  state: StorytellingRunState,
  action: HistoryEvent["action"],
  detail: string
): StorytellingRunState => ({
  ...state,
  history: [...state.history, { turn: state.turn + 1, action, detail }],
  turn: state.turn + 1,
});

export const advanceOneStep = (state: StorytellingRunState): StorytellingRunState => {
  const nextNodeId = getNextNodeId(state.currentNodeId);
  if (!nextNodeId) {
    return pushHistory(state, "advance", "Already at the end node (Math). No further advance possible.");
  }

  const current = getNode(state.currentNodeId);
  const next = getNode(nextNodeId);
  const detail = `${current.label} -> ${next.label}`;

  return pushHistory(
    {
      ...state,
      currentNodeId: nextNodeId,
      visitedNodeIds: state.visitedNodeIds.includes(nextNodeId)
        ? state.visitedNodeIds
        : [...state.visitedNodeIds, nextNodeId],
    },
    "advance",
    detail
  );
};

export const craftCombination = (
  state: StorytellingRunState,
  combinationId: string
): StorytellingRunState => {
  const combo = combinationsById.get(combinationId);
  if (!combo) {
    return pushHistory(state, "combination", `Unknown combination: ${combinationId}`);
  }

  if (state.craftedCombinationIds.includes(combinationId)) {
    return pushHistory(state, "combination", `${combo.label} already crafted.`);
  }

  const missing = combo.inputs.filter((inputId) => !hasIngredient(state, inputId));
  if (missing.length > 0) {
    return pushHistory(
      state,
      "combination",
      `${combo.label} blocked. Missing inputs: ${missing.join(", ")}.`
    );
  }

  return pushHistory(
    {
      ...state,
      craftedCombinationIds: [...state.craftedCombinationIds, combinationId],
      craftedArtifactIds: state.craftedArtifactIds.includes(combo.output)
        ? state.craftedArtifactIds
        : [...state.craftedArtifactIds, combo.output],
    },
    "combination",
    `${combo.label} crafted -> ${combo.output}`
  );
};

export const applyModifier = (
  state: StorytellingRunState,
  modifierId: string
): StorytellingRunState => {
  const modifier = modifiersById.get(modifierId);
  if (!modifier) {
    return pushHistory(state, "modifier", `Unknown modifier: ${modifierId}`);
  }

  if (state.appliedModifierIds.includes(modifierId)) {
    return pushHistory(state, "modifier", `${modifier.label} already applied.`);
  }

  return pushHistory(
    {
      ...state,
      appliedModifierIds: [...state.appliedModifierIds, modifierId],
    },
    "modifier",
    `Distribution modifier applied: ${modifier.label}`
  );
};

export const addReflection = (
  state: StorytellingRunState,
  reflection: string
): StorytellingRunState => {
  const trimmed = reflection.trim();
  if (!trimmed) {
    return state;
  }

  return pushHistory(
    {
      ...state,
      reflections: [...state.reflections, trimmed],
    },
    "reflection",
    trimmed
  );
};

export const resetRun = (): StorytellingRunState => {
  const initial = createInitialState();
  return {
    ...initial,
    history: [{ turn: 0, action: "reset", detail: "Run reset to Thought." }],
  };
};

export const getArtifactLabel = (artifactId: string): string => {
  const artifact = dictionary.extended_artifacts.find((item) => item.id === artifactId);
  return artifact?.label ?? artifactId;
};

export const getMetricDeltaLabel = (delta: SignalProfile): string =>
  metricKeys
    .map((key) => `${key}: ${delta[key] >= 0 ? "+" : ""}${delta[key]}`)
    .join(" | ");

export const getEmptySignal = emptySignalProfile;
