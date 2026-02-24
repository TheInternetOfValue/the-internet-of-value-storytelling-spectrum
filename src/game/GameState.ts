export type GameStatus = "idle" | "playing" | "won";

export type LevelData = {
  id: string;
  name: string;
  size: number;
  tiles: number[];
};

export type GameStateData = {
  levelId: string | null;
  levelName: string | null;
  size: number;
  grid: number[][];
  targetTiles: number[];
  moves: number;
  status: GameStatus;
  ui: {
    showWin: boolean;
  };
};

type Listener = (state: GameStateData) => void;

const emptyGrid = () => [[-1]];

export class GameState {
  private state: GameStateData = {
    levelId: null,
    levelName: null,
    size: 1,
    grid: emptyGrid(),
    targetTiles: [-1],
    moves: 0,
    status: "idle",
    ui: {
      showWin: false,
    },
  };
  private listeners = new Set<Listener>();
  private activeLevel: LevelData | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  startLevel(level: LevelData) {
    this.activeLevel = level;
    this.setState({
      levelId: level.id,
      levelName: level.name,
      size: level.size,
      grid: tilesToGrid(level.tiles, level.size),
      targetTiles: [...level.tiles],
      moves: 0,
      status: "playing",
      ui: { showWin: false },
    });
  }

  resetLevel() {
    if (!this.activeLevel) return;
    this.startLevel(this.activeLevel);
  }

  setGrid(grid: number[][]) {
    this.setState({ grid });
  }

  incrementMoves() {
    this.setState({ moves: this.state.moves + 1 });
  }

  setWon() {
    this.setState({
      status: "won",
      ui: { ...this.state.ui, showWin: true },
    });
  }

  hideWin() {
    this.setState({
      ui: { ...this.state.ui, showWin: false },
    });
  }

  private setState(partial: Partial<GameStateData>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const gameState = new GameState();

export const tilesToGrid = (tiles: number[], size: number) => {
  const grid: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    const start = row * size;
    grid.push(tiles.slice(start, start + size));
  }
  return grid;
};

export const gridToTiles = (grid: number[][]) => grid.flat();

