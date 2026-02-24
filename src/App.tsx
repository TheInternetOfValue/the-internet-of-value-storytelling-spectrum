import { useMemo, useState } from "react";
import {
  addReflection,
  advanceOneStep,
  applyModifier,
  computeCurrentAxisValues,
  computeCurrentSignalProfile,
  craftCombination,
  createInitialState,
  dictionary,
  getArtifactLabel,
  getAvailableCombinations,
  getAvailableModifiers,
  getMetricDeltaLabel,
  getNode,
  resetRun,
  rules,
} from "@/lib/storytellingGame";
import type { StorytellingRunState } from "@/types/storytelling";

const App = () => {
  const [state, setState] = useState<StorytellingRunState>(createInitialState);
  const [selectedCombinationId, setSelectedCombinationId] = useState<string>("");
  const [selectedModifierId, setSelectedModifierId] = useState<string>("");
  const [reflectionDraft, setReflectionDraft] = useState<string>("");

  const currentNode = getNode(state.currentNodeId);
  const currentSignal = useMemo(() => computeCurrentSignalProfile(state), [state]);
  const currentAxes = useMemo(() => computeCurrentAxisValues(state), [state]);
  const availableCombinations = useMemo(() => getAvailableCombinations(state), [state]);
  const availableModifiers = useMemo(() => getAvailableModifiers(state), [state]);

  const canAdvance = state.currentNodeId !== rules.run.target_node;

  const handleAdvance = () => {
    setState((prev) => advanceOneStep(prev));
  };

  const handleCraftCombination = () => {
    if (!selectedCombinationId) return;
    setState((prev) => craftCombination(prev, selectedCombinationId));
    setSelectedCombinationId("");
  };

  const handleApplyModifier = () => {
    if (!selectedModifierId) return;
    setState((prev) => applyModifier(prev, selectedModifierId));
    setSelectedModifierId("");
  };

  const handleAddReflection = () => {
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
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Storytelling Spectrum Playground</p>
        <h1>
          Thought -&gt; Networked Thought -&gt; Text -&gt; Audio -&gt; Images
          -&gt; Moving Images -&gt; Website -&gt; Product -&gt; Solution -&gt;
          Protocol -&gt; Math
        </h1>
        <p className="hero-copy">
          One move at a time. No skips. Every move must show gain and loss.
        </p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Core Spine</h2>
          <ol className="spine-list">
            {dictionary.core_spine.map((node) => {
              const isCurrent = node.id === state.currentNodeId;
              const isVisited = state.visitedNodeIds.includes(node.id);
              return (
                <li
                  key={node.id}
                  className={`spine-item${isCurrent ? " current" : ""}${isVisited ? " visited" : ""}`}
                >
                  <div className="spine-order">{node.order}</div>
                  <div>
                    <div className="spine-label">{node.label}</div>
                    <div className="spine-note">{node.description}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="panel emphasis">
          <h2>Interaction</h2>
          <div className="node-card">
            <p className="node-eyebrow">Current Node</p>
            <h3>{currentNode.label}</h3>
            <p>{currentNode.description}</p>
            <p className="examples">Examples: {currentNode.examples.join(" | ")}</p>
          </div>

          <div className="controls">
            <button className="action-btn" onClick={handleAdvance} disabled={!canAdvance}>
              Advance One Step
            </button>

            <div className="control-row">
              <select
                value={selectedCombinationId}
                onChange={(event) => setSelectedCombinationId(event.target.value)}
              >
                <option value="">Select combination recipe</option>
                {availableCombinations.map((combo) => (
                  <option key={combo.id} value={combo.id}>
                    {combo.label}
                  </option>
                ))}
              </select>
              <button onClick={handleCraftCombination} disabled={!selectedCombinationId}>
                Craft
              </button>
            </div>

            <div className="control-row">
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
              <button onClick={handleApplyModifier} disabled={!selectedModifierId}>
                Apply
              </button>
            </div>

            <div className="control-row reflection-row">
              <input
                type="text"
                placeholder="Reflection: what gained, what lost?"
                value={reflectionDraft}
                onChange={(event) => setReflectionDraft(event.target.value)}
              />
              <button onClick={handleAddReflection} disabled={!reflectionDraft.trim()}>
                Log
              </button>
            </div>

            <button className="ghost-btn" onClick={handleReset}>
              Reset Run
            </button>
          </div>

          <div className="combo-grid">
            <h3>Combination Layer</h3>
            {dictionary.combination_layer.map((combo) => {
              const crafted = state.craftedCombinationIds.includes(combo.id);
              return (
                <article key={combo.id} className={`combo-card${crafted ? " crafted" : ""}`}>
                  <p className="combo-title">{combo.label}</p>
                  <p className="combo-io">
                    {combo.inputs.join(" + ")}
                    {" -> "}
                    {combo.output}
                  </p>
                  <p className="combo-desc">{combo.description}</p>
                  <p className="combo-delta">{getMetricDeltaLabel(combo.metric_delta)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>Metrics</h2>

          <div className="metric-group">
            {dictionary.axes.map((axis) => (
              <div key={axis.id} className="metric-row">
                <div className="metric-head">
                  <span>{axis.label}</span>
                  <strong>{currentAxes[axis.id]}</strong>
                </div>
                <div className="meter">
                  <span style={{ width: `${currentAxes[axis.id]}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h3>Signal Profile</h3>
          <div className="metric-group">
            {(Object.keys(currentSignal) as Array<keyof typeof currentSignal>).map((metricKey) => (
              <div key={metricKey} className="metric-row">
                <div className="metric-head">
                  <span>{metricKey}</span>
                  <strong>{currentSignal[metricKey]}</strong>
                </div>
                <div className="meter alt">
                  <span style={{ width: `${currentSignal[metricKey]}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="chips">
            <p>Crafted Artifacts</p>
            <div className="chip-row">
              {state.craftedArtifactIds.length === 0 ? (
                <span className="chip empty">none yet</span>
              ) : (
                state.craftedArtifactIds.map((artifactId) => (
                  <span key={artifactId} className="chip">
                    {getArtifactLabel(artifactId)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="chips">
            <p>Distribution Applied</p>
            <div className="chip-row">
              {state.appliedModifierIds.length === 0 ? (
                <span className="chip empty">none yet</span>
              ) : (
                state.appliedModifierIds.map((modifierId) => (
                  <span key={modifierId} className="chip">
                    {modifierId}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="history">
            <h3>Run History</h3>
            {state.history.length === 0 ? (
              <p className="empty-note">No moves yet.</p>
            ) : (
              <ul>
                {state.history.slice(-8).reverse().map((entry) => (
                  <li key={`${entry.turn}-${entry.detail}`}>
                    <span>#{entry.turn}</span>
                    <p>
                      <strong>{entry.action}</strong>
                      <br />
                      {entry.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
