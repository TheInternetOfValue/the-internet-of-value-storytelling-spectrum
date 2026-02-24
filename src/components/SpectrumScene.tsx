import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { dictionary } from "@/lib/storytellingGame";
import type { CombinationRecipe, SpineNode } from "@/types/storytelling";

type SpectrumSceneProps = {
  nodes: SpineNode[];
  currentNodeId: string;
  nextNodeId: string | null;
  visitedNodeIds: string[];
  craftedCombinationIds: string[];
  availableCombinationIds: string[];
  cameraMode: "guided" | "explore";
  onAdvance: () => void;
};

type LinkRef = {
  from: string;
  to: string;
  line: THREE.Line;
};

type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  targetPosition: THREE.Vector3;
  nodePositions: Map<string, THREE.Vector3>;
  nodeMeshes: Map<string, THREE.Mesh>;
  spineLinks: LinkRef[];
  comboLines: Map<string, THREE.Line>;
  traveler: THREE.Mesh;
  pulseRing: THREE.Mesh;
  frameId: number;
  cleanupResize: () => void;
  cleanupPointer: () => void;
};

const colors = {
  bgA: 0x07131a,
  bgB: 0x0e2630,
  nodeIdle: 0x57707a,
  nodeVisited: 0x2a8f83,
  nodeCurrent: 0xf6ba64,
  nodeNext: 0x6ff2d8,
  spineLocked: 0x3b4d56,
  spineVisited: 0x66efd0,
  comboLocked: 0x4f5f67,
  comboAvailable: 0x5dcdf2,
  comboCrafted: 0xffdb7a,
  traveler: 0xfff2cb,
  axis: 0x73909a,
};

const map = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
};

const getNodePosition = (node: SpineNode) => {
  const x = map(node.axis_values.sensory_activation, 0, 100, -10, 10) + node.order * 0.15;
  const y = map(node.axis_values.ease_of_consumption, 0, 100, -3.5, 7.2);
  const z = map(node.axis_values.creation_effort, 0, 100, -8, 8) - node.order * 0.1;
  return new THREE.Vector3(x, y, z);
};

const createTextSprite = (text: string, color = "#dceff2", fontSize = 30) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Sprite();
  }

  ctx.font = `700 ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width + 40);
  const height = Math.ceil(fontSize + 26);

  canvas.width = width;
  canvas.height = height;

  const draw = canvas.getContext("2d");
  if (!draw) {
    return new THREE.Sprite();
  }

  draw.fillStyle = "rgba(7, 19, 26, 0.6)";
  draw.fillRect(0, 0, width, height);
  draw.strokeStyle = "rgba(160, 214, 228, 0.42)";
  draw.lineWidth = 2;
  draw.strokeRect(1, 1, width - 2, height - 2);
  draw.fillStyle = color;
  draw.font = `700 ${fontSize}px sans-serif`;
  draw.textBaseline = "middle";
  draw.fillText(text, 20, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width / 110, height / 110, 1);
  return sprite;
};

const setLineColor = (line: THREE.Line, color: number, opacity: number) => {
  const material = line.material as THREE.LineBasicMaterial;
  material.color.setHex(color);
  material.opacity = opacity;
  material.transparent = opacity < 1;
};

const setNodeVisual = (mesh: THREE.Mesh, color: number, emissive: number, scale = 1) => {
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.color.setHex(color);
  material.emissive.setHex(emissive);
  mesh.scale.setScalar(scale);
};

const createComboLine = (combo: CombinationRecipe, nodePositions: Map<string, THREE.Vector3>, index: number) => {
  const inputPoints = combo.inputs
    .map((id) => nodePositions.get(id))
    .filter((position): position is THREE.Vector3 => Boolean(position));

  if (inputPoints.length < 2) return null;

  const startPoint = inputPoints.at(0);
  const endPoint = inputPoints.at(-1);
  if (!startPoint || !endPoint) return null;

  const start = startPoint.clone();
  const end = endPoint.clone();
  const control = start.clone().add(end).multiplyScalar(0.5);
  control.y += 1.8 + index * 0.16;

  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const points = curve.getPoints(36);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: colors.comboLocked,
    transparent: true,
    opacity: 0.14,
  });

  return new THREE.Line(geometry, material);
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }

    if (object instanceof THREE.Sprite) {
      if (object.material.map) object.material.map.dispose();
      object.material.dispose();
    }
  });
};

const SpectrumScene = ({
  nodes,
  currentNodeId,
  nextNodeId,
  visitedNodeIds,
  craftedCombinationIds,
  availableCombinationIds,
  cameraMode,
  onAdvance,
}: SpectrumSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<SceneRefs | null>(null);
  const onAdvanceRef = useRef(onAdvance);
  const nextNodeIdRef = useRef<string | null>(nextNodeId);
  const cameraModeRef = useRef<"guided" | "explore">(cameraMode);
  const safeVisited = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);
  const safeCrafted = useMemo(() => new Set(craftedCombinationIds), [craftedCombinationIds]);
  const safeAvailable = useMemo(() => new Set(availableCombinationIds), [availableCombinationIds]);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    nextNodeIdRef.current = nextNodeId;
  }, [nextNodeId]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.bgA);
    scene.fog = new THREE.Fog(colors.bgA, 20, 46);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.set(4, 9, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 34;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.46;
    controls.enabled = cameraModeRef.current === "explore";

    const ambient = new THREE.AmbientLight(0xa9cad3, 0.62);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0x9fe2ff, 0.9);
    key.position.set(10, 12, 8);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x5aceb6, 0.45);
    fill.position.set(-8, 3, -5);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 26),
      new THREE.MeshStandardMaterial({
        color: colors.bgB,
        transparent: true,
        opacity: 0.62,
        roughness: 0.9,
        metalness: 0,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.2;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 24, 0x3f5a62, 0x2f444c);
    grid.position.y = -4.18;
    scene.add(grid);

    const axisMaterial = new THREE.LineBasicMaterial({ color: colors.axis, transparent: true, opacity: 0.82 });
    const axisPoints: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-11.5, -3.9, -9.2), new THREE.Vector3(12, -3.9, -9.2)],
      [new THREE.Vector3(-11.5, -3.9, -9.2), new THREE.Vector3(-11.5, 8.5, -9.2)],
      [new THREE.Vector3(-11.5, -3.9, -9.2), new THREE.Vector3(-11.5, -3.9, 9.5)],
    ];

    axisPoints.forEach(([start, end]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      scene.add(new THREE.Line(geometry, axisMaterial.clone()));
    });

    const xLabel = createTextSprite("Degree of Sensory Activation", "#98dbe3", 24);
    xLabel.position.set(6.8, -3.3, -9.1);
    scene.add(xLabel);

    const yLabel = createTextSprite("Ease of Consumption", "#98dbe3", 24);
    yLabel.position.set(-11.3, 2.2, -9.1);
    yLabel.scale.y *= 1.2;
    scene.add(yLabel);

    const zLabel = createTextSprite("Creation Effort", "#98dbe3", 24);
    zLabel.position.set(-10.9, -3.2, 6.9);
    scene.add(zLabel);

    const nodePositions = new Map<string, THREE.Vector3>();
    const nodeMeshes = new Map<string, THREE.Mesh>();

    const nodeGeometry = new THREE.SphereGeometry(0.34, 32, 32);
    nodes.forEach((node) => {
      const position = getNodePosition(node);
      nodePositions.set(node.id, position);

      const material = new THREE.MeshStandardMaterial({
        color: colors.nodeIdle,
        emissive: 0x07131a,
        emissiveIntensity: 0.9,
        roughness: 0.38,
        metalness: 0.2,
      });

      const mesh = new THREE.Mesh(nodeGeometry, material);
      mesh.position.copy(position);
      mesh.userData = { nodeId: node.id };
      scene.add(mesh);
      nodeMeshes.set(node.id, mesh);

      const sprite = createTextSprite(`${node.order}. ${node.label}`, "#e4f6f8", 22);
      sprite.position.copy(position).add(new THREE.Vector3(0, 0.95, 0));
      scene.add(sprite);
    });

    const spineLinks: LinkRef[] = [];
    nodes.forEach((node, index) => {
      const next = nodes[index + 1];
      if (!next) return;
      const from = nodePositions.get(node.id);
      const to = nodePositions.get(next.id);
      if (!from || !to) return;

      const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: colors.spineLocked, transparent: true, opacity: 0.34 })
      );
      scene.add(line);
      spineLinks.push({ from: node.id, to: next.id, line });
    });

    const comboLines = new Map<string, THREE.Line>();
    dictionary.combination_layer.forEach((combo, index) => {
      const line = createComboLine(combo, nodePositions, index);
      if (!line) return;
      scene.add(line);
      comboLines.set(combo.id, line);
    });

    const traveler = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 24),
      new THREE.MeshStandardMaterial({
        color: colors.traveler,
        emissive: 0xdab86f,
        emissiveIntensity: 0.8,
      })
    );
    scene.add(traveler);

    const pulseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.045, 24, 48),
      new THREE.MeshBasicMaterial({ color: colors.nodeNext, transparent: true, opacity: 0.75 })
    );
    pulseRing.rotation.x = Math.PI / 2;
    scene.add(pulseRing);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height || 1;
      camera.updateProjectionMatrix();
    };

    onResize();
    window.addEventListener("resize", onResize);

    const onSceneClick = (event: MouseEvent) => {
      if (!nextNodeIdRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects([...nodeMeshes.values()], false);
      const hit = intersects[0];
      if (!hit) return;

      const nodeId = (hit.object as THREE.Mesh).userData.nodeId as string;
      if (nodeId === nextNodeIdRef.current) {
        onAdvanceRef.current();
      }
    };

    renderer.domElement.addEventListener("click", onSceneClick);

    const startPosition = nodePositions.get(currentNodeId) ?? new THREE.Vector3();
    traveler.position.copy(startPosition);

    const stateRef: SceneRefs = {
      scene,
      camera,
      renderer,
      controls,
      raycaster,
      pointer,
      targetPosition: startPosition.clone(),
      nodePositions,
      nodeMeshes,
      spineLinks,
      comboLines,
      traveler,
      pulseRing,
      frameId: 0,
      cleanupResize: () => window.removeEventListener("resize", onResize),
      cleanupPointer: () => renderer.domElement.removeEventListener("click", onSceneClick),
    };

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const wave = 1 + Math.sin(elapsed * 4.5) * 0.14;

      stateRef.traveler.position.lerp(stateRef.targetPosition, 0.12);

      if (nextNodeId && stateRef.pulseRing.visible) {
        stateRef.pulseRing.scale.setScalar(wave);
        const material = stateRef.pulseRing.material as THREE.MeshBasicMaterial;
        material.opacity = 0.6 + Math.sin(elapsed * 4.5) * 0.2;
      }

      if (cameraModeRef.current === "guided") {
        stateRef.controls.enabled = false;
        stateRef.controls.target.lerp(stateRef.targetPosition, 0.15);
        const camTarget = stateRef.controls.target;
        const desiredCamera = new THREE.Vector3(camTarget.x + 5.3, camTarget.y + 4.6, camTarget.z + 8.4);
        stateRef.camera.position.lerp(desiredCamera, 0.035);
        stateRef.controls.update();
      } else {
        stateRef.controls.enabled = true;
        stateRef.controls.update();
      }

      stateRef.renderer.render(stateRef.scene, stateRef.camera);
      stateRef.frameId = window.requestAnimationFrame(animate);
    };

    stateRef.frameId = window.requestAnimationFrame(animate);
    refs.current = stateRef;

    return () => {
      window.cancelAnimationFrame(stateRef.frameId);
      stateRef.cleanupResize();
      stateRef.cleanupPointer();
      disposeScene(stateRef.scene);
      stateRef.controls.dispose();
      stateRef.renderer.dispose();
      container.removeChild(stateRef.renderer.domElement);
      refs.current = null;
    };
  }, [nodes]);

  useEffect(() => {
    const sceneRefs = refs.current;
    if (!sceneRefs) return;

    sceneRefs.nodeMeshes.forEach((mesh, nodeId) => {
      const isCurrent = nodeId === currentNodeId;
      const isNext = nodeId === nextNodeId;
      const isVisited = safeVisited.has(nodeId);

      if (isCurrent) {
        setNodeVisual(mesh, colors.nodeCurrent, 0xa66314, 1.18);
      } else if (isNext) {
        setNodeVisual(mesh, colors.nodeNext, 0x138873, 1.08);
      } else if (isVisited) {
        setNodeVisual(mesh, colors.nodeVisited, 0x0e5a55, 1.02);
      } else {
        setNodeVisual(mesh, colors.nodeIdle, 0x07131a, 0.95);
      }
    });

    sceneRefs.spineLinks.forEach(({ from, to, line }) => {
      const fromVisited = safeVisited.has(from);
      const toVisited = safeVisited.has(to);
      const isCurrentPath = from === currentNodeId && to === nextNodeId;

      if (fromVisited && toVisited) {
        setLineColor(line, colors.spineVisited, 0.88);
      } else if (isCurrentPath) {
        setLineColor(line, colors.nodeNext, 0.78);
      } else {
        setLineColor(line, colors.spineLocked, 0.32);
      }
    });

    sceneRefs.comboLines.forEach((line, comboId) => {
      if (safeCrafted.has(comboId)) {
        setLineColor(line, colors.comboCrafted, 0.9);
      } else if (safeAvailable.has(comboId)) {
        setLineColor(line, colors.comboAvailable, 0.62);
      } else {
        setLineColor(line, colors.comboLocked, 0.12);
      }
    });

    const currentPosition = sceneRefs.nodePositions.get(currentNodeId);
    if (currentPosition) {
      sceneRefs.targetPosition.copy(currentPosition);
    }

    if (nextNodeId) {
      const nextPosition = sceneRefs.nodePositions.get(nextNodeId);
      if (nextPosition) {
        sceneRefs.pulseRing.visible = true;
        sceneRefs.pulseRing.position.copy(nextPosition);
      }
    } else {
      sceneRefs.pulseRing.visible = false;
    }
  }, [currentNodeId, nextNodeId, safeVisited, safeCrafted, safeAvailable]);

  return <div ref={containerRef} className="spectrum-canvas" aria-label="3D storytelling spectrum" />;
};

export default SpectrumScene;
