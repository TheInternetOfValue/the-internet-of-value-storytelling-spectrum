import { gridToTiles } from "../GameState";

export const isSolved = (grid: number[][], targetTiles: number[]) => {
  const tiles = gridToTiles(grid);
  if (tiles.length !== targetTiles.length) return false;
  return tiles.every((tile, index) => tile === targetTiles[index]);
};

