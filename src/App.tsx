import { useEffect, useMemo, useState } from "react";
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
import type { SignalMetric, StorytellingRunState } from "@/types/storytelling";

const signalKeys: SignalMetric[] = ["fidelity", "persuasion", "reach", "distortion"];
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

const App = () => {
  const [state, setState] = useState<StorytellingRunState>(createInitialState);
  const [cameraMode, setCameraMode] = useState<"guided" | "explore">("guided");
  const [mobileTab, setMobileTab] = useState<"controls" | "impact" | "log">("controls");
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState("");

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

  const handleAdvance = () => {
    if (!canAdvance) return;
    setState((prev) => advanceOneStep(prev));
  };

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
        setState((prev) => (getNextNodeId(prev.currentNodeId) ? advanceOneStep(prev) : prev));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const handleReset = () => {
    setState(resetRun());
    setSelectedCombinationId("");
    setSelectedModifierId("");
    setReflectionDraft("");
    setMobileTab("controls");
  };

  return (
    <div className="journey-app">
      <header className="journey-header compact">
        <p className="kicker">Journey Step {currentNode.order}/{dictionary.core_spine.length}</p>
        <h1>
          {currentNode.label} {nextNode ? "->" : ""} {nextNode ? nextNode.label : "Complete: Math"}
        </h1>
        <p>{currentNode.description}</p>
        <div className="status-chips">
          <span>Progress {Math.round(progressPercent)}%</span>
          <span>Camera {cameraMode}</span>
          <span>{selectedCombination ? `Combo Preview: ${selectedCombination.label}` : "No combo preview"}</span>
          <span>{activeModifier ? `Modifier Field: ${activeModifier.label}` : "No modifier field"}</span>
          <span>{latestEvent ? `Latest: ${latestEvent.detail}` : "Latest: no move yet"}</span>
        </div>
      </header>

      <main className="journey-layout">
        <section className="scene-stage">
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
            cameraMode={cameraMode}
            onAdvance={handleAdvance}
          />
          <div className="scene-hud">
            <span>Current: {currentNode.label}</span>
            <span>Next: {nextNode ? nextNode.label : "Done"}</span>
            <span>Shortcut: Space / Right Arrow</span>
          </div>
        </section>

        <aside className={`journey-panel mobile-${mobileTab}`}>
          <div className="mobile-tabs">
            <button onClick={() => setMobileTab("controls")} className={mobileTab === "controls" ? "active" : ""}>
              Controls
            </button>
            <button onClick={() => setMobileTab("impact")} className={mobileTab === "impact" ? "active" : ""}>
              Impact
            </button>
            <button onClick={() => setMobileTab("log")} className={mobileTab === "log" ? "active" : ""}>
              Log
            </button>
          </div>

          <section className="panel-card controls-card">
            <p className="card-label">Action</p>
            <button onClick={handleAdvance} disabled={!canAdvance} className="primary-btn">
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
            <p className="next-node">Advance Delta ({currentNode.label} -&gt; {nextNode?.label ?? "Complete"})</p>
            <ul className="delta-list">
              {signalKeys.map((metric) => (
                <li key={metric}>
                  <span>{metric}</span>
                  <strong>{formatSigned(advanceDelta[metric])}</strong>
                </li>
              ))}
            </ul>
            <p className="micro-note">Current signal: {getMetricDeltaLabel(currentSignal)}</p>
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
    </div>
  );
};

export default App;
