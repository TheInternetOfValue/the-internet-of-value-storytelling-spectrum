export type AxisId =
  | "sensory_activation"
  | "ease_of_consumption"
  | "creation_effort"
  | "bias_perception_load"
  | "storytelling_effectiveness";

export type SignalMetric = "fidelity" | "persuasion" | "reach" | "distortion";

export type SignalProfile = Record<SignalMetric, number>;

export type AxisValues = Record<AxisId, number>;

export type SpineNode = {
  id: string;
  label: string;
  order: number;
  description: string;
  examples: string[];
  axis_values: AxisValues;
  signal_profile: SignalProfile;
};

export type CombinationRecipe = {
  id: string;
  label: string;
  inputs: string[];
  output: string;
  description: string;
  metric_delta: SignalProfile;
};

export type DistributionModifier = {
  id: string;
  label: string;
  metric_delta: SignalProfile;
};

export type StorytellingDictionary = {
  name: string;
  version: string;
  principles: string[];
  axes: Array<{ id: AxisId; label: string; description: string }>;
  core_spine: SpineNode[];
  combination_layer: CombinationRecipe[];
  extended_artifacts: Array<{ id: string; label: string; category: string }>;
  variable_vocabulary: {
    distribution: DistributionModifier[];
    interaction_depth: string[];
    verification_proof: string[];
    authority_signals: string[];
    translation_loss: string[];
    temporal_dynamics: string[];
    adoption_friction: string[];
    outcome_validation: string[];
    governance_bridge: string[];
    dynamics: string[];
  };
};

export type StorytellingRules = {
  name: string;
  version: string;
  run: {
    start_node: string;
    target_node: string;
    allow_skips: boolean;
    allow_reverse: boolean;
    step_mode: string;
  };
  progression_edges: [string, string][];
  actions: Array<{ id: string; label: string; description: string }>;
  unlock_logic: {
    combination_unlocked_when_all_inputs_visited_or_crafted: boolean;
    combination_can_only_be_crafted_once: boolean;
    modifier_can_only_be_applied_once: boolean;
  };
  scoring: {
    tracked_metrics: SignalMetric[];
    calculation: string;
    range: { min: number; max: number };
  };
  win_condition: {
    required_node: string;
    required_history_min_steps: number;
    description: string;
  };
};

export type HistoryEvent = {
  turn: number;
  action: "advance" | "combination" | "modifier" | "reflection" | "reset";
  detail: string;
};

export type StorytellingRunState = {
  currentNodeId: string;
  visitedNodeIds: string[];
  craftedCombinationIds: string[];
  craftedArtifactIds: string[];
  appliedModifierIds: string[];
  reflections: string[];
  history: HistoryEvent[];
  turn: number;
};
