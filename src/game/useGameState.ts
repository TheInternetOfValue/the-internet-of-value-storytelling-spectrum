import { useEffect, useRef, useState } from "react";
import { gameState, type GameStateData } from "./GameState";

type Selector<T> = (state: GameStateData) => T;
type EqualityFn<T> = (prev: T, next: T) => boolean;

export const shallowEqual = <T extends Record<string, unknown>>(
  prev: T,
  next: T
) => {
  if (Object.is(prev, next)) return true;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!Object.is(prev[key], next[key])) return false;
  }
  return true;
};

export const useGameState = <T>(
  selector: Selector<T>,
  equality: EqualityFn<T> = Object.is
) => {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(equality);
  selectorRef.current = selector;
  equalityRef.current = equality;

  const [selected, setSelected] = useState(() =>
    selectorRef.current(gameState.getState())
  );

  useEffect(() => {
    return gameState.subscribe((state) => {
      const next = selectorRef.current(state);
      setSelected((prev) =>
        equalityRef.current(prev, next) ? prev : next
      );
    });
  }, []);

  return selected;
};

