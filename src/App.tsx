import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpectrumScene from "@/components/SpectrumScene";
import {
  advanceOneStep,
  applyModifier,
  axisLabelById,
  craftCombination,
  createInitialState,
  dictionary,
  getAdvanceImpactDelta,
  getArtifactLabel,
  getAvailableCombinations,
  getAvailableModifiers,
  getCombinationImpactDelta,
  getCurrentImpactAxes,
  getModifierImpactDelta,
  getNextNodeId,
  getNode,
  resetRun,
  rules,
} from "@/lib/storytellingGame";
import type { ImpactAxes, ImpactAxisId, StorytellingRunState } from "@/types/storytelling";

type LensMode = "truth" | "persuasion" | "distortion";

type GateChallenge = {
  title: string;
  prompt: string;
  placeholder: string;
  hint: string;
  templates: [string, string];
  validate: (answer: string) => boolean;
};

type FocusedImpact = {
  kind: "advance" | "combination" | "modifier";
  title: string;
  detail: string;
  delta: ImpactAxes;
};

const lensModes: LensMode[] = ["truth", "persuasion", "distortion"];
const impactAxisIds: ImpactAxisId[] = [
  "sensory_activation",
  "ease_of_consumption",
  "creation_effort",
];
const impactShortLabelById: Record<ImpactAxisId, string> = {
  sensory_activation: "Sensory",
  ease_of_consumption: "Ease",
  creation_effort: "Creation Effort",
};

const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const gateKey = (from: string, to: string) => `${from}->${to}`;
const formatImpactCompact = (delta: ImpactAxes) =>
  impactAxisIds
    .map((axisId) => `${impactShortLabelById[axisId]} ${formatSigned(delta[axisId])}`)
    .join(" | ");

const gateChallenges: Record<string, GateChallenge> = {
  "product->solution": {
    title: "Gate: Product -> Solution",
    prompt:
      "Show evidence this is a real solution. Include a before/after metric and a timeframe.",
    placeholder: "Example: conversion 2.1% -> 4.8% in 6 weeks",
    hint: "Need numbers + before/after + timeframe.",
    templates: [
      "Activation rate 18% -> 31% in 5 weeks after onboarding redesign.",
      "Support tickets per user 4.2 -> 1.7 in 2 months after workflow changes.",
    ],
    validate: (answer) =>
      /\d/.test(answer) &&
      /(->|to|from)/i.test(answer) &&
      /(day|week|month|year)/i.test(answer),
  },
  "solution->protocol": {
    title: "Gate: Solution -> Protocol",
    prompt:
      "Write one governance rule that can be shared across actors. Must include WHEN and MUST.",
    placeholder:
      "When quality score drops below X, participants must submit remediation within 48h.",
    hint: "Need both 'when' and 'must' in your rule.",
    templates: [
      "When response time exceeds 24 hours, moderators must publish a corrective plan within 48 hours.",
      "When validation fails twice in one week, contributors must submit evidence and peer review before merge.",
    ],
    validate: (answer) => /when/i.test(answer) && /must/i.test(answer),
  },
  "protocol->math": {
    title: "Gate: Protocol -> Math",
    prompt: "Formalize one protocol rule as an expression with variables and an operator.",
    placeholder: "trust_score = (evidence_weight * validity) - distortion_penalty",
    hint: "Need variable letters and symbols like = + - * / < >.",
    templates: [
      "quality_score = (verified_events * confidence) - error_penalty",
      "if response_time > threshold then risk = base_risk + escalation_factor",
    ],
    validate: (answer) => /[a-zA-Z]/.test(answer) && /[=<>+\-*/]/.test(answer),
  },
};

const App = () => {
  const [state, setState] = useState<StorytellingRunState>(createInitialState);
  const [cameraMode, setCameraMode] = useState<"guided" | "explore">("guided");
  const [lensMode, setLensMode] = useState<LensMode>("truth");
  const [splitView, setSplitView] = useState(false);
  const [compareLens, setCompareLens] = useState<LensMode>("persuasion");
  const [mobileTab, setMobileTab] = useState<"controls" | "impact">("controls");
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [passedGateKeys, setPassedGateKeys] = useState<string[]>([]);
  const [pendingGateKey, setPendingGateKey] = useState<string | null>(null);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [focusedImpact, setFocusedImpact] = useState<FocusedImpact | null>(null);
  const [transitionTick, setTransitionTick] = useState(0);

  const currentNode = getNode(state.currentNodeId);
  const nextNodeId = getNextNodeId(state.currentNodeId);
  const canAdvance = Boolean(nextNodeId);

  const currentImpactAxes = useMemo(() => getCurrentImpactAxes(state), [state]);
  const availableCombinations = useMemo(() => getAvailableCombinations(state), [state]);
  const availableModifiers = useMemo(() => getAvailableModifiers(state), [state]);
  const { nextNode, delta: advanceImpactDelta } = useMemo(
    () => getAdvanceImpactDelta(state),
    [state]
  );

  const selectedCombination = useMemo(
    () => dictionary.combination_layer.find((combo) => combo.id === selectedCombinationId) ?? null,
    [selectedCombinationId]
  );

  const selectedModifier = useMemo(
    () =>
      dictionary.variable_vocabulary.distribution.find(
        (modifier) => modifier.id === selectedModifierId
      ) ?? null,
    [selectedModifierId]
  );

  const appliedModifier = useMemo(() => {
    const id = state.appliedModifierIds.at(-1);
    if (!id) return null;
    return (
      dictionary.variable_vocabulary.distribution.find((modifier) => modifier.id === id) ?? null
    );
  }, [state.appliedModifierIds]);

  const selectedCombinationImpact = useMemo(
    () => (selectedCombination ? getCombinationImpactDelta(selectedCombination.id) : null),
    [selectedCombination]
  );

  const selectedModifierImpact = useMemo(
    () => (selectedModifier ? getModifierImpactDelta(selectedModifier.id) : null),
    [selectedModifier]
  );

  const appliedModifierImpact = useMemo(
    () => (appliedModifier ? getModifierImpactDelta(appliedModifier.id) : null),
    [appliedModifier]
  );

  const latestEvent = state.history.at(-1);
  const progressPercent = (currentNode.order / dictionary.core_spine.length) * 100;
  const isComplete = state.currentNodeId === rules.run.target_node;
  const pendingGate = pendingGateKey ? gateChallenges[pendingGateKey] ?? null : null;

  const compareLensOptions = lensModes.filter((mode) => mode !== lensMode);

  const defaultImpact: FocusedImpact = useMemo(
    () => ({
      kind: "advance",
      title: `${currentNode.label} -> ${nextNode?.label ?? "Complete"}`,
      detail: nextNode ? "Next core spine move" : "Core spine complete",
      delta: advanceImpactDelta,
    }),
    [advanceImpactDelta, currentNode.label, nextNode]
  );

  const activeImpact = focusedImpact ?? defaultImpact;

  useEffect(() => {
    if (compareLens === lensMode) {
      setCompareLens(lensMode === "truth" ? "persuasion" : "truth");
    }
  }, [compareLens, lensMode]);

  const performAdvance = useCallback(() => {
    if (!nextNode) return;

    setFocusedImpact({
      kind: "advance",
      title: `${currentNode.label} -> ${nextNode.label}`,
      detail: "Core spine move",
      delta: advanceImpactDelta,
    });
    setTransitionTick((value) => value + 1);
    setState((prev) => advanceOneStep(prev));
  }, [nextNode, currentNode.label, advanceImpactDelta]);

  const requestAdvance = useCallback(() => {
    if (!nextNodeId || !nextNode) return;

    const key = gateKey(currentNode.id, nextNode.id);
    const challenge = gateChallenges[key];
    if (challenge && !passedGateKeys.includes(key)) {
      setPendingGateKey(key);
      setGateAnswer("");
      setGateError("");
      return;
    }

    performAdvance();
  }, [nextNodeId, nextNode, currentNode.id, passedGateKeys, performAdvance]);

  const requestAdvanceRef = useRef(requestAdvance);
  useEffect(() => {
    requestAdvanceRef.current = requestAdvance;
  }, [requestAdvance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditing) return;

      if (event.code === "Space" || event.key === "ArrowRight") {
        event.preventDefault();
        requestAdvanceRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCraft = () => {
    if (!selectedCombinationId || !selectedCombination) return;

    const artifactLabel = getArtifactLabel(selectedCombination.output);
    const delta = getCombinationImpactDelta(selectedCombination.id);
    setFocusedImpact({
      kind: "combination",
      title: `${selectedCombination.label} -> ${artifactLabel}`,
      detail: "Combination crafted",
      delta,
    });

    setState((prev) => craftCombination(prev, selectedCombinationId));
    setSelectedCombinationId("");
  };

  const handleModifier = () => {
    if (!selectedModifierId || !selectedModifier) return;

    const delta = getModifierImpactDelta(selectedModifierId);
    setFocusedImpact({
      kind: "modifier",
      title: `Distribution: ${selectedModifier.label}`,
      detail: "Distribution field applied",
      delta,
    });

    setState((prev) => applyModifier(prev, selectedModifierId));
    setSelectedModifierId("");
  };

  const handleGateSubmit = () => {
    if (!pendingGateKey || !pendingGate) return;

    if (!pendingGate.validate(gateAnswer.trim())) {
      setGateError(pendingGate.hint);
      return;
    }

    setPassedGateKeys((prev) =>
      prev.includes(pendingGateKey) ? prev : [...prev, pendingGateKey]
    );
    setPendingGateKey(null);
    setGateAnswer("");
    setGateError("");
    performAdvance();
  };

  const handleReset = () => {
    setState(resetRun());
    setSelectedCombinationId("");
    setSelectedModifierId("");
    setMobileTab("controls");
    setPassedGateKeys([]);
    setPendingGateKey(null);
    setGateAnswer("");
    setGateError("");
    setFocusedImpact(null);
  };

  return (
    <div className="journey-app">
      <header className="journey-header compact">
        <p className="kicker">Journey Step {currentNode.order}/{dictionary.core_spine.length}</p>
        <h1>
          {currentNode.label} {nextNode ? "->" : ""} {nextNode ? nextNode.label : "Complete: Math"}
        </h1>
        <p>{currentNode.description}</p>

        <div className="lens-switch">
          {lensModes.map((mode) => (
            <button
              key={mode}
              onClick={() => setLensMode(mode)}
              className={lensMode === mode ? "active" : ""}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)} Lens
            </button>
          ))}
        </div>

        <div className="split-controls">
          <button
            onClick={() => setSplitView((value) => !value)}
            className={splitView ? "active" : ""}
          >
            {splitView ? "Disable Split View" : "Enable Split View"}
          </button>
          {splitView && (
            <select
              value={compareLens}
              onChange={(event) => setCompareLens(event.target.value as LensMode)}
            >
              {compareLensOptions.map((mode) => (
                <option key={mode} value={mode}>
                  Compare {mode}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="micro-note lens-note">
          Split view compares lens interpretation, while impact stays on the same 3 axes.
        </p>

        <div className="status-chips">
          <span>Progress {Math.round(progressPercent)}%</span>
          <span>Camera {cameraMode}</span>
          <span>
            Profile: {impactShortLabelById.sensory_activation} {currentImpactAxes.sensory_activation} |{" "}
            {impactShortLabelById.ease_of_consumption} {currentImpactAxes.ease_of_consumption} |{" "}
            {impactShortLabelById.creation_effort} {currentImpactAxes.creation_effort}
          </span>
          <span>{appliedModifier ? `Modifier: ${appliedModifier.label}` : "Modifier: none"}</span>
          <span>{latestEvent ? `Latest: ${latestEvent.detail}` : "Latest: no move yet"}</span>
        </div>
      </header>

      <main className={`journey-layout${splitView ? " split-active" : ""}`}>
        <section className={`scene-stage${splitView ? " split-mode" : ""}`}>
          <div className={`scene-shell${splitView ? " dual" : ""}`}>
            <div className="scene-pane primary-pane">
              {splitView && <div className="pane-badge">Primary • {lensMode}</div>}
              <SpectrumScene
                nodes={dictionary.core_spine}
                currentNodeId={state.currentNodeId}
                nextNodeId={nextNodeId}
                visitedNodeIds={state.visitedNodeIds}
                craftedCombinationIds={state.craftedCombinationIds}
                availableCombinationIds={availableCombinations.map((combo) => combo.id)}
                selectedCombinationId={selectedCombinationId}
                selectedModifierId={selectedModifierId}
                appliedModifierIds={state.appliedModifierIds}
                lensMode={lensMode}
                transitionTick={transitionTick}
                cameraMode={cameraMode}
                interactive
                onAdvance={requestAdvance}
              />
            </div>

            {splitView && (
              <div className="scene-pane compare-pane">
                <div className="pane-badge">Compare • {compareLens}</div>
                <SpectrumScene
                  nodes={dictionary.core_spine}
                  currentNodeId={state.currentNodeId}
                  nextNodeId={nextNodeId}
                  visitedNodeIds={state.visitedNodeIds}
                  craftedCombinationIds={state.craftedCombinationIds}
                  availableCombinationIds={availableCombinations.map((combo) => combo.id)}
                  selectedCombinationId={selectedCombinationId}
                  selectedModifierId={selectedModifierId}
                  appliedModifierIds={state.appliedModifierIds}
                  lensMode={compareLens}
                  transitionTick={transitionTick}
                  cameraMode="guided"
                  interactive={false}
                  onAdvance={requestAdvance}
                />
              </div>
            )}
          </div>

          <div className="transition-card">
            {focusedImpact && (
              <button
                type="button"
                className="transition-close"
                onClick={() => setFocusedImpact(null)}
                aria-label="Dismiss focused impact"
              >
                Dismiss
              </button>
            )}
            <p>{activeImpact.title}</p>
            <p className="impact-detail">{activeImpact.detail}</p>
            <div>
              {impactAxisIds.map((axisId) => (
                <span key={axisId}>
                  {impactShortLabelById[axisId]} {formatSigned(activeImpact.delta[axisId])}
                </span>
              ))}
            </div>
          </div>

          <div className="scene-hud">
            <span>Current: {currentNode.label}</span>
            <span>Next: {nextNode ? nextNode.label : "Done"}</span>
            <span>Shortcut: Space / Right Arrow</span>
          </div>
        </section>

        <aside className={`journey-panel mobile-${mobileTab}`}>
          <div className="mobile-tabs">
            <button
              onClick={() => setMobileTab("controls")}
              className={mobileTab === "controls" ? "active" : ""}
            >
              Controls
            </button>
            <button
              onClick={() => setMobileTab("impact")}
              className={mobileTab === "impact" ? "active" : ""}
            >
              Impact
            </button>
          </div>

          <section className="panel-card controls-card">
            <p className="card-label">Action</p>
            <button onClick={requestAdvance} disabled={!canAdvance} className="primary-btn">
              {isComplete ? "Reached Math" : "Advance One Step"}
            </button>
            <button
              onClick={() => setCameraMode((prev) => (prev === "guided" ? "explore" : "guided"))}
              className="ghost-btn camera-toggle"
            >
              {cameraMode === "guided" ? "Switch To Explore Camera" : "Switch To Guided Camera"}
            </button>
            <p className="micro-note">Explore mode: drag to orbit, scroll to zoom.</p>

            <div className="inline-control">
              <select
                value={selectedCombinationId}
                onChange={(event) => setSelectedCombinationId(event.target.value)}
              >
                <option value="">Select combination</option>
                {availableCombinations.map((combo) => (
                  <option key={combo.id} value={combo.id}>
                    {combo.label} {"->"} {getArtifactLabel(combo.output)}
                  </option>
                ))}
              </select>
              <button onClick={handleCraft} disabled={!selectedCombinationId}>
                Craft
              </button>
            </div>
            <p className="micro-note">
              {selectedCombination && selectedCombinationImpact
                ? `${selectedCombination.label} -> ${getArtifactLabel(
                    selectedCombination.output
                  )} | ${formatImpactCompact(selectedCombinationImpact)}`
                : availableCombinations.length > 0
                  ? `${availableCombinations.length} combinations available`
                  : "No combinations available yet"}
            </p>

            <div className="inline-control">
              <select
                value={selectedModifierId}
                onChange={(event) => setSelectedModifierId(event.target.value)}
              >
                <option value="">Select distribution modifier</option>
                {availableModifiers.map((modifier) => (
                  <option key={modifier.id} value={modifier.id}>
                    {modifier.label}
                  </option>
                ))}
              </select>
              <button onClick={handleModifier} disabled={!selectedModifierId}>
                Apply
              </button>
            </div>
            <p className="micro-note">
              {selectedModifier && selectedModifierImpact
                ? `Preview: ${selectedModifier.label} | ${formatImpactCompact(selectedModifierImpact)}`
                : appliedModifier && appliedModifierImpact
                  ? `Applied: ${appliedModifier.label} | ${formatImpactCompact(appliedModifierImpact)}`
                  : "No modifier selected"}
            </p>

            <button onClick={handleReset} className="ghost-btn">
              Reset Journey
            </button>
          </section>

          <section className="panel-card impact-card">
            <p className="card-label">Impact</p>
            <p className="next-node">{activeImpact.title}</p>
            <p className="micro-note">{activeImpact.detail}</p>
            <ul className="delta-list">
              {impactAxisIds.map((axisId) => (
                <li key={axisId}>
                  <span>{axisLabelById[axisId]}</span>
                  <strong>{formatSigned(activeImpact.delta[axisId])}</strong>
                </li>
              ))}
            </ul>
            <p className="micro-note">
              Current profile: {impactShortLabelById.sensory_activation} {currentImpactAxes.sensory_activation} |{" "}
              {impactShortLabelById.ease_of_consumption} {currentImpactAxes.ease_of_consumption} |{" "}
              {impactShortLabelById.creation_effort} {currentImpactAxes.creation_effort}
            </p>
            <p className="micro-note">Gate status: {passedGateKeys.length}/3 cleared</p>
          </section>
        </aside>
      </main>

      {pendingGate && (
        <div className="gate-overlay" role="dialog" aria-modal="true">
          <div className="gate-card">
            <p className="kicker">Verification Gate</p>
            <h2>{pendingGate.title}</h2>
            <p>{pendingGate.prompt}</p>

            <div className="gate-templates">
              {pendingGate.templates.map((template, index) => (
                <button
                  key={`${pendingGate.title}-template-${index}`}
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setGateAnswer(template);
                    setGateError("");
                  }}
                >
                  Use Template {index + 1}
                </button>
              ))}
            </div>

            <input
              value={gateAnswer}
              onChange={(event) => setGateAnswer(event.target.value)}
              placeholder={pendingGate.placeholder}
              autoFocus
            />
            {gateError && <p className="gate-error">{gateError}</p>}
            <div className="gate-actions">
              <button onClick={() => setPendingGateKey(null)} className="ghost-btn">
                Cancel
              </button>
              <button onClick={handleGateSubmit} className="primary-btn">
                Validate + Advance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
