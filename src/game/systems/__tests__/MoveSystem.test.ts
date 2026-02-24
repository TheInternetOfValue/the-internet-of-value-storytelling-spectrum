import { describe, expect, it } from "vitest";
import { tryMove } from "../MoveSystem";
import { isSolved } from "../WinCheckSystem";

describe("MoveSystem", () => {
  it("moves a tile adjacent to the empty slot", () => {
    const grid = [
      [1, 2, 3],
      [4, -1, 6],
      [7, 5, 8],
    ];
    const result = tryMove(grid, 2, 1);
    expect(result.moved).toBe(true);
    expect(result.grid[1][1]).toBe(5);
    expect(result.grid[2][1]).toBe(-1);
  });

  it("does not move a non-adjacent tile", () => {
    const grid = [
      [1, 2, 3],
      [4, -1, 6],
      [7, 5, 8],
    ];
    const result = tryMove(grid, 0, 0);
    expect(result.moved).toBe(false);
    expect(result.grid).toEqual(grid);
  });
});

describe("WinCheckSystem", () => {
  it("detects a solved grid", () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, -1],
    ];
    const target = [1, 2, 3, 4, 5, 6, 7, 8, -1];
    expect(isSolved(grid, target)).toBe(true);
  });
});

