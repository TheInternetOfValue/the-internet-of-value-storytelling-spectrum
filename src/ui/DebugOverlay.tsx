import { shallowEqual, useGameState } from "@/game";

const DebugOverlay = () => {
  const state = useGameState(
    (data) => ({
      status: data.status,
      moves: data.moves,
      grid: data.grid,
    }),
    shallowEqual
  );

  return (
    <div className="debug-overlay">
      <div>State: {state.status}</div>
      <div>Moves: {state.moves}</div>
      <div>Grid:</div>
      <pre>{state.grid.map((row) => row.join(" ")).join("\n")}</pre>
    </div>
  );
};

export default DebugOverlay;

