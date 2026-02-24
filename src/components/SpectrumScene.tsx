import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { dictionary } from "@/lib/storytellingGame";
import type { CombinationRecipe, SignalProfile, SpineNode } from "@/types/storytelling";

type LensMode = "truth" | "persuasion" | "distortion";

type SpectrumSceneProps = {
  nodes: SpineNode[];
  currentNodeId: string;
  nextNodeId: string | null;
  visitedNodeIds: string[];
  craftedCombinationIds: string[];
  availableCombinationIds: string[];
  selectedCombinationId: string;
  selectedModifierId: string;
  appliedModifierIds: string[];
  lensMode: LensMode;
  transitionTick: number;
  cameraMode: "guided" | "explore";
  interactive?: boolean;
  onAdvance: () => void;
};

type LinkRef = {
  from: string;
  to: string;
  line: THREE.Line;
};

type ComboVisual = {
  line: THREE.Line;
  marker: THREE.Mesh;
};

type ArtifactBirthEffect = {
  comboId: string;
  startedAt: number;
  durationMs: number;
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  sparks: THREE.Points;
  label: THREE.Sprite;
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
  comboVisuals: Map<string, ComboVisual>;
  traveler: THREE.Mesh;
  pulseRing: THREE.Mesh;
  auraRing: THREE.Mesh;
  ambient: THREE.AmbientLight;
  floorMaterial: THREE.MeshStandardMaterial;
  birthEffects: Map<string, ArtifactBirthEffect>;
  frameId: number;
  cleanupResize: () => void;
  cleanupPointer: () => void;
  desiredCamera: THREE.Vector3;
};

const lensPalettes = {
  truth: {
    bgA: 0x07131a,
    bgB: 0x0e2630,
    ambient: 0xa9cad3,
    nodeVisited: 0x2a8f83,
    nodeCurrent: 0x6ecbff,
    nodeNext: 0x7cf2e0,
    spineVisited: 0x68f0d7,
    comboAvailable: 0x5dcdf2,
    comboSelected: 0x71d7ff,
    comboCrafted: 0xffdb7a,
    axis: 0x73909a,
  },
  persuasion: {
    bgA: 0x1b1107,
    bgB: 0x2c1d10,
    ambient: 0xffca92,
    nodeVisited: 0xa1722e,
    nodeCurrent: 0xffbf63,
    nodeNext: 0xff9f62,
    spineVisited: 0xffbe7a,
    comboAvailable: 0xff9f70,
    comboSelected: 0xffcf77,
    comboCrafted: 0xfff2a0,
    axis: 0xa78e78,
  },
  distortion: {
    bgA: 0x18091f,
    bgB: 0x2b1034,
    ambient: 0xd2a0ff,
    nodeVisited: 0x7c3a99,
    nodeCurrent: 0xff75c9,
    nodeNext: 0xff9be6,
    spineVisited: 0xef9eff,
    comboAvailable: 0xc485ff,
    comboSelected: 0xff7be8,
    comboCrafted: 0xffd2ff,
    axis: 0x9175a4,
  },
} as const;

const basePalette = {
  nodeIdle: 0x57707a,
  spineLocked: 0x3b4d56,
  comboLocked: 0x4f5f67,
  traveler: 0xfff2cb,
};

const modifierPalette: Record<string, number> = {
  feed: 0xff7b91,
  search: 0x6ed6ff,
  direct: 0x9be59f,
  community: 0xb28cff,
  paid: 0xffb56b,
};

const lensScoreWeights: Record<LensMode, SignalProfile> = {
  truth: { fidelity: 1.45, persuasion: 0.42, reach: 0.6, distortion: -1.25 },
  persuasion: { fidelity: 0.28, persuasion: 1.34, reach: 1.08, distortion: 0.32 },
  distortion: { fidelity: -1.1, persuasion: 0.72, reach: 0.46, distortion: 1.48 },
};

const combinationsById = new Map(dictionary.combination_layer.map((combo) => [combo.id, combo]));
const artifactLabelsById = new Map(
  dictionary.extended_artifacts.map((artifact) => [artifact.id, artifact.label])
);

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
  if (!ctx) return new THREE.Sprite();

  ctx.font = `700 ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width + 40);
  const height = Math.ceil(fontSize + 26);
  canvas.width = width;
  canvas.height = height;

  const draw = canvas.getContext("2d");
  if (!draw) return new THREE.Sprite();

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

const setNodeVisual = (
  mesh: THREE.Mesh,
  color: number,
  emissive: number,
  scale = 1,
  emissiveIntensity = 0.9
) => {
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.color.setHex(color);
  material.emissive.setHex(emissive);
  material.emissiveIntensity = emissiveIntensity;
  mesh.scale.setScalar(scale);
};

const createComboVisual = (
  combo: CombinationRecipe,
  nodePositions: Map<string, THREE.Vector3>,
  index: number
): ComboVisual | null => {
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

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: basePalette.comboLocked,
    transparent: true,
    opacity: 0.12,
  });
  const line = new THREE.Line(lineGeometry, lineMaterial);

  const midpoint = curve.getPoint(0.5);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 20, 20),
    new THREE.MeshStandardMaterial({
      color: basePalette.comboLocked,
      emissive: 0x111a20,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.18,
      roughness: 0.35,
      metalness: 0.2,
    })
  );
  marker.position.copy(midpoint);
  marker.visible = false;

  return { line, marker };
};

const disposeObjectResources = (object: THREE.Object3D) => {
  if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
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
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse(disposeObjectResources);
};

const removeBirthEffect = (scene: THREE.Scene, effect: ArtifactBirthEffect) => {
  scene.remove(effect.group);
  effect.group.traverse(disposeObjectResources);
};

const createBirthEffect = (
  comboId: string,
  origin: THREE.Vector3,
  color: number
): ArtifactBirthEffect | null => {
  const combo = combinationsById.get(comboId);
  if (!combo) return null;

  const artifactLabel = artifactLabelsById.get(combo.output) ?? combo.output;

  const group = new THREE.Group();
  group.position.copy(origin);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 20, 20),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.26,
      metalness: 0.16,
      transparent: true,
      opacity: 0.95,
    })
  );
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 16, 44),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.74,
    })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const sparkPoints: number[] = [];
  for (let index = 0; index < 42; index += 1) {
    const angle = (index / 42) * Math.PI * 2;
    const radius = 0.24 + Math.random() * 0.18;
    const y = (Math.random() - 0.5) * 0.24;
    sparkPoints.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }
  const sparks = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(sparkPoints, 3)
    ),
    new THREE.PointsMaterial({
      color,
      size: 0.06,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  group.add(sparks);

  const recipeLabel = `${combo.label} -> ${artifactLabel}`;
  const label = createTextSprite(recipeLabel, "#ffe9b9", 18);
  label.scale.multiplyScalar(0.72);
  label.position.set(0, 0.9, 0);
  (label.material as THREE.SpriteMaterial).opacity = 0.96;
  group.add(label);

  return {
    comboId,
    startedAt: performance.now(),
    durationMs: 1350,
    group,
    core,
    ring,
    sparks,
    label,
  };
};

const SpectrumScene = ({
  nodes,
  currentNodeId,
  nextNodeId,
  visitedNodeIds,
  craftedCombinationIds,
  availableCombinationIds,
  selectedCombinationId,
  selectedModifierId,
  appliedModifierIds,
  lensMode,
  transitionTick,
  cameraMode,
  interactive = true,
  onAdvance,
}: SpectrumSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<SceneRefs | null>(null);

  const onAdvanceRef = useRef(onAdvance);
  const nextNodeIdRef = useRef<string | null>(nextNodeId);
  const cameraModeRef = useRef<"guided" | "explore">(cameraMode);
  const interactiveRef = useRef(interactive);
  const selectedCombinationRef = useRef(selectedCombinationId);
  const craftedCombinationsRef = useRef(craftedCombinationIds);
  const transitionUntilRef = useRef(0);

  const safeVisited = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);
  const safeCrafted = useMemo(() => new Set(craftedCombinationIds), [craftedCombinationIds]);
  const safeAvailable = useMemo(() => new Set(availableCombinationIds), [availableCombinationIds]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const lensNodeEmphasis = useMemo(() => {
    if (nodes.length === 0) return new Map<string, number>();

    const weights = lensScoreWeights[lensMode];
    const scored = nodes.map((node) => {
      const signal = node.signal_profile;
      const score =
        signal.fidelity * weights.fidelity +
        signal.persuasion * weights.persuasion +
        signal.reach * weights.reach +
        signal.distortion * weights.distortion;
      return { id: node.id, score };
    });

    const scores = scored.map((entry) => entry.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const span = Math.max(max - min, 1);

    return new Map(
      scored.map((entry) => [entry.id, 0.78 + ((entry.score - min) / span) * 0.62])
    );
  }, [nodes, lensMode]);

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
    interactiveRef.current = interactive;
  }, [interactive]);

  useEffect(() => {
    selectedCombinationRef.current = selectedCombinationId;
  }, [selectedCombinationId]);

  useEffect(() => {
    if (transitionTick > 0) {
      transitionUntilRef.current = performance.now() + 1200;
    }
  }, [transitionTick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lens = lensPalettes[lensMode];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lens.bgA);
    scene.fog = new THREE.Fog(lens.bgA, 20, 46);

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
    controls.enabled = interactiveRef.current && cameraModeRef.current === "explore";

    const ambient = new THREE.AmbientLight(lens.ambient, 0.62);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0x9fe2ff, 0.9);
    key.position.set(10, 12, 8);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x5aceb6, 0.45);
    fill.position.set(-8, 3, -5);
    scene.add(fill);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: lens.bgB,
      transparent: true,
      opacity: 0.62,
      roughness: 0.9,
      metalness: 0,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.2;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 24, 0x3f5a62, 0x2f444c);
    grid.position.y = -4.18;
    scene.add(grid);

    const axisMaterial = new THREE.LineBasicMaterial({ color: lens.axis, transparent: true, opacity: 0.82 });
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
        color: basePalette.nodeIdle,
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
        new THREE.LineBasicMaterial({ color: basePalette.spineLocked, transparent: true, opacity: 0.34 })
      );
      scene.add(line);
      spineLinks.push({ from: node.id, to: next.id, line });
    });

    const comboVisuals = new Map<string, ComboVisual>();
    dictionary.combination_layer.forEach((combo, index) => {
      const visual = createComboVisual(combo, nodePositions, index);
      if (!visual) return;
      scene.add(visual.line);
      scene.add(visual.marker);
      comboVisuals.set(combo.id, visual);
    });

    const traveler = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 24),
      new THREE.MeshStandardMaterial({
        color: basePalette.traveler,
        emissive: 0xdab86f,
        emissiveIntensity: 0.8,
      })
    );
    scene.add(traveler);

    const pulseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.045, 24, 48),
      new THREE.MeshBasicMaterial({ color: lens.nodeNext, transparent: true, opacity: 0.75 })
    );
    pulseRing.rotation.x = Math.PI / 2;
    scene.add(pulseRing);

    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 24, 60),
      new THREE.MeshBasicMaterial({
        color: 0x5dcdf2,
        transparent: true,
        opacity: 0.1,
      })
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.visible = false;
    scene.add(auraRing);

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
      if (!interactiveRef.current || !nextNodeIdRef.current) return;

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
    controls.target.copy(startPosition);

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
      comboVisuals,
      traveler,
      pulseRing,
      auraRing,
      ambient,
      floorMaterial,
      birthEffects: new Map<string, ArtifactBirthEffect>(),
      frameId: 0,
      cleanupResize: () => window.removeEventListener("resize", onResize),
      cleanupPointer: () => renderer.domElement.removeEventListener("click", onSceneClick),
      desiredCamera: new THREE.Vector3(startPosition.x + 5.3, startPosition.y + 4.6, startPosition.z + 8.4),
    };

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const wave = 1 + Math.sin(elapsed * 4.5) * 0.14;
      const isTransitioning = performance.now() < transitionUntilRef.current;

      stateRef.traveler.position.lerp(stateRef.targetPosition, isTransitioning ? 0.24 : 0.12);

      if (nextNodeIdRef.current && stateRef.pulseRing.visible) {
        stateRef.pulseRing.scale.setScalar(wave);
        const material = stateRef.pulseRing.material as THREE.MeshBasicMaterial;
        material.opacity = 0.6 + Math.sin(elapsed * 4.5) * 0.2;
      }

      if (stateRef.auraRing.visible) {
        stateRef.auraRing.position.copy(stateRef.traveler.position);
        stateRef.auraRing.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.06);
      }

      stateRef.comboVisuals.forEach(({ marker }, comboId) => {
        if (comboId === selectedCombinationRef.current) {
          const pulse = 1 + Math.sin(elapsed * 5.2) * 0.22;
          marker.scale.setScalar(pulse);
        }
      });

      const now = performance.now();
      stateRef.birthEffects.forEach((effect, comboId) => {
        const progress = (now - effect.startedAt) / effect.durationMs;
        if (progress >= 1) {
          removeBirthEffect(stateRef.scene, effect);
          stateRef.birthEffects.delete(comboId);
          return;
        }

        const eased = 1 - (1 - progress) * (1 - progress);

        effect.ring.scale.setScalar(0.9 + eased * 4.6);
        effect.ring.rotation.z += 0.038;
        const ringMaterial = effect.ring.material as THREE.MeshBasicMaterial;
        ringMaterial.opacity = 0.78 * (1 - progress);

        effect.core.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.85);
        const coreMaterial = effect.core.material as THREE.MeshStandardMaterial;
        coreMaterial.opacity = 0.94 - progress * 0.36;
        coreMaterial.emissiveIntensity = 1.26 - progress * 0.58;

        effect.sparks.scale.setScalar(1 + eased * 2.8);
        const sparksMaterial = effect.sparks.material as THREE.PointsMaterial;
        sparksMaterial.opacity = 0.9 * (1 - progress);

        effect.label.position.y = 0.9 + eased * 1.18;
        const labelMaterial = effect.label.material as THREE.SpriteMaterial;
        labelMaterial.opacity = 0.96 * (1 - progress);
      });

      if (cameraModeRef.current === "guided") {
        stateRef.controls.enabled = false;
        stateRef.controls.target.lerp(stateRef.targetPosition, isTransitioning ? 0.25 : 0.15);
        const camTarget = stateRef.controls.target;
        const offsetX = interactiveRef.current ? 5.3 : -6.2;
        const offsetY = interactiveRef.current ? 4.6 : 6.1;
        const offsetZ = interactiveRef.current ? 8.4 : 9.2;
        stateRef.desiredCamera.set(camTarget.x + offsetX, camTarget.y + offsetY, camTarget.z + offsetZ);
        stateRef.camera.position.lerp(stateRef.desiredCamera, isTransitioning ? 0.11 : 0.035);
        const targetFov = isTransitioning ? 47 : 52;
        stateRef.camera.fov += (targetFov - stateRef.camera.fov) * 0.09;
        stateRef.camera.updateProjectionMatrix();
        stateRef.controls.update();
      } else {
        stateRef.controls.enabled = interactiveRef.current;
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
    const previousCrafted = new Set(craftedCombinationsRef.current);
    const newlyCrafted = craftedCombinationIds.filter((comboId) => !previousCrafted.has(comboId));
    craftedCombinationsRef.current = [...craftedCombinationIds];

    if (!sceneRefs || newlyCrafted.length === 0) return;

    const comboColor = lensPalettes[lensMode].comboCrafted;
    newlyCrafted.forEach((comboId) => {
      const marker = sceneRefs.comboVisuals.get(comboId)?.marker;
      const spawnPoint = marker?.position;
      if (!spawnPoint) return;

      const existing = sceneRefs.birthEffects.get(comboId);
      if (existing) {
        removeBirthEffect(sceneRefs.scene, existing);
        sceneRefs.birthEffects.delete(comboId);
      }

      const effect = createBirthEffect(comboId, spawnPoint, comboColor);
      if (!effect) return;

      sceneRefs.scene.add(effect.group);
      sceneRefs.birthEffects.set(comboId, effect);
    });
  }, [craftedCombinationIds, lensMode]);

  useEffect(() => {
    const sceneRefs = refs.current;
    if (!sceneRefs) return;

    const lens = lensPalettes[lensMode];

    sceneRefs.nodeMeshes.forEach((mesh, nodeId) => {
      const isCurrent = nodeId === currentNodeId;
      const isNext = nodeId === nextNodeId;
      const isVisited = safeVisited.has(nodeId);
      const lensEmphasis = lensNodeEmphasis.get(nodeId) ?? 1;
      const distortionShare = (nodeById.get(nodeId)?.signal_profile.distortion ?? 0) / 100;
      const baseScale = isCurrent ? 1.14 : isNext ? 1.06 : isVisited ? 0.98 : 0.9;
      const scale = baseScale * lensEmphasis;
      const intensity = 0.82 + lensEmphasis * 0.26 + distortionShare * 0.18;

      if (isCurrent) {
        setNodeVisual(mesh, lens.nodeCurrent, 0x8f5c17, scale, intensity + 0.12);
      } else if (isNext) {
        setNodeVisual(mesh, lens.nodeNext, 0x138873, scale, intensity + 0.08);
      } else if (isVisited) {
        setNodeVisual(mesh, lens.nodeVisited, 0x0e5a55, scale, intensity);
      } else {
        setNodeVisual(mesh, basePalette.nodeIdle, 0x07131a, scale, 0.72 + lensEmphasis * 0.18);
      }
    });

    sceneRefs.spineLinks.forEach(({ from, to, line }) => {
      const fromVisited = safeVisited.has(from);
      const toVisited = safeVisited.has(to);
      const isCurrentPath = from === currentNodeId && to === nextNodeId;

      if (fromVisited && toVisited) {
        setLineColor(line, lens.spineVisited, 0.88);
      } else if (isCurrentPath) {
        setLineColor(line, lens.nodeNext, 0.8);
      } else {
        setLineColor(line, basePalette.spineLocked, 0.32);
      }
    });

    sceneRefs.comboVisuals.forEach(({ line, marker }, comboId) => {
      const crafted = safeCrafted.has(comboId);
      const selected = comboId === selectedCombinationId;
      const available = safeAvailable.has(comboId);
      const birthing = sceneRefs.birthEffects.has(comboId);

      if (crafted) {
        setLineColor(line, lens.comboCrafted, 0.93);
        marker.visible = true;
        marker.scale.setScalar(birthing ? 1.36 : 1.1);
        const material = marker.material as THREE.MeshStandardMaterial;
        material.color.setHex(lens.comboCrafted);
        material.emissive.setHex(birthing ? 0xb2711f : 0x6a521b);
        material.opacity = 0.95;
      } else if (selected) {
        setLineColor(line, lens.comboSelected, 0.9);
        marker.visible = true;
        marker.scale.setScalar(1.12);
        const material = marker.material as THREE.MeshStandardMaterial;
        material.color.setHex(lens.comboSelected);
        material.emissive.setHex(0x6b1a5f);
        material.opacity = 0.92;
      } else if (available) {
        setLineColor(line, lens.comboAvailable, 0.62);
        marker.visible = true;
        marker.scale.setScalar(0.95);
        const material = marker.material as THREE.MeshStandardMaterial;
        material.color.setHex(lens.comboAvailable);
        material.emissive.setHex(0x15556b);
        material.opacity = 0.48;
      } else {
        setLineColor(line, basePalette.comboLocked, 0.12);
        marker.visible = false;
      }
    });

    const currentPosition = sceneRefs.nodePositions.get(currentNodeId);
    if (currentPosition) {
      sceneRefs.targetPosition.copy(currentPosition);
    }

    const pulseMaterial = sceneRefs.pulseRing.material as THREE.MeshBasicMaterial;
    pulseMaterial.color.setHex(lens.nodeNext);

    if (nextNodeId) {
      const nextPosition = sceneRefs.nodePositions.get(nextNodeId);
      if (nextPosition) {
        sceneRefs.pulseRing.visible = true;
        sceneRefs.pulseRing.position.copy(nextPosition);
      }
    } else {
      sceneRefs.pulseRing.visible = false;
    }

    const activeAppliedModifier = appliedModifierIds.at(-1);
    const activeModifierId = selectedModifierId || activeAppliedModifier || "";
    const modifierColor = modifierPalette[activeModifierId];

    const bgColor = new THREE.Color(lens.bgA);
    const floorColor = new THREE.Color(lens.bgB);

    if (modifierColor) {
      const modifier = new THREE.Color(modifierColor);
      const preview = Boolean(selectedModifierId);
      const blend = preview ? 0.16 : 0.26;

      bgColor.lerp(modifier, blend);
      floorColor.lerp(modifier, blend * 0.54);
      sceneRefs.auraRing.visible = true;

      const auraMaterial = sceneRefs.auraRing.material as THREE.MeshBasicMaterial;
      auraMaterial.color.setHex(modifierColor);
      auraMaterial.opacity = preview ? 0.22 : 0.34;

      const ambientColor = new THREE.Color(lens.ambient).lerp(modifier, preview ? 0.18 : 0.3);
      sceneRefs.ambient.color.copy(ambientColor);
      sceneRefs.ambient.intensity = preview ? 0.58 : 0.72;
    } else {
      sceneRefs.auraRing.visible = false;
      sceneRefs.ambient.color.setHex(lens.ambient);
      sceneRefs.ambient.intensity = 0.62;
    }

    sceneRefs.floorMaterial.color.copy(floorColor);
    sceneRefs.scene.background = bgColor;
    sceneRefs.scene.fog = new THREE.Fog(bgColor.getHex(), 20, 46);
  }, [
    currentNodeId,
    nextNodeId,
    safeVisited,
    safeCrafted,
    safeAvailable,
    selectedCombinationId,
    selectedModifierId,
    appliedModifierIds,
    lensMode,
    lensNodeEmphasis,
    nodeById,
  ]);

  return <div ref={containerRef} className="spectrum-canvas" aria-label="3D storytelling spectrum" />;
};

export default SpectrumScene;
