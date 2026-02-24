import * as THREE from "three";
import { GameState } from "./GameState";
import { tryMove } from "./systems/MoveSystem";
import { isSolved } from "./systems/WinCheckSystem";
import type { InputManager } from "@/engine";

const TILE_SIZE = 1;
const TILE_GAP = 0.08;

export class GameScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  private readonly tilesGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private unsubscribe: (() => void) | null = null;

  private gridSignature = "";
  private size = 0;

  constructor(private readonly gameState: GameState) {
    this.scene.add(this.tilesGroup);
    this.camera.position.set(0, 0, 10);
    this.scene.background = new THREE.Color(0x0f1115);

    this.unsubscribe = this.gameState.subscribe((state) => {
      const signature = state.grid.flat().join(",");
      if (signature !== this.gridSignature || state.size !== this.size) {
        this.gridSignature = signature;
        this.size = state.size;
        this.rebuildGrid(state.grid);
      }
    });
  }

  dispose() {
    this.unsubscribe?.();
    this.disposeTiles();
  }

  resize(width: number, height: number) {
    const aspect = width / height || 1;
    const boardSize =
      this.size > 0
        ? this.size * TILE_SIZE + (this.size - 1) * TILE_GAP
        : 2;
    const padding = 0.35;
    const halfBoard = boardSize / 2 + padding;

    if (aspect >= 1) {
      this.camera.top = halfBoard;
      this.camera.bottom = -halfBoard;
      this.camera.left = -halfBoard * aspect;
      this.camera.right = halfBoard * aspect;
    } else {
      this.camera.left = -halfBoard;
      this.camera.right = halfBoard;
      this.camera.top = halfBoard / aspect;
      this.camera.bottom = -halfBoard / aspect;
    }

    this.camera.updateProjectionMatrix();
  }

  update(input: InputManager, renderer: THREE.WebGLRenderer) {
    const pointer = input.getPointer();
    if (!pointer.justPressed) return;

    const rect = renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const intersections = this.raycaster.intersectObjects(
      this.tilesGroup.children,
      false
    );
    if (intersections.length === 0) return;

    const hit = intersections[0].object as THREE.Mesh;
    const { row, col } = hit.userData as { row: number; col: number };
    const { moved, grid } = tryMove(this.gameState.getState().grid, row, col);
    if (!moved) return;

    this.gameState.setGrid(grid);
    this.gameState.incrementMoves();
    const { targetTiles } = this.gameState.getState();
    if (isSolved(grid, targetTiles)) {
      this.gameState.setWon();
    }
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.render(this.scene, this.camera);
  }

  private rebuildGrid(grid: number[][]) {
    this.disposeTiles();
    const size = grid.length;
    const boardSize = size * TILE_SIZE + (size - 1) * TILE_GAP;
    const offset = boardSize / 2 - TILE_SIZE / 2;

    grid.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value === -1) return;
        const texture = createTileTexture(value);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          colIndex * (TILE_SIZE + TILE_GAP) - offset,
          -(rowIndex * (TILE_SIZE + TILE_GAP) - offset),
          0
        );
        mesh.userData = { row: rowIndex, col: colIndex };
        this.tilesGroup.add(mesh);
      });
    });
  }

  private disposeTiles() {
    this.tilesGroup.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
      mesh.geometry.dispose();
    });
    this.tilesGroup.clear();
  }
}

const createTileTexture = (value: number) => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1f6feb";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

