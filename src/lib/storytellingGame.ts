import dictionaryJson from "@/data/storytelling-dictionary.json";
import rulesJson from "@/data/storytelling-rules.json";
import type {
  AxisValues,
  CombinationRecipe,
  DistributionModifier,
  HistoryEvent,
  ImpactAxes,
  ImpactAxisId,
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

export const impactAxisKeys: ImpactAxisId[] = [
  "sensory_activation",
  "ease_of_consumption",
  "creation_effort",
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
export { getNextNodeId };

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

const emptyImpactAxes = (): ImpactAxes => ({
  sensory_activation: 0,
  ease_of_consumption: 0,
  creation_effort: 0,
});

export const axisLabelById: Record<ImpactAxisId, string> = {
  sensory_activation: "Degree of Sensory Activation",
  ease_of_consumption: "Ease of Consumption",
  creation_effort: "Creation Effort",
};

export const projectSignalDeltaToImpactAxes = (delta: SignalProfile): ImpactAxes => ({
  sensory_activation: Math.round(
    delta.reach * 0.8 + delta.persuasion * 0.35 + delta.distortion * 0.2
  ),
  ease_of_consumption: Math.round(
    delta.reach * 0.55 +
      delta.persuasion * 0.4 -
      delta.distortion * 0.3 +
      delta.fidelity * 0.25
  ),
  creation_effort: Math.round(
    delta.fidelity * 0.5 -
      delta.persuasion * 0.2 -
      delta.reach * 0.25 -
      delta.distortion * 0.15
  ),
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

  const comboBoost = emptyImpactAxes();
  state.craftedCombinationIds.forEach((comboId) => {
    const combo = combinationsById.get(comboId);
    if (!combo) return;
    const impact = projectSignalDeltaToImpactAxes(combo.metric_delta);
    impactAxisKeys.forEach((axisId) => {
      comboBoost[axisId] += impact[axisId];
    });
  });

  const modifierBoost = emptyImpactAxes();
  state.appliedModifierIds.forEach((modifierId) => {
    const modifier = modifiersById.get(modifierId);
    if (!modifier) return;
    const impact = projectSignalDeltaToImpactAxes(modifier.metric_delta);
    impactAxisKeys.forEach((axisId) => {
      modifierBoost[axisId] += impact[axisId];
    });
  });

  impactAxisKeys.forEach((axisId) => {
    axisValues[axisId] = clamp(
      axisValues[axisId] + comboBoost[axisId] + modifierBoost[axisId],
      0,
      100
    );
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

export const getImpactDeltaLabel = (delta: ImpactAxes): string =>
  impactAxisKeys
    .map((axisId) => `${axisLabelById[axisId]}: ${delta[axisId] >= 0 ? "+" : ""}${delta[axisId]}`)
    .join(" | ");

export const getEmptySignal = emptySignalProfile;
export const getEmptyImpactAxes = emptyImpactAxes;

export const getCombinationImpactDelta = (combinationId: string): ImpactAxes => {
  const combo = combinationsById.get(combinationId);
  if (!combo) return emptyImpactAxes();
  return projectSignalDeltaToImpactAxes(combo.metric_delta);
};

export const getModifierImpactDelta = (modifierId: string): ImpactAxes => {
  const modifier = modifiersById.get(modifierId);
  if (!modifier) return emptyImpactAxes();
  return projectSignalDeltaToImpactAxes(modifier.metric_delta);
};

export const getCurrentImpactAxes = (state: StorytellingRunState): ImpactAxes => {
  const axisValues = computeCurrentAxisValues(state);
  return {
    sensory_activation: axisValues.sensory_activation,
    ease_of_consumption: axisValues.ease_of_consumption,
    creation_effort: axisValues.creation_effort,
  };
};

export const getAdvanceDelta = (
  state: StorytellingRunState
): { nextNode: SpineNode | null; delta: SignalProfile } => {
  const nextNodeId = getNextNodeId(state.currentNodeId);
  if (!nextNodeId) {
    return { nextNode: null, delta: emptySignalProfile() };
  }

  const currentNode = getNode(state.currentNodeId);
  const nextNode = getNode(nextNodeId);
  const delta: SignalProfile = { ...emptySignalProfile() };

  metricKeys.forEach((key) => {
    delta[key] = nextNode.signal_profile[key] - currentNode.signal_profile[key];
  });

  return { nextNode, delta };
};

export const getAdvanceImpactDelta = (
  state: StorytellingRunState
): { nextNode: SpineNode | null; delta: ImpactAxes } => {
  const nextNodeId = getNextNodeId(state.currentNodeId);
  if (!nextNodeId) {
    return { nextNode: null, delta: emptyImpactAxes() };
  }

  const currentNode = getNode(state.currentNodeId);
  const nextNode = getNode(nextNodeId);

  return {
    nextNode,
    delta: {
      sensory_activation:
        nextNode.axis_values.sensory_activation - currentNode.axis_values.sensory_activation,
      ease_of_consumption:
        nextNode.axis_values.ease_of_consumption - currentNode.axis_values.ease_of_consumption,
      creation_effort:
        nextNode.axis_values.creation_effort - currentNode.axis_values.creation_effort,
    },
  };
};
