import { gameState, shallowEqual, useGameState } from "@/game";
import { loadLevels } from "@/game/levels/levelLoader";

const levels = loadLevels();

const Hud = () => {
  const state = useGameState(
    (data) => ({
      levelId: data.levelId,
      levelName: data.levelName,
      moves: data.moves,
      showWin: data.ui.showWin,
    }),
    shallowEqual
  );

  const activeLevelId = state.levelId ?? levels[0]?.id ?? "";

  return (
    <div className="hud">
      <div className="hud-panel">
        <div className="hud-title">{state.levelName ?? "Puzzle"}</div>
        <div className="hud-meta">Moves: {state.moves}</div>
        <div className="hud-actions">
          <select
            value={activeLevelId}
            onChange={(event) => {
              const level = levels.find(
                (entry) => entry.id === event.target.value
              );
              if (level) gameState.startLevel(level);
            }}
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => gameState.resetLevel()}>
            Restart
          </button>
        </div>
      </div>
      {state.showWin && (
        <div className="hud-win">
          <div className="hud-win-card">
            <div className="hud-win-title">Level Complete</div>
            <div className="hud-win-body">Moves: {state.moves}</div>
            <button
              type="button"
              onClick={() => {
                gameState.hideWin();
                gameState.resetLevel();
              }}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hud;

