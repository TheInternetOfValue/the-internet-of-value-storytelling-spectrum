import { useMemo, useState } from "react";
import SpectrumScene from "@/components/SpectrumScene";
import {
  addReflection,
  advanceOneStep,
  applyModifier,
  computeCurrentAxisValues,
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
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState("");

  const currentNode = getNode(state.currentNodeId);
  const nextNodeId = getNextNodeId(state.currentNodeId);
  const canAdvance = Boolean(nextNodeId);

  const currentSignal = useMemo(() => computeCurrentSignalProfile(state), [state]);
  const currentAxes = useMemo(() => computeCurrentAxisValues(state), [state]);
  const availableCombinations = useMemo(() => getAvailableCombinations(state), [state]);
  const availableModifiers = useMemo(() => getAvailableModifiers(state), [state]);
  const { nextNode, delta: advanceDelta } = useMemo(() => getAdvanceDelta(state), [state]);

  const progressPercent = (currentNode.order / dictionary.core_spine.length) * 100;
  const isComplete = state.currentNodeId === rules.run.target_node;

  const handleAdvance = () => {
    if (!canAdvance) return;
    setState((prev) => advanceOneStep(prev));
  };

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
  };

  return (
    <div className="journey-app">
      <header className="journey-header">
        <p className="kicker">3D Journey Mode</p>
        <h1>
          Thought -&gt; Networked Thought -&gt; Text -&gt; Audio -&gt; Images -&gt;
          Moving Images (No Audio) -&gt; Moving Images (With Audio) -&gt; Website
          -&gt; Product -&gt; Solution -&gt; Protocol -&gt; Math
        </h1>
        <p>
          Traverse one legal step at a time. Click the glowing next node in the scene or use Advance.
        </p>
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
            onAdvance={handleAdvance}
          />
          <div className="scene-hud">
            <span>Current: {currentNode.label}</span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
        </section>

        <aside className="journey-panel">
          <section className="panel-card">
            <p className="card-label">Step</p>
            <h2>{currentNode.label}</h2>
            <p className="card-copy">{currentNode.description}</p>
            <div className="progress-track">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="next-node">
              Next: {nextNode ? nextNode.label : "Journey Complete"}
            </p>
            <button onClick={handleAdvance} disabled={!canAdvance} className="primary-btn">
              {isComplete ? "Reached Math" : "Advance One Step"}
            </button>
          </section>

          <section className="panel-card">
            <p className="card-label">Advance Gain/Loss</p>
            {nextNode ? (
              <ul className="delta-list">
                {signalKeys.map((metric) => (
                  <li key={metric}>
                    <span>{metric}</span>
                    <strong>{formatSigned(advanceDelta[metric])}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-copy">You are at Math. No further legal advance.</p>
            )}
          </section>

          <section className="panel-card">
            <p className="card-label">Combinations</p>
            <div className="inline-control">
              <select
                value={selectedCombinationId}
                onChange={(event) => setSelectedCombinationId(event.target.value)}
              >
                <option value="">Select available combination</option>
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
              {availableCombinations.length > 0
                ? `${availableCombinations.length} available`
                : "No combinations available yet"}
            </p>
            {selectedCombinationId && (
              <p className="micro-note emphasis-note">
                {
                  availableCombinations.find((combo) => combo.id === selectedCombinationId)
                    ?.description
                }
              </p>
            )}
          </section>

          <section className="panel-card">
            <p className="card-label">Distribution Modifier</p>
            <div className="inline-control">
              <select
                value={selectedModifierId}
                onChange={(event) => setSelectedModifierId(event.target.value)}
              >
                <option value="">Select modifier</option>
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
          </section>

          <section className="panel-card">
            <p className="card-label">Reflection</p>
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
          </section>

          <section className="panel-card">
            <p className="card-label">Live Metrics</p>
            <div className="metric-mini">
              {dictionary.axes.map((axis) => (
                <div key={axis.id} className="metric-mini-row">
                  <div>
                    <span>{axis.label}</span>
                    <strong>{currentAxes[axis.id]}</strong>
                  </div>
                  <div className="mini-track">
                    <span style={{ width: `${currentAxes[axis.id]}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="micro-note">Signal: {getMetricDeltaLabel(currentSignal)}</p>
          </section>

          <section className="panel-card">
            <p className="card-label">Recent Moves</p>
            {state.history.length === 0 ? (
              <p className="card-copy">No moves yet.</p>
            ) : (
              <ul className="history-list">
                {state.history.slice(-6).reverse().map((entry) => (
                  <li key={`${entry.turn}-${entry.detail}`}>
                    <span>#{entry.turn}</span>
                    <p>{entry.detail}</p>
                  </li>
                ))}
              </ul>
            )}
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
