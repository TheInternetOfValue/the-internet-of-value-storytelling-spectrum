import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpectrumScene from "@/components/SpectrumScene";
import {
  addReflection,
  advanceOneStep,
  applyModifier,
  computeCurrentSignalProfile,
  craftCombination,
  createInitialState,
  dictionary,
  getAdvanceDelta,
  getAvailableCombinations,
  getAvailableModifiers,
  getMetricDeltaLabel,
  getNextNodeId,
  getNode,
  resetRun,
  rules,
} from "@/lib/storytellingGame";
import type { SignalMetric, SignalProfile, StorytellingRunState } from "@/types/storytelling";

type LensMode = "truth" | "persuasion" | "distortion";

type GateChallenge = {
  title: string;
  prompt: string;
  placeholder: string;
  hint: string;
  validate: (answer: string) => boolean;
};

type TransitionCard = {
  from: string;
  to: string;
  delta: SignalProfile;
};

const signalKeys: SignalMetric[] = ["fidelity", "persuasion", "reach", "distortion"];
const lensModes: LensMode[] = ["truth", "persuasion", "distortion"];
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const gateKey = (from: string, to: string) => `${from}->${to}`;

const gateChallenges: Record<string, GateChallenge> = {
  "product->solution": {
    title: "Gate: Product -> Solution",
    prompt:
      "Show evidence this is a real solution. Include a before/after metric and a timeframe.",
    placeholder: "Example: conversion 2.1% -> 4.8% in 6 weeks",
    hint: "Need numbers + before/after + timeframe.",
    validate: (answer) => /\d/.test(answer) && /(->|to|from)/i.test(answer) && /(day|week|month|year)/i.test(answer),
  },
  "solution->protocol": {
    title: "Gate: Solution -> Protocol",
    prompt:
      "Write one governance rule that can be shared across actors. Must include WHEN and MUST.",
    placeholder:
      "When quality score drops below X, participants must submit remediation within 48h.",
    hint: "Need both 'when' and 'must' in your rule.",
    validate: (answer) => /when/i.test(answer) && /must/i.test(answer),
  },
  "protocol->math": {
    title: "Gate: Protocol -> Math",
    prompt:
      "Formalize one protocol rule as an expression with variables and an operator.",
    placeholder: "trust_score = (evidence_weight * validity) - distortion_penalty",
    hint: "Need variable letters and symbols like = + - * / < >.",
    validate: (answer) => /[a-zA-Z]/.test(answer) && /[=<>+\-*/]/.test(answer),
  },
};

const App = () => {
  const [state, setState] = useState<StorytellingRunState>(createInitialState);
  const [cameraMode, setCameraMode] = useState<"guided" | "explore">("guided");
  const [lensMode, setLensMode] = useState<LensMode>("truth");
  const [splitView, setSplitView] = useState(false);
  const [compareLens, setCompareLens] = useState<LensMode>("persuasion");
  const [mobileTab, setMobileTab] = useState<"controls" | "impact" | "log">("controls");
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [passedGateKeys, setPassedGateKeys] = useState<string[]>([]);
  const [pendingGateKey, setPendingGateKey] = useState<string | null>(null);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [transitionCard, setTransitionCard] = useState<TransitionCard | null>(null);
  const [transitionTick, setTransitionTick] = useState(0);

  const transitionTimerRef = useRef<number | null>(null);

  const currentNode = getNode(state.currentNodeId);
  const nextNodeId = getNextNodeId(state.currentNodeId);
  const canAdvance = Boolean(nextNodeId);

  const currentSignal = useMemo(() => computeCurrentSignalProfile(state), [state]);
  const availableCombinations = useMemo(() => getAvailableCombinations(state), [state]);
  const availableModifiers = useMemo(() => getAvailableModifiers(state), [state]);
  const { nextNode, delta: advanceDelta } = useMemo(() => getAdvanceDelta(state), [state]);

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

  const activeModifier = selectedModifier ?? appliedModifier;
  const latestEvent = state.history.at(-1);
  const progressPercent = (currentNode.order / dictionary.core_spine.length) * 100;
  const isComplete = state.currentNodeId === rules.run.target_node;
  const pendingGate = pendingGateKey ? gateChallenges[pendingGateKey] ?? null : null;

  const compareLensOptions = lensModes.filter((mode) => mode !== lensMode);

  useEffect(() => {
    if (compareLens === lensMode) {
      setCompareLens(lensMode === "truth" ? "persuasion" : "truth");
    }
  }, [compareLens, lensMode]);

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  const launchTransition = useCallback((from: string, to: string, delta: SignalProfile) => {
    clearTransitionTimer();
    setTransitionCard({ from, to, delta });
    setTransitionTick((value) => value + 1);
    transitionTimerRef.current = window.setTimeout(() => {
      setTransitionCard(null);
      transitionTimerRef.current = null;
    }, 1300);
  }, []);

  const performAdvance = useCallback(() => {
    if (!nextNode) return;
    launchTransition(currentNode.label, nextNode.label, advanceDelta);
    setState((prev) => advanceOneStep(prev));
  }, [nextNode, launchTransition, currentNode.label, advanceDelta]);

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

  useEffect(
    () => () => {
      clearTransitionTimer();
    },
    []
  );

  const handleCraft = () => {
    if (!selectedCombinationId) return;
    setState((prev) => craftCombination(prev, selectedCombinationId));
    setSelectedCombinationId("");
  };

  const handleModifier = () => {
    if (!selectedModifierId) return;
    setState((prev) => applyModifier(prev, selectedModifierId));
    setSelectedModifierId("");
  };

  const handleReflection = () => {
    if (!reflectionDraft.trim()) return;
    setState((prev) => addReflection(prev, reflectionDraft));
    setReflectionDraft("");
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
    setReflectionDraft("");
    setMobileTab("controls");
    setPassedGateKeys([]);
    setPendingGateKey(null);
    setGateAnswer("");
    setGateError("");
    setTransitionCard(null);
    clearTransitionTimer();
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

        <div className="status-chips">
          <span>Progress {Math.round(progressPercent)}%</span>
          <span>Camera {cameraMode}</span>
          <span>{selectedCombination ? `Combo Preview: ${selectedCombination.label}` : "No combo preview"}</span>
          <span>{activeModifier ? `Modifier Field: ${activeModifier.label}` : "No modifier field"}</span>
          <span>{latestEvent ? `Latest: ${latestEvent.detail}` : "Latest: no move yet"}</span>
        </div>
      </header>

      <main className="journey-layout">
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

          {transitionCard && (
            <div className="transition-card">
              <p>{transitionCard.from} {"->"} {transitionCard.to}</p>
              <div>
                {signalKeys.map((metric) => (
                  <span key={metric}>
                    {metric} {formatSigned(transitionCard.delta[metric])}
                  </span>
                ))}
              </div>
            </div>
          )}

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
            <button
              onClick={() => setMobileTab("log")}
              className={mobileTab === "log" ? "active" : ""}
            >
              Log
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
                    {combo.label}
                  </option>
                ))}
              </select>
              <button onClick={handleCraft} disabled={!selectedCombinationId}>
                Craft
              </button>
            </div>
            <p className="micro-note">
              {selectedCombination
                ? `${selectedCombination.description} | ${getMetricDeltaLabel(selectedCombination.metric_delta)}`
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
              {selectedModifier
                ? `Previewing modifier: ${selectedModifier.label} | ${getMetricDeltaLabel(selectedModifier.metric_delta)}`
                : appliedModifier
                  ? `Applied modifier: ${appliedModifier.label}`
                  : "No modifier selected"}
            </p>
          </section>

          <section className="panel-card impact-card">
            <p className="card-label">Impact</p>
            <p className="next-node">
              Advance Delta ({currentNode.label} {"->"} {nextNode?.label ?? "Complete"})
            </p>
            <ul className="delta-list">
              {signalKeys.map((metric) => (
                <li key={metric}>
                  <span>{metric}</span>
                  <strong>{formatSigned(advanceDelta[metric])}</strong>
                </li>
              ))}
            </ul>
            <p className="micro-note">Current signal: {getMetricDeltaLabel(currentSignal)}</p>
            <p className="micro-note">Gate status: {passedGateKeys.length}/3 cleared</p>
          </section>

          <section className="panel-card log-card">
            <p className="card-label">Reflection + Log</p>
            <div className="inline-control stacked">
              <input
                value={reflectionDraft}
                onChange={(event) => setReflectionDraft(event.target.value)}
                placeholder="What gained, what lost in this step?"
              />
              <button onClick={handleReflection} disabled={!reflectionDraft.trim()}>
                Log Reflection
              </button>
            </div>

            <ul className="history-list">
              {state.history.slice(-5).reverse().map((entry) => (
                <li key={`${entry.turn}-${entry.detail}`}>
                  <span>#{entry.turn}</span>
                  <p>{entry.detail}</p>
                </li>
              ))}
            </ul>

            <button onClick={handleReset} className="ghost-btn">
              Reset Journey
            </button>
          </section>
        </aside>
      </main>

      {pendingGate && (
        <div className="gate-overlay" role="dialog" aria-modal="true">
          <div className="gate-card">
            <p className="kicker">Verification Gate</p>
            <h2>{pendingGate.title}</h2>
            <p>{pendingGate.prompt}</p>
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
