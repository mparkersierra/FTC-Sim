import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import {
  Box3,
  BufferGeometry,
  BoxHelper,
  Color,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Object3DEventMap,
  Quaternion,
  Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  cadStore,
  selectPart,
  selectMotionDirection,
  setAvailableParts,
  setPickMode,
  setModelOrientation,
  resetTransforms,
  useCadStore,
} from "./cadStore";
import type { Axis, ModelOrientation, MotionType } from "./types";

type ObjectMap = Map<string, Object3D<Object3DEventMap>>;
type MeshGroup = {
  material: Material | Material[];
  geometries: BufferGeometry[];
};
type InitialTransform = {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
};
type DirectionOption = {
  axis: Axis;
  sign: 1 | -1;
  direction: Vector3;
  color: string;
};

const axisColors: Record<Axis, string> = {
  x: "#f87171",
  y: "#4ade80",
  z: "#60a5fa",
};
const fullPowerRotationRadiansPerSecond = 2;
const fullPowerTranslationDistancePerSecond = 2;
const servoMaxRotationRadians = 5 * Math.PI / 3;
const servoMaxRotationRadiansPerSecond = 2;
const servoMaxTranslationDistancePerSecond = 2;

const translateDirections: DirectionOption[] = [
  { axis: "x", sign: 1, direction: new Vector3(1, 0, 0), color: axisColors.x },
  { axis: "x", sign: -1, direction: new Vector3(-1, 0, 0), color: axisColors.x },
  { axis: "y", sign: 1, direction: new Vector3(0, 1, 0), color: axisColors.y },
  { axis: "y", sign: -1, direction: new Vector3(0, -1, 0), color: axisColors.y },
  { axis: "z", sign: 1, direction: new Vector3(0, 0, 1), color: axisColors.z },
  { axis: "z", sign: -1, direction: new Vector3(0, 0, -1), color: axisColors.z },
];

const rotateDirections: DirectionOption[] = [
  { axis: "x", sign: 1, direction: new Vector3(1, 0, 0), color: axisColors.x },
  { axis: "y", sign: 1, direction: new Vector3(0, 1, 0), color: axisColors.y },
  { axis: "z", sign: 1, direction: new Vector3(0, 0, 1), color: axisColors.z },
];

const modelOrientationButtons: Array<{
  axis: Axis;
  sign: 1 | -1;
  label: string;
  title: string;
}> = [
  { axis: "x", sign: 1, label: "+X", title: "Rotate whole robot +90 degrees around X" },
  { axis: "x", sign: -1, label: "-X", title: "Rotate whole robot -90 degrees around X" },
  { axis: "y", sign: 1, label: "+Y", title: "Rotate whole robot +90 degrees around Y" },
  { axis: "y", sign: -1, label: "-Y", title: "Rotate whole robot -90 degrees around Y" },
  { axis: "z", sign: 1, label: "+Z", title: "Rotate whole robot +90 degrees around Z" },
  { axis: "z", sign: -1, label: "-Z", title: "Rotate whole robot -90 degrees around Z" },
];

function getAxisValue(object: Object3D, axis: Axis, type: "rotate" | "translate") {
  return type === "rotate" ? object.rotation[axis] : object.position[axis];
}

function getLocalMotionCenter(object: Object3D) {
  const cachedCenter = object.userData.motionCenter;

  if (cachedCenter instanceof Vector3) {
    return cachedCenter;
  }

  const box = new Box3();
  const worldCenter = new Vector3();

  object.updateWorldMatrix(true, true);
  box.setFromObject(object);
  box.getCenter(worldCenter);

  const localCenter = object.worldToLocal(worldCenter.clone());
  object.userData.motionCenter = localCenter;

  return localCenter;
}

function getMotionCenterWorld(object: Object3D, target: Vector3) {
  target.copy(getLocalMotionCenter(object));
  object.localToWorld(target);

  return target;
}

function keepMotionCenterFixed(
  object: Object3D,
  beforeCenterWorld: Vector3,
  afterCenterWorld: Vector3,
) {
  if (object.parent) {
    const beforeCenterParent = object.parent.worldToLocal(beforeCenterWorld.clone());
    const afterCenterParent = object.parent.worldToLocal(afterCenterWorld.clone());
    object.position.add(beforeCenterParent.sub(afterCenterParent));
  } else {
    object.position.add(beforeCenterWorld.clone().sub(afterCenterWorld));
  }

  object.updateMatrixWorld(true);
}

function setAxisValue(
  object: Object3D,
  axis: Axis,
  type: "rotate" | "translate",
  value: number,
) {
  if (type === "rotate") {
    const beforeCenterWorld = getMotionCenterWorld(object, new Vector3());
    object.rotation[axis] = value;
    object.updateMatrixWorld(true);
    const afterCenterWorld = getMotionCenterWorld(object, new Vector3());
    keepMotionCenterFixed(object, beforeCenterWorld, afterCenterWorld);
  } else {
    object.position[axis] = value;
  }
}

function translateAlongLocalAxis(object: Object3D, axis: Axis, distance: number) {
  object.translateOnAxis(axisVector(axis), distance);
  object.updateMatrixWorld(true);
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;

  if (typeof min === "number") {
    next = Math.max(min, next);
  }

  if (typeof max === "number") {
    next = Math.min(max, next);
  }

  return next;
}

function moveToward(current: number, target: number, maxDelta: number) {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }

  if (current > target) {
    return Math.max(current - maxDelta, target);
  }

  return current;
}

function axisVector(axis: Axis) {
  if (axis === "x") {
    return new Vector3(1, 0, 0);
  }

  if (axis === "y") {
    return new Vector3(0, 1, 0);
  }

  return new Vector3(0, 0, 1);
}

function rotateModelOrientation(
  orientation: ModelOrientation,
  axis: Axis,
  sign: 1 | -1,
): ModelOrientation {
  const current = new Quaternion(...orientation);
  const delta = new Quaternion().setFromAxisAngle(axisVector(axis), sign * Math.PI / 2);

  current.premultiply(delta).normalize();

  return [current.x, current.y, current.z, current.w];
}

function collectSelectableParts(scene: Object3D, expandPattern: string) {
  const objectMap: ObjectMap = new Map();
  const usedNames = new Map<string, number>();
  const roots = getSelectionRoots(scene);

  hideIgnoredObjects(scene);

  for (const root of roots) {
    collectRuleBasedSelectableObjects(root, objectMap, usedNames, expandPattern);
  }

  return objectMap;
}

function getSelectionRoots(scene: Object3D) {
  const meshChildren = scene.children.filter(hasMeshContent);

  if (meshChildren.length === 1 && meshChildren[0].children.length > 0) {
    return meshChildren[0].children.filter(hasMeshContent);
  }

  return scene.children.filter(hasMeshContent);
}

function collectRuleBasedSelectableObjects(
  object: Object3D,
  objectMap: ObjectMap,
  usedNames: Map<string, number>,
  expandPattern: string,
) {
  if (isIgnoredPartName(object.name) || !hasMeshContent(object)) {
    return;
  }

  if (matchesPatternList(object.name, expandPattern)) {
    for (const child of object.children) {
      collectRuleBasedSelectableObjects(child, objectMap, usedNames, expandPattern);
    }
    return;
  }

  if (object.name) {
    addSelectableObject(object, objectMap, usedNames);
  }
}

function addSelectableObject(
  object: Object3D,
  objectMap: ObjectMap,
  usedNames: Map<string, number>,
) {
  const count = usedNames.get(object.name) ?? 0;
  usedNames.set(object.name, count + 1);

  const selectableName = count === 0 ? object.name : `${object.name} (${count + 1})`;
  object.userData.selectableName = selectableName;
  objectMap.set(selectableName, object);
}

function hideIgnoredObjects(scene: Object3D) {
  scene.traverse((object) => {
    if (isIgnoredPartName(object.name)) {
      object.visible = false;
    }
  });
}

function isIgnoredPartName(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("motor") || normalized.includes("servo");
}

function matchesPatternList(name: string, patterns: string) {
  const normalizedName = normalizeMatchText(name);

  return patterns
    .split(",")
    .map((pattern) => normalizeMatchText(pattern.trim()))
    .filter(Boolean)
    .some((pattern) => normalizedName.includes(pattern));
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function clearSelectableMetadata(scene: Object3D) {
  clearTransientMergedMeshes(scene);

  scene.traverse((object) => {
    if (typeof object.userData.selectableName === "string") {
      delete object.userData.selectableName;
    }

    if (object.userData.hiddenByCadMerge) {
      delete object.userData.hiddenByCadMerge;
    }

    object.visible = true;
  });
}

function applySelectableMetadata(selectableObjects: ObjectMap) {
  for (const [selectableName, object] of selectableObjects) {
    object.userData.selectableName = selectableName;
  }
}

function hasMeshContent(object: Object3D) {
  let hasMesh = false;

  object.traverse((child) => {
    if ("isMesh" in child && child.isMesh) {
      hasMesh = true;
    }
  });

  return hasMesh;
}

function mergeSelectableMeshes(selectableObjects: ObjectMap) {
  for (const object of selectableObjects.values()) {
    mergeMeshDescendants(object);
  }
}

function mergeMeshDescendants(root: Object3D) {
  if (root.userData.cadMerged) {
    return;
  }

  root.updateWorldMatrix(true, true);

  const groups = new Map<string, MeshGroup>();
  const originalMeshes: Mesh[] = [];
  const inverseRootMatrix = new Matrix4().copy(root.matrixWorld).invert();

  root.traverse((child) => {
    if (
      child === root ||
      child.userData.cadMergedMesh ||
      !child.visible ||
      !isMeshObject(child)
    ) {
      return;
    }

    child.updateWorldMatrix(true, false);

    const geometry = child.geometry.clone();
    const localMatrix = new Matrix4().multiplyMatrices(inverseRootMatrix, child.matrixWorld);
    geometry.applyMatrix4(localMatrix);

    const groupKey = `${materialKey(child.material)}:${geometryKey(geometry)}`;
    const group = groups.get(groupKey);

    if (group) {
      group.geometries.push(geometry);
    } else {
      groups.set(groupKey, {
        material: child.material,
        geometries: [geometry],
      });
    }

    originalMeshes.push(child);
  });

  if (originalMeshes.length < 2) {
    for (const group of groups.values()) {
      for (const geometry of group.geometries) {
        geometry.dispose();
      }
    }
    return;
  }

  for (const [index, group] of Array.from(groups.values()).entries()) {
    const mergedGeometry = mergeGeometries(group.geometries, Array.isArray(group.material));
    for (const geometry of group.geometries) {
      geometry.dispose();
    }

    if (!mergedGeometry) {
      continue;
    }

    const mergedMesh = new Mesh(mergedGeometry, group.material);
    mergedMesh.name = `${root.name || "part"}_merged_${index + 1}`;
    mergedMesh.userData.cadMergedMesh = true;
    mergedMesh.frustumCulled = true;
    root.add(mergedMesh);
  }

  for (const mesh of originalMeshes) {
    mesh.visible = false;
    mesh.userData.hiddenByCadMerge = true;
  }

  root.userData.cadMerged = true;
}

function clearTransientMergedMeshes(scene: Object3D) {
  const mergedMeshes: Mesh[] = [];

  scene.traverse((object) => {
    if (object.userData.cadMerged) {
      delete object.userData.cadMerged;
    }

    if (object.userData.cadMergedMesh && isMeshObject(object)) {
      mergedMeshes.push(object);
    }
  });

  for (const mesh of mergedMeshes) {
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
  }
}

function isMeshObject(object: Object3D): object is Mesh {
  return "isMesh" in object && object.isMesh === true;
}

function materialKey(material: Material | Material[]) {
  return Array.isArray(material)
    ? material.map((item) => item.uuid).join(",")
    : material.uuid;
}

function geometryKey(geometry: BufferGeometry) {
  const attributes = Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
    .sort()
    .join("|");

  return `${geometry.index ? "indexed" : "flat"}:${attributes}`;
}

function findSelectableName(
  object: Object3D,
  root: Object3D,
) {
  let current: Object3D | null = object;

  while (current && current !== root) {
    if (typeof current.userData.selectableName === "string") {
      return current.userData.selectableName;
    }

    current = current.parent;
  }

  return null;
}

function SelectionHelper({
  selectedObject,
}: {
  selectedObject: Object3D | null;
}) {
  const helper = useMemo(() => {
    if (!selectedObject) {
      return null;
    }

    return new BoxHelper(selectedObject, new Color("#61d2ff"));
  }, [selectedObject]);

  useFrame(() => {
    helper?.update();
  });

  useEffect(() => {
    return () => {
      helper?.dispose();
    };
  }, [helper]);

  return helper ? <primitive object={helper} /> : null;
}

function BehaviorHelper({ object }: { object: Object3D }) {
  const helper = useMemo(
    () => new BoxHelper(object, new Color("#f7b733")),
    [object],
  );

  useFrame(() => {
    helper.update();
  });

  useEffect(() => {
    return () => {
      helper.dispose();
    };
  }, [helper]);

  return <primitive object={helper} />;
}

function BehaviorHelpers({ objects }: { objects: Object3D[] }) {
  return (
    <>
      {objects.map((object) => (
        <BehaviorHelper key={object.uuid} object={object} />
      ))}
    </>
  );
}

function getGizmoScale(selectedObject: Object3D, box: Box3, center: Vector3) {
  const size = new Vector3();

  selectedObject.updateWorldMatrix(true, true);
  box.setFromObject(selectedObject);
  box.getCenter(center);
  box.getSize(size);

  return Math.max(Math.max(size.x, size.y, size.z) * 0.48, 0.25);
}

function TranslateArrow({
  option,
  active,
}: {
  option: DirectionOption;
  active: boolean;
}) {
  const quaternion = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        option.direction.clone().normalize(),
      ),
    [option.direction],
  );

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    selectMotionDirection(option.axis, option.sign);
  }

  return (
    <group quaternion={quaternion} onClick={handleClick}>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.78, 18]} />
        <meshStandardMaterial
          color={option.color}
          emissive={option.color}
          emissiveIntensity={active ? 0.55 : 0.18}
        />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <coneGeometry args={[0.12, 0.28, 24]} />
        <meshStandardMaterial
          color={option.color}
          emissive={option.color}
          emissiveIntensity={active ? 0.7 : 0.24}
        />
      </mesh>
    </group>
  );
}

function RotationRing({
  option,
  active,
}: {
  option: DirectionOption;
  active: boolean;
}) {
  const quaternion = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        option.direction.clone().normalize(),
      ),
    [option.direction],
  );

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    selectMotionDirection(option.axis, option.sign);
  }

  return (
    <mesh quaternion={quaternion} onClick={handleClick}>
      <torusGeometry args={[0.96, active ? 0.028 : 0.018, 14, 96]} />
      <meshStandardMaterial
        color={option.color}
        emissive={option.color}
        emissiveIntensity={active ? 0.64 : 0.22}
      />
    </mesh>
  );
}

function MotionGizmo({
  selectedObject,
  type,
  axis,
  motorPower,
}: {
  selectedObject: Object3D | null;
  type: MotionType;
  axis: Axis;
  motorPower: number;
}) {
  const groupRef = useRef<Group>(null);
  const boxRef = useRef(new Box3());
  const centerRef = useRef(new Vector3());
  const quaternionRef = useRef(new Quaternion());
  const options = type === "translate" ? translateDirections : rotateDirections;

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !selectedObject) {
      return;
    }

    const scale = getGizmoScale(selectedObject, boxRef.current, centerRef.current);
    group.position.copy(centerRef.current);
    selectedObject.getWorldQuaternion(quaternionRef.current);
    group.quaternion.copy(quaternionRef.current);
    group.scale.setScalar(scale);
  });

  if (!selectedObject) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {type === "translate"
        ? options.map((option) => (
            <TranslateArrow
              key={`${option.axis}-${option.sign}`}
              active={axis === option.axis && Math.sign(motorPower) === option.sign}
              option={option}
            />
          ))
        : options.map((option) => (
            <RotationRing
              key={option.axis}
              active={axis === option.axis}
              option={option}
            />
          ))}
    </group>
  );
}

function CadScene({
  allowPartPicking,
  showMotionGizmo,
  modelOrientation,
  modelUrl,
}: {
  allowPartPicking: boolean;
  showMotionGizmo: boolean;
  modelOrientation: ModelOrientation;
  modelUrl: string;
}) {
  const gltf = useGLTF(modelUrl, false, true);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const objectMapRef = useRef<ObjectMap>(new Map());
  const initialTransformsRef = useRef<Map<string, InitialTransform>>(new Map());
  const servoPositionsRef = useRef<Map<string, number>>(new Map());
  const selectedPartName = useCadStore((store) => store.selectedPartName);
  const availableParts = useCadStore((store) => store.availableParts);
  const motionConfig = useCadStore((store) => store.motionConfig);
  const isPickMode = useCadStore((store) => store.isPickMode);
  const expandPattern = useCadStore((store) => store.expandPattern);
  const motionDraft = useCadStore((store) => store.motionDraft);
  const motorPower = useCadStore(
    (store) => store.motorState[store.motionDraft.motorName] ?? 0,
  );
  const resetTransformsToken = useCadStore((store) => store.resetTransformsToken);
  const selectedObject = selectedPartName
    ? objectMapRef.current.get(selectedPartName) ?? null
    : null;
  const behaviorObjects = useMemo(() => {
    const objects: Object3D[] = [];
    const seen = new Set<string>();

    for (const behavior of motionConfig.behaviors) {
      const object = objectMapRef.current.get(behavior.partName);

      if (!object || object === selectedObject || seen.has(object.uuid)) {
        continue;
      }

      seen.add(object.uuid);
      objects.push(object);
    }

    return objects;
  }, [availableParts, motionConfig, selectedObject]);

  useEffect(() => {
    scene.quaternion.set(
      modelOrientation[0],
      modelOrientation[1],
      modelOrientation[2],
      modelOrientation[3],
    );
    scene.updateMatrixWorld(true);
  }, [modelOrientation, scene]);

  useEffect(() => {
    const nextObjectMap: ObjectMap = new Map();
    clearSelectableMetadata(scene);
    const selectableObjects = collectSelectableParts(scene, expandPattern);

    for (const [name, object] of selectableObjects) {
      nextObjectMap.set(name, object);
    }

    applySelectableMetadata(nextObjectMap);
    mergeSelectableMeshes(nextObjectMap);
    objectMapRef.current = nextObjectMap;
    for (const [name, object] of nextObjectMap) {
      if (!initialTransformsRef.current.has(name)) {
        initialTransformsRef.current.set(name, {
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
        });
      }
    }
    setAvailableParts(Array.from(nextObjectMap.keys()));
  }, [expandPattern, scene]);

  useEffect(() => {
    for (const [name, object] of objectMapRef.current) {
      const initialTransform = initialTransformsRef.current.get(name);

      if (!initialTransform) {
        continue;
      }

      object.position.copy(initialTransform.position);
      object.quaternion.copy(initialTransform.quaternion);
      object.scale.copy(initialTransform.scale);
      object.updateMatrixWorld(true);
    }
    servoPositionsRef.current.clear();
  }, [resetTransformsToken]);

  useFrame((_, deltaTime) => {
    const { motionConfig, motorState } = cadStore.getState();

    for (const behavior of motionConfig.behaviors) {
      const object = objectMapRef.current.get(behavior.partName);
      if (!object) {
        continue;
      }

      const motorPower =
        (motorState[behavior.motorName] ?? 0) *
        (behavior.maxPower ?? 1) *
        (behavior.positiveDirectionSign ?? 1);

      if (behavior.motorType === "Servo") {
        const initialTransform = initialTransformsRef.current.get(behavior.partName);
        if (!initialTransform) {
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(motorState, behavior.motorName)) {
          continue;
        }

        const targetServoPosition = clamp(motorState[behavior.motorName] ?? 0, 0, 1);
        const currentServoPosition = servoPositionsRef.current.get(behavior.id) ?? 0;
        const maxServoDelta =
          behavior.type === "translate"
            ? servoMaxTranslationDistancePerSecond /
              fullPowerTranslationDistancePerSecond *
              deltaTime
            : servoMaxRotationRadiansPerSecond / servoMaxRotationRadians * deltaTime;
        const servoPosition = moveToward(
          currentServoPosition,
          targetServoPosition,
          maxServoDelta,
        );
        const servoValue =
          servoPosition *
          (behavior.positiveDirectionSign ?? 1);
        servoPositionsRef.current.set(behavior.id, servoPosition);

        object.position.copy(initialTransform.position);
        object.quaternion.copy(initialTransform.quaternion);
        object.scale.copy(initialTransform.scale);
        object.updateMatrixWorld(true);

        if (behavior.type === "translate") {
          translateAlongLocalAxis(
            object,
            behavior.axis,
            servoValue * fullPowerTranslationDistancePerSecond,
          );
        } else {
          const currentValue = getAxisValue(object, behavior.axis, behavior.type);
          setAxisValue(
            object,
            behavior.axis,
            behavior.type,
            currentValue + servoValue * servoMaxRotationRadians,
          );
        }

        continue;
      }

      if (motorPower === 0) {
        continue;
      }

      if (behavior.type === "translate") {
        translateAlongLocalAxis(
          object,
          behavior.axis,
          motorPower * fullPowerTranslationDistancePerSecond * deltaTime,
        );
        continue;
      }

      const currentValue = getAxisValue(object, behavior.axis, behavior.type);
      const nextValue = clamp(
        currentValue + motorPower * fullPowerRotationRadiansPerSecond * deltaTime,
        behavior.min,
        behavior.max,
      );

      setAxisValue(object, behavior.axis, behavior.type, nextValue);
    }
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!isPickMode) {
      return;
    }

    event.stopPropagation();

    const partName = findSelectableName(
      event.object,
      scene,
    );

    if (partName) {
      selectPart(partName);
    }
  }

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight intensity={1.7} position={[4, 8, 5]} />
      <directionalLight intensity={0.6} position={[-5, 3, -3]} />
      <gridHelper args={[12, 24, "#334155", "#202936"]} position={[0, -0.01, 0]} />
      <primitive object={scene} onClick={allowPartPicking && isPickMode ? handleClick : undefined} />
      <BehaviorHelpers objects={behaviorObjects} />
      <SelectionHelper selectedObject={selectedObject} />
      {showMotionGizmo ? (
        <MotionGizmo
          axis={motionDraft.axis}
          motorPower={motorPower * motionDraft.positiveDirectionSign}
          selectedObject={selectedObject}
          type={motionDraft.type}
        />
      ) : null}
      <OrbitControls enabled={!allowPartPicking || !isPickMode} makeDefault />
    </>
  );
}

function LoadingScene() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2f68c5" wireframe />
      </mesh>
    </>
  );
}

function MissingModelScene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <gridHelper args={[8, 16, "#334155", "#202936"]} />
      <mesh>
        <boxGeometry args={[1.5, 0.8, 1]} />
        <meshStandardMaterial color="#334155" wireframe />
      </mesh>
      <OrbitControls makeDefault />
    </>
  );
}

class ModelBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    setAvailableParts([]);
  }

  render() {
    if (this.state.hasError) {
      return <MissingModelScene />;
    }

    return this.props.children;
  }
}

type CadViewerProps = {
  mode?: "editor" | "display";
};

export function CadViewer({ mode = "editor" }: CadViewerProps) {
  const modelUrl = useCadStore((store) => store.modelUrl);
  const modelOrientation = useCadStore((store) => store.modelOrientation);
  const selectedPartName = useCadStore((store) => store.selectedPartName);
  const isPickMode = useCadStore((store) => store.isPickMode);
  const isEditorMode = mode === "editor";
  const hasActiveMotor = useCadStore((store) =>
    Object.values(store.motorState).some((power) => Math.abs(power) > 0.001),
  );

  function handlePointerMissed() {
    if (!isEditorMode) {
      return;
    }

    selectPart(null);

    if (isPickMode) {
      setPickMode(false);
    }
  }

  return (
    <section className="viewer-pane">
      <Canvas
        camera={{ position: [4, 3, 6], fov: 50 }}
        dpr={1}
        frameloop={hasActiveMotor ? "always" : "demand"}
        onPointerMissed={handlePointerMissed}
      >
        <color args={["#10141b"]} attach="background" />
        <ModelBoundary key={modelUrl}>
          <Suspense fallback={<LoadingScene />}>
            <CadScene
              allowPartPicking={isEditorMode}
              modelOrientation={modelOrientation}
              modelUrl={modelUrl}
              showMotionGizmo={isEditorMode}
            />
          </Suspense>
        </ModelBoundary>
      </Canvas>
      {isEditorMode ? (
        <div className="viewer-toolbar" aria-label="Viewer tools">
        <button
          className={isPickMode ? "viewer-tool active" : "viewer-tool"}
          type="button"
          onClick={() => setPickMode(!isPickMode)}
        >
          {isPickMode ? "Exit pick mode" : "Pick part"}
        </button>
        <div className="viewer-menu">
          <button className="viewer-tool" type="button">
            Robot orientation
          </button>
          <div className="orientation-tool" aria-label="Robot orientation controls">
            <div className="orientation-grid">
              {modelOrientationButtons.map((button) => (
                <button
                  key={`${button.axis}-${button.sign}`}
                  type="button"
                  title={button.title}
                  onClick={() =>
                    setModelOrientation(
                      rotateModelOrientation(modelOrientation, button.axis, button.sign),
                    )
                  }
                >
                  {button.label}
                </button>
              ))}
            </div>
            <button
              className="orientation-reset"
              type="button"
              onClick={() => setModelOrientation([0, 0, 0, 1])}
            >
              Reset
            </button>
          </div>
        </div>
        </div>
      ) : null}
      <div className="viewer-status">
        {selectedPartName ? `Selected: ${selectedPartName}` : "No part selected"}
      </div>
      <button
        className="viewer-reset-button"
        type="button"
        onClick={resetTransforms}
      >
        Reset positions
      </button>
    </section>
  );
}
