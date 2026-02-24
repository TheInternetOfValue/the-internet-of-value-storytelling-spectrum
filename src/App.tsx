import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpectrumScene from "@/components/SpectrumScene";
import {
  advanceOneStep,
  applyModifier,
  craftCombination,
  createInitialState,
  dictionary,
  getAdvanceImpactDelta,
  getArtifactLabel,
  getAvailableCombinations,
  getAvailableModifiers,
  getCombinationImpactDelta,
  getModifierImpactDelta,
  getNextNodeId,
  getNode,
  resetRun,
} from "@/lib/storytellingGame";
import type {
  ActionFocusAnchor,
  DistributionModifier,
  ImpactAxes,
  ImpactAxisId,
  StorytellingRunState,
} from "@/types/storytelling";

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
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatImpactCompact = (delta: ImpactAxes) =>
  impactAxisIds
    .map((axisId) => `${impactShortLabelById[axisId]} ${formatSigned(delta[axisId])}`)
    .join(" | ");
const getDistributionById = (modifierId: string): DistributionModifier | null =>
  dictionary.variable_vocabulary.distribution.find((modifier) => modifier.id === modifierId) ?? null;

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
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [passedGateKeys, setPassedGateKeys] = useState<string[]>([]);
  const [pendingGateKey, setPendingGateKey] = useState<string | null>(null);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [focusedImpact, setFocusedImpact] = useState<FocusedImpact | null>(null);
  const [impactAnchor, setImpactAnchor] = useState<ActionFocusAnchor | null>(null);
  const [impactPinned, setImpactPinned] = useState(false);
  const [transitionTick, setTransitionTick] = useState(0);
  const impactDismissTimerRef = useRef<number | null>(null);
  const impactPinnedRef = useRef(false);

  const currentNode = getNode(state.currentNodeId);
  const nextNodeId = getNextNodeId(state.currentNodeId);

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
  const pendingGate = pendingGateKey ? gateChallenges[pendingGateKey] ?? null : null;
  const activeDistribution = selectedModifier ?? appliedModifier;
  const activeDistributionImpact = selectedModifierImpact ?? appliedModifierImpact;

  const clearImpactDismissTimer = useCallback(() => {
    if (impactDismissTimerRef.current !== null) {
      window.clearTimeout(impactDismissTimerRef.current);
      impactDismissTimerRef.current = null;
    }
  }, []);

  const dismissFocusedImpact = useCallback(() => {
    clearImpactDismissTimer();
    impactPinnedRef.current = false;
    setImpactPinned(false);
    setFocusedImpact(null);
    setImpactAnchor(null);
  }, [clearImpactDismissTimer]);

  const scheduleImpactDismiss = useCallback(
    (delayMs = 2500) => {
      clearImpactDismissTimer();
      if (!focusedImpact || impactPinnedRef.current) return;

      impactDismissTimerRef.current = window.setTimeout(() => {
        if (impactPinnedRef.current) return;
        setFocusedImpact(null);
        setImpactAnchor(null);
      }, delayMs);
    },
    [clearImpactDismissTimer, focusedImpact]
  );

  useEffect(() => {
    if (!focusedImpact) {
      clearImpactDismissTimer();
      impactPinnedRef.current = false;
      setImpactPinned(false);
      return;
    }

    impactPinnedRef.current = false;
    setImpactPinned(false);
    scheduleImpactDismiss(2500);
  }, [clearImpactDismissTimer, focusedImpact, scheduleImpactDismiss]);

  useEffect(() => () => clearImpactDismissTimer(), [clearImpactDismissTimer]);

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

  const handleCraft = (combinationId = selectedCombinationId) => {
    if (!combinationId) return;
    const combo =
      dictionary.combination_layer.find((entry) => entry.id === combinationId) ?? selectedCombination;
    if (!combo) return;

    const artifactLabel = getArtifactLabel(combo.output);
    const delta = getCombinationImpactDelta(combo.id);
    setFocusedImpact({
      kind: "combination",
      title: `${combo.label} -> ${artifactLabel}`,
      detail: "Combination crafted",
      delta,
    });

    setState((prev) => craftCombination(prev, combinationId));
    setSelectedCombinationId("");
  };

  const handleModifier = (modifierId = selectedModifierId) => {
    if (!modifierId) return;
    const modifier = getDistributionById(modifierId) ?? selectedModifier;
    if (!modifier) return;

    const delta = getModifierImpactDelta(modifier.id);
    setFocusedImpact({
      kind: "modifier",
      title: `Distribution: ${modifier.label}`,
      detail: modifier.description,
      delta,
    });

    setState((prev) => applyModifier(prev, modifier.id));
    setSelectedModifierId("");
  };

  const handleSelectCombination = (combinationId: string) => {
    const combo = dictionary.combination_layer.find((entry) => entry.id === combinationId);
    if (!combo) return;

    const artifactLabel = getArtifactLabel(combo.output);
    const delta = getCombinationImpactDelta(combo.id);
    setSelectedCombinationId(combo.id);
    setFocusedImpact({
      kind: "combination",
      title: `${combo.label} -> ${artifactLabel}`,
      detail: "Combination preview (click combo again to craft)",
      delta,
    });
  };

  const handleSelectModifier = (modifierId: string) => {
    const modifier = getDistributionById(modifierId);
    if (!modifier) return;

    const delta = getModifierImpactDelta(modifier.id);
    setSelectedModifierId(modifier.id);
    setFocusedImpact({
      kind: "modifier",
      title: `Distribution: ${modifier.label}`,
      detail: `Preview: ${modifier.description} (click beacon again to apply)`,
      delta,
    });
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
    setPassedGateKeys([]);
    setPendingGateKey(null);
    setGateAnswer("");
    setGateError("");
    dismissFocusedImpact();
  };

  const handleActionFocus = (anchor: ActionFocusAnchor) => {
    setImpactAnchor({
      x: clamp(anchor.x, 0.2, 0.8),
      y: clamp(anchor.y + 0.08, 0.12, 0.74),
    });
  };

  const handleImpactPointerEnter = () => {
    impactPinnedRef.current = true;
    setImpactPinned(true);
    clearImpactDismissTimer();
  };

  const handleImpactPointerLeave = () => {
    impactPinnedRef.current = false;
    setImpactPinned(false);
    scheduleImpactDismiss(1200);
  };

  const handleImpactPointerDown = () => {
    impactPinnedRef.current = true;
    setImpactPinned(true);
    clearImpactDismissTimer();
  };

  return (
    <div className="journey-app">
      <header className="journey-header compact">
        <p className="kicker">Journey Step {currentNode.order}/{dictionary.core_spine.length}</p>
        <h1>
          {currentNode.label} {nextNode ? "->" : ""} {nextNode ? nextNode.label : "Complete: Math"}
        </h1>
        <p>{currentNode.description}</p>

        <div className="header-meta">
          <p className="status-line">
            Progress {Math.round(progressPercent)}% | Gates {passedGateKeys.length}/3 |{" "}
            {latestEvent ? `Latest: ${latestEvent.detail}` : "Latest: no move yet"}
          </p>
          <button onClick={handleReset} className="header-reset">
            Reset Journey
          </button>
        </div>
      </header>

      <main className="journey-layout">
        <section className="scene-stage">
          <div className="scene-shell">
            <div className="scene-pane primary-pane">
              <SpectrumScene
                nodes={dictionary.core_spine}
                currentNodeId={state.currentNodeId}
                nextNodeId={nextNodeId}
                visitedNodeIds={state.visitedNodeIds}
                craftedCombinationIds={state.craftedCombinationIds}
                availableCombinationIds={availableCombinations.map((combo) => combo.id)}
                selectedCombinationId={selectedCombinationId}
                availableModifierIds={availableModifiers.map((modifier) => modifier.id)}
                selectedModifierId={selectedModifierId}
                appliedModifierIds={state.appliedModifierIds}
                lensMode="truth"
                transitionTick={transitionTick}
                interactive
                onAdvance={requestAdvance}
                onSelectCombination={handleSelectCombination}
                onCraftCombination={handleCraft}
                onSelectModifier={handleSelectModifier}
                onApplyModifier={handleModifier}
                onActionFocus={handleActionFocus}
              />
            </div>
          </div>

          {focusedImpact && (
            <div
              className={`transition-card${impactAnchor ? " anchored" : ""}`}
              style={
                impactAnchor
                  ? {
                      left: `${impactAnchor.x * 100}%`,
                      top: `${impactAnchor.y * 100}%`,
                    }
                  : undefined
              }
              onPointerEnter={handleImpactPointerEnter}
              onPointerLeave={handleImpactPointerLeave}
              onPointerDown={handleImpactPointerDown}
            >
              <button
                type="button"
                className="transition-close"
                onClick={dismissFocusedImpact}
                aria-label="Dismiss focused impact"
              >
                Dismiss
              </button>
              {impactPinned && <p className="impact-pin">Pinned</p>}
              <p>{focusedImpact.title}</p>
              <p className="impact-detail">{focusedImpact.detail}</p>
              <div>
                {impactAxisIds.map((axisId) => (
                  <span key={axisId}>
                    {impactShortLabelById[axisId]} {formatSigned(focusedImpact.delta[axisId])}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeDistribution && (
            <div className="distribution-card">
              <p>
                <span
                  className="distribution-dot"
                  style={{ backgroundColor: activeDistribution.color_hex }}
                  aria-hidden="true"
                />
                Distribution Field: {activeDistribution.label}
              </p>
              <p className="impact-detail">{activeDistribution.description}</p>
              {activeDistributionImpact && (
                <p className="micro-note">Impact preview: {formatImpactCompact(activeDistributionImpact)}</p>
              )}
            </div>
          )}

          <div className="scene-hud">
            <span>Current: {currentNode.label}</span>
            <span>Next: {nextNode ? nextNode.label : "Done"}</span>
            <span>Shortcut: Space / Right Arrow</span>
          </div>
        </section>
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
