import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EngineLoop, InputManager } from "@/engine";
import { gameState } from "@/game";
import { GameScene } from "@/game/GameScene";
import { loadLevels } from "@/game/levels/levelLoader";

const levels = loadLevels();

const GameCanvas = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    const input = new InputManager();
    input.bind();

    const scene = new GameScene(gameState);
    const levels = loadLevels();
    if (levels[0]) {
      gameState.startLevel(levels[0]);
    }

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      scene.resize(clientWidth, clientHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = new EngineLoop(
      () => {
        scene.update(input, renderer);
        input.updateFrame();
      },
      () => {
        scene.render(renderer);
      }
    );
    loop.start();

    return () => {
      loop.stop();
      window.removeEventListener("resize", resize);
      input.unbind();
      scene.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="game-canvas" ref={containerRef} />;
};

export default GameCanvas;

