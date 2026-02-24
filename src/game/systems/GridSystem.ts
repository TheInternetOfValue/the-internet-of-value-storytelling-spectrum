export const cloneGrid = (grid: number[][]) =>
  grid.map((row) => [...row]);

export const findEmpty = (grid: number[][]) => {
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === -1) {
        return { row, col };
      }
    }
  }
  return { row: 0, col: 0 };
};

export const isAdjacent = (
  a: { row: number; col: number },
  b: { row: number; col: number }
) => {
  const dRow = Math.abs(a.row - b.row);
  const dCol = Math.abs(a.col - b.col);
  return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1);
};

