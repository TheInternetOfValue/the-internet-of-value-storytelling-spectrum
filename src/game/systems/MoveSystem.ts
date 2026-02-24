import { cloneGrid, findEmpty, isAdjacent } from "./GridSystem";

export const tryMove = (
  grid: number[][],
  row: number,
  col: number
) => {
  const empty = findEmpty(grid);
  if (!isAdjacent(empty, { row, col })) {
    return { moved: false, grid };
  }

  const next = cloneGrid(grid);
  next[empty.row][empty.col] = grid[row][col];
  next[row][col] = -1;
  return { moved: true, grid: next };
};

