import level1 from "./level1.json";
import type { LevelData } from "../GameState";

const levels: LevelData[] = [level1];

export const loadLevels = () => levels;

export const getLevelById = (id: string) =>
  levels.find((level) => level.id === id) ?? levels[0];

