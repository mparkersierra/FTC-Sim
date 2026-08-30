import { useSyncExternalStore } from "react";
import type {
  Axis,
  CadMotorDevice,
  CadMotorType,
  ModelOrientation,
  MotionBehavior,
  MotionConfig,
  MotionDraft,
  MotionType,
  MotorState,
} from "./types";

const defaultMotionDraft: MotionDraft = {
  motorName: "motor",
  motorType: "DcMotor",
  type: "rotate",
  axis: "z",
  positiveDirectionSign: 1,
  speed: 1,
  maxPower: 1,
};

const defaultDirectionPower = 0.5;
const fallbackModelUrl = "/models/test-robot.glb";
const activeModelStorageKey = "cad-motion:active-model-url";
const defaultModelUrl = loadActiveModelUrl() ?? fallbackModelUrl;
const defaultExpandPattern = "chassis";
const identityOrientation: ModelOrientation = [0, 0, 0, 1];
const orientationStoragePrefix = "cad-motion:model-orientation:";
const drillStoragePrefix = "cad-motion:drill-state:";
const motionConfigStoragePrefix = "cad-motion:motion-config:";
const selectedPartStoragePrefix = "cad-motion:selected-part:";

interface CadState {
  modelUrl: string;
  expandPattern: string;
  drillStack: string[];
  selectedPartName: string | null;
  isPickMode: boolean;
  availableParts: string[];
  motionConfig: MotionConfig;
  cadMotorDevices: CadMotorDevice[];
  motorState: MotorState;
  motionDraft: MotionDraft;
  modelOrientation: ModelOrientation;
  resetTransformsToken: number;
}

interface CadStore extends CadState {
  selectPart: (name: string | null) => void;
  setPickMode: (enabled: boolean) => void;
  setAvailableParts: (parts: string[]) => void;
  setModelUrl: (url: string) => void;
  setExpandPattern: (pattern: string) => void;
  drillIntoSelectedPart: () => void;
  drillUpOneLevel: () => void;
  setMotionDraft: (draft: Partial<MotionDraft>) => void;
  setModelOrientation: (orientation: ModelOrientation) => void;
  selectMotionDirection: (axis: Axis, sign: 1 | -1) => void;
  upsertBehavior: (behavior: MotionBehavior) => void;
  deleteBehaviorForPart: (partName: string) => void;
  updateCadMotorDevice: (
    partName: string,
    updates: Partial<Pick<CadMotorDevice, "motorName" | "motorType">>,
  ) => void;
  setMotorPower: (motorName: string, power: number) => void;
  setMotorPowers: (powers: MotorState) => void;
  resetTransforms: () => void;
}

type Listener = () => void;
type DrillState = {
  expandPattern: string;
  drillStack: string[];
};

const initialDrillState = loadModelDrillState(defaultModelUrl);
const initialMotionConfig = loadModelMotionConfig(defaultModelUrl);
const initialState: CadState = {
  modelUrl: defaultModelUrl,
  expandPattern: initialDrillState.expandPattern,
  drillStack: initialDrillState.drillStack,
  selectedPartName: loadModelSelectedPartName(defaultModelUrl),
  isPickMode: false,
  availableParts: [],
  motionConfig: initialMotionConfig,
  cadMotorDevices: cadMotorDevicesForConfig(initialMotionConfig),
  motorState: {},
  motionDraft: defaultMotionDraft,
  modelOrientation: loadModelOrientation(defaultModelUrl),
  resetTransformsToken: 0,
};

let state: CadState = initialState;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(updater: (current: CadState) => CadState) {
  state = updater(state);
  emit();
}

function clampMotorPower(power: number) {
  if (Number.isNaN(power)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, power));
}

function uniqueSortedParts(parts: string[]) {
  return Array.from(new Set(parts.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePatternList(pattern: string) {
  return pattern
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectablePatternName(partName: string) {
  return partName.replace(/\s+\(\d+\)$/, "").trim();
}

export function canonicalCadPartName(partName: string) {
  return selectablePatternName(partName);
}

function appendPattern(pattern: string, item: string) {
  const trimmedItem = item.trim();

  if (!trimmedItem) {
    return pattern;
  }

  const parts = parsePatternList(pattern);
  const normalizedItem = normalizeMatchText(trimmedItem);
  const alreadyPresent = parts.some(
    (part) => normalizeMatchText(part) === normalizedItem,
  );

  return alreadyPresent ? pattern : [...parts, trimmedItem].join(",");
}

function removePattern(pattern: string, item: string) {
  const normalizedItem = normalizeMatchText(item);

  return parsePatternList(pattern)
    .filter((part) => normalizeMatchText(part) !== normalizedItem)
    .join(",");
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadActiveModelUrl() {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const storedValue = storage.getItem(activeModelStorageKey);
    return storedValue && storedValue.trim() ? storedValue : null;
  } catch {
    return null;
  }
}

function saveActiveModelUrl(modelUrl: string) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(activeModelStorageKey, modelUrl);
  } catch {
    // Persistence is best-effort; viewer state still updates in memory.
  }
}

function normalizeModelUrl(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return defaultModelUrl;
  }

  if (typeof window === "undefined") {
    return trimmedUrl.split("?")[0];
  }

  try {
    const parsedUrl = new URL(trimmedUrl, window.location.origin);
    parsedUrl.search = "";
    parsedUrl.hash = "";
    return parsedUrl.pathname;
  } catch {
    return trimmedUrl.split("?")[0].split("#")[0];
  }
}

function isModelOrientation(value: unknown): value is ModelOrientation {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isDrillState(value: unknown): value is DrillState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DrillState>;
  return (
    typeof candidate.expandPattern === "string" &&
    Array.isArray(candidate.drillStack) &&
    candidate.drillStack.every((item) => typeof item === "string")
  );
}

function isCadMotorType(value: unknown): value is CadMotorType {
  return value === "DcMotor" || value === "Servo" || value === "CRServo";
}

function isMotionType(value: unknown): value is MotionType {
  return value === "rotate" || value === "translate";
}

function isAxis(value: unknown): value is Axis {
  return value === "x" || value === "y" || value === "z";
}

function normalizeMotionConfig(value: unknown): MotionConfig {
  if (!value || typeof value !== "object") {
    return { behaviors: [] };
  }

  const candidate = value as Partial<MotionConfig>;
  if (!Array.isArray(candidate.behaviors)) {
    return { behaviors: [] };
  }

  return {
    behaviors: candidate.behaviors.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const behavior = item as Partial<MotionBehavior>;
      if (
        typeof behavior.partName !== "string" ||
        typeof behavior.motorName !== "string" ||
        !isMotionType(behavior.type) ||
        !isAxis(behavior.axis) ||
        typeof behavior.speed !== "number" ||
        !Number.isFinite(behavior.speed)
      ) {
        return [];
      }

      const partName = behavior.partName;
      const motorName = behavior.motorName.trim();
      if (!partName || !motorName) {
        return [];
      }

      return [
        {
          id: `${partName}:${motorName}`,
          partName,
          motorName,
          motorType: isCadMotorType(behavior.motorType)
            ? behavior.motorType
            : "DcMotor",
          type: behavior.type,
          axis: behavior.axis,
          positiveDirectionSign:
            behavior.positiveDirectionSign === -1 ? -1 : 1,
          speed: behavior.speed,
          maxPower:
            typeof behavior.maxPower === "number" &&
            Number.isFinite(behavior.maxPower)
              ? Math.max(-1, Math.min(1, behavior.maxPower))
              : 1,
          min: typeof behavior.min === "number" ? behavior.min : undefined,
          max: typeof behavior.max === "number" ? behavior.max : undefined,
        },
      ];
    }),
  };
}

function loadModelMotionConfig(modelUrl: string): MotionConfig {
  const storage = getStorage();

  if (!storage) {
    return { behaviors: [] };
  }

  try {
    const storedValue = storage.getItem(
      `${motionConfigStoragePrefix}${normalizeModelUrl(modelUrl)}`,
    );

    if (!storedValue) {
      return { behaviors: [] };
    }

    return normalizeMotionConfig(JSON.parse(storedValue) as unknown);
  } catch {
    return { behaviors: [] };
  }
}

function loadModelSelectedPartName(modelUrl: string) {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const storedValue = storage.getItem(
      `${selectedPartStoragePrefix}${normalizeModelUrl(modelUrl)}`,
    );

    return storedValue && storedValue.trim() ? storedValue : null;
  } catch {
    return null;
  }
}

function saveModelSelectedPartName(modelUrl: string, selectedPartName: string | null) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    const storageKey = `${selectedPartStoragePrefix}${normalizeModelUrl(modelUrl)}`;

    if (selectedPartName) {
      storage.setItem(storageKey, selectedPartName);
    } else {
      storage.removeItem(storageKey);
    }
  } catch {
    // Persistence is best-effort; viewer state still updates in memory.
  }
}

function saveModelMotionConfig(modelUrl: string, motionConfig: MotionConfig) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      `${motionConfigStoragePrefix}${normalizeModelUrl(modelUrl)}`,
      JSON.stringify(motionConfig),
    );
  } catch {
    // Persistence is best-effort; viewer state still updates in memory.
  }
}

function cadMotorDevicesForConfig(motionConfig: MotionConfig): CadMotorDevice[] {
  const devicesByMotor = new Map<string, CadMotorDevice>();

  for (const behavior of motionConfig.behaviors) {
    const motorName = behavior.motorName;
    const existing = devicesByMotor.get(motorName);

    if (existing) {
      if (!existing.partNames.includes(behavior.partName)) {
        existing.partNames.push(behavior.partName);
      }
    } else {
      devicesByMotor.set(motorName, {
        motorName,
        motorType: behavior.motorType,
        partNames: [behavior.partName],
      });
    }
  }

  return Array.from(devicesByMotor.values())
    .map((device) => ({
      ...device,
      partNames: [...device.partNames].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.motorName.localeCompare(b.motorName));
}

function commitMotionConfig(current: CadState, motionConfig: MotionConfig): CadState {
  saveModelMotionConfig(current.modelUrl, motionConfig);

  return {
    ...current,
    motionConfig,
    cadMotorDevices: cadMotorDevicesForConfig(motionConfig),
  };
}

function suggestedMotorName(motionConfig: MotionConfig) {
  const names = new Set(motionConfig.behaviors.map((behavior) => behavior.motorName));

  if (!names.has("motor")) {
    return "motor";
  }

  for (let index = 1; index < 1000; index += 1) {
    const name = `motor${index}`;
    if (!names.has(name)) {
      return name;
    }
  }

  return `motor${Date.now()}`;
}

function behaviorsForCanonicalPart(
  current: CadState,
  behavior: MotionBehavior,
): MotionBehavior[] {
  const canonicalPartName = canonicalCadPartName(behavior.partName);
  const matchingParts = current.availableParts.filter(
    (partName) => canonicalCadPartName(partName) === canonicalPartName,
  );
  const partNames = matchingParts.length > 0 ? matchingParts : [behavior.partName];

  return partNames.map((partName) => ({
    ...behavior,
    id: `${partName}:${behavior.motorName}`,
    partName,
  }));
}

function loadModelOrientation(modelUrl: string): ModelOrientation {
  const storage = getStorage();

  if (!storage) {
    return identityOrientation;
  }

  try {
    const storedValue = storage.getItem(
      `${orientationStoragePrefix}${normalizeModelUrl(modelUrl)}`,
    );

    if (!storedValue) {
      return identityOrientation;
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    return isModelOrientation(parsedValue) ? parsedValue : identityOrientation;
  } catch {
    return identityOrientation;
  }
}

function saveModelOrientation(modelUrl: string, orientation: ModelOrientation) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      `${orientationStoragePrefix}${normalizeModelUrl(modelUrl)}`,
      JSON.stringify(orientation),
    );
  } catch {
    // Persistence is best-effort; viewer state still updates in memory.
  }
}

function loadModelDrillState(modelUrl: string): DrillState {
  const storage = getStorage();

  if (!storage) {
    return { expandPattern: defaultExpandPattern, drillStack: [] };
  }

  try {
    const storedValue = storage.getItem(
      `${drillStoragePrefix}${normalizeModelUrl(modelUrl)}`,
    );

    if (!storedValue) {
      return { expandPattern: defaultExpandPattern, drillStack: [] };
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    return isDrillState(parsedValue)
      ? parsedValue
      : { expandPattern: defaultExpandPattern, drillStack: [] };
  } catch {
    return { expandPattern: defaultExpandPattern, drillStack: [] };
  }
}

function saveModelDrillState(modelUrl: string, drillState: DrillState) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      `${drillStoragePrefix}${normalizeModelUrl(modelUrl)}`,
      JSON.stringify(drillState),
    );
  } catch {
    // Persistence is best-effort; viewer state still updates in memory.
  }
}

export const cadStore = {
  getState: (): CadStore => ({
    ...state,
    selectPart: cadActions.selectPart,
    setPickMode: cadActions.setPickMode,
    setAvailableParts: cadActions.setAvailableParts,
    setModelUrl: cadActions.setModelUrl,
    setExpandPattern: cadActions.setExpandPattern,
    drillIntoSelectedPart: cadActions.drillIntoSelectedPart,
    drillUpOneLevel: cadActions.drillUpOneLevel,
    setMotionDraft: cadActions.setMotionDraft,
    setModelOrientation: cadActions.setModelOrientation,
    selectMotionDirection: cadActions.selectMotionDirection,
    upsertBehavior: cadActions.upsertBehavior,
    deleteBehaviorForPart: cadActions.deleteBehaviorForPart,
    updateCadMotorDevice: cadActions.updateCadMotorDevice,
    setMotorPower: cadActions.setMotorPower,
    setMotorPowers: cadActions.setMotorPowers,
    resetTransforms: cadActions.resetTransforms,
  }),
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const cadActions = {
  selectPart: (name: string | null) => {
    setState((current) => {
      saveModelSelectedPartName(current.modelUrl, name);

      return {
        ...current,
        selectedPartName: name,
      };
    });
  },

  setPickMode: (enabled: boolean) => {
    setState((current) => ({
      ...current,
      isPickMode: enabled,
    }));
  },

  setAvailableParts: (parts: string[]) => {
    const availableParts = uniqueSortedParts(parts);

    setState((current) => {
      const selectedPartName =
        current.selectedPartName &&
        availableParts.includes(current.selectedPartName)
          ? current.selectedPartName
          : null;

      if (current.selectedPartName && !selectedPartName) {
        saveModelSelectedPartName(current.modelUrl, null);
      }

      return {
        ...current,
        availableParts,
        selectedPartName,
      };
    });
  },

  setModelUrl: (url: string) => {
    if (!url.trim()) {
      return;
    }

    const modelUrl = url.trim();
    saveActiveModelUrl(modelUrl);
    const drillState = loadModelDrillState(modelUrl);
    const motionConfig = loadModelMotionConfig(modelUrl);

    setState((current) => {
      const selectedPartName = loadModelSelectedPartName(modelUrl);

      return {
        ...current,
        modelUrl,
        expandPattern: drillState.expandPattern,
        drillStack: drillState.drillStack,
        selectedPartName,
        isPickMode: false,
        availableParts: [],
        motionConfig,
        cadMotorDevices: cadMotorDevicesForConfig(motionConfig),
        motorState: {},
        motionDraft: {
          ...defaultMotionDraft,
          motorName: suggestedMotorName(motionConfig),
        },
        modelOrientation: loadModelOrientation(modelUrl),
        resetTransformsToken: current.resetTransformsToken + 1,
      };
    });
  },

  setExpandPattern: (pattern: string) => {
    setState((current) => {
      const nextDrillState = {
        expandPattern: pattern,
        drillStack: [],
      };

      saveModelDrillState(current.modelUrl, nextDrillState);
      saveModelSelectedPartName(current.modelUrl, null);

      return {
        ...current,
        ...nextDrillState,
        selectedPartName: null,
      };
    });
  },

  drillIntoSelectedPart: () => {
    setState((current) => {
      if (!current.selectedPartName) {
        return current;
      }

      const partName = selectablePatternName(current.selectedPartName);
      const nextPattern = appendPattern(current.expandPattern, partName);

      if (nextPattern === current.expandPattern) {
        return current;
      }

      const nextDrillState = {
        expandPattern: nextPattern,
        drillStack: [...current.drillStack, partName],
      };

      saveModelDrillState(current.modelUrl, nextDrillState);
      saveModelSelectedPartName(current.modelUrl, null);

      return {
        ...current,
        ...nextDrillState,
        selectedPartName: null,
        isPickMode: false,
      };
    });
  },

  drillUpOneLevel: () => {
    setState((current) => {
      const parentName = current.drillStack[current.drillStack.length - 1];

      if (!parentName) {
        return current;
      }

      const nextDrillState = {
        expandPattern: removePattern(current.expandPattern, parentName),
        drillStack: current.drillStack.slice(0, -1),
      };

      saveModelDrillState(current.modelUrl, nextDrillState);
      saveModelSelectedPartName(current.modelUrl, parentName);

      return {
        ...current,
        ...nextDrillState,
        selectedPartName: parentName,
        isPickMode: false,
      };
    });
  },

  setMotionDraft: (draft: Partial<MotionDraft>) => {
    setState((current) => ({
      ...current,
      motionDraft: {
        ...current.motionDraft,
        ...draft,
      },
    }));
  },

  setModelOrientation: (orientation: ModelOrientation) => {
    setState((current) => {
      saveModelOrientation(current.modelUrl, orientation);
      saveModelSelectedPartName(current.modelUrl, null);

      return {
        ...current,
        modelOrientation: orientation,
        selectedPartName: null,
        isPickMode: false,
      };
    });
  },

  selectMotionDirection: (axis: Axis, sign: 1 | -1) => {
    setState((current) => {
      const trimmedMotorName = current.motionDraft.motorName.trim();
      const currentPower = trimmedMotorName
        ? current.motorState[trimmedMotorName] ?? 0
        : 0;
      const nextPower = Math.max(Math.abs(currentPower), defaultDirectionPower) * sign;
      const nextDraft = {
        ...current.motionDraft,
        axis,
        positiveDirectionSign: sign,
      };
      const nextState: CadState = {
        ...current,
        motionDraft: nextDraft,
        isPickMode: false,
      };

      if (!current.selectedPartName || !trimmedMotorName) {
        return nextState;
      }

      const behavior: MotionBehavior = {
        id: `${current.selectedPartName}:${trimmedMotorName}`,
        partName: current.selectedPartName,
        motorName: trimmedMotorName,
        motorType: nextDraft.motorType,
        type: nextDraft.type,
        axis,
        positiveDirectionSign: sign,
        speed: nextDraft.speed,
        maxPower: nextDraft.maxPower,
      };
      const behaviors = current.motionConfig.behaviors.filter(
        (item) =>
          canonicalCadPartName(item.partName) !==
          canonicalCadPartName(behavior.partName),
      );
      const nextBehaviors = behaviorsForCanonicalPart(current, behavior);

      return commitMotionConfig(
        {
          ...nextState,
          motorState: {
            ...current.motorState,
            [trimmedMotorName]: clampMotorPower(nextPower),
          },
        },
        { behaviors: [...behaviors, ...nextBehaviors] },
      );
    });
  },

  upsertBehavior: (behavior: MotionBehavior) => {
    setState((current) => {
      const behaviors = current.motionConfig.behaviors.filter(
        (item) =>
          canonicalCadPartName(item.partName) !==
          canonicalCadPartName(behavior.partName),
      );
      const nextBehaviors = behaviorsForCanonicalPart(current, behavior);

      return {
        ...commitMotionConfig(current, {
          behaviors: [...behaviors, ...nextBehaviors],
        }),
        isPickMode: false,
      };
    });
  },

  deleteBehaviorForPart: (partName: string) => {
    setState((current) => {
      const canonicalPartName = canonicalCadPartName(partName);
      const motionConfig = {
        behaviors: current.motionConfig.behaviors.filter(
          (behavior) =>
            canonicalCadPartName(behavior.partName) !== canonicalPartName,
        ),
      };

      return {
        ...commitMotionConfig(current, motionConfig),
        motorState: Object.fromEntries(
          Object.entries(current.motorState).filter(([motorName]) =>
            motionConfig.behaviors.some((behavior) => behavior.motorName === motorName),
          ),
        ) as MotorState,
        isPickMode: false,
      };
    });
  },

  updateCadMotorDevice: (
    motorName: string,
    updates: Partial<Pick<CadMotorDevice, "motorName" | "motorType">>,
  ) => {
    setState((current) => {
      const existingDevice = current.cadMotorDevices.find(
        (device) => device.motorName === motorName,
      );
      const nextMotorName =
        updates.motorName === undefined
          ? existingDevice?.motorName
          : updates.motorName.trim();
      const nextMotorType = updates.motorType ?? existingDevice?.motorType ?? "DcMotor";

      if (nextMotorName === undefined) {
        return current;
      }

      const motionConfig = {
        behaviors: current.motionConfig.behaviors.map((behavior) => {
          if (behavior.motorName !== motorName) {
            return behavior;
          }

          return {
            ...behavior,
            id: `${behavior.partName}:${nextMotorName}`,
            motorName: nextMotorName,
            motorType: nextMotorType,
          };
        }),
      };
      const motorState =
        existingDevice?.motorName && existingDevice.motorName !== nextMotorName
          ? ({
              ...current.motorState,
              [nextMotorName]:
                current.motorState[existingDevice.motorName] ??
                current.motorState[nextMotorName] ??
                0,
              [existingDevice.motorName]: undefined,
            } as MotorState)
          : current.motorState;

      return {
        ...commitMotionConfig(current, motionConfig),
        motorState: Object.fromEntries(
          Object.entries(motorState).filter(([, power]) => power !== undefined),
        ) as MotorState,
      };
    });
  },

  setMotorPower: (motorName: string, power: number) => {
    if (!motorName.trim()) {
      return;
    }

    setState((current) => ({
      ...current,
      motorState: {
        ...current.motorState,
        [motorName]: clampMotorPower(power),
      },
      isPickMode: false,
    }));
  },

  setMotorPowers: (powers: MotorState) => {
    setState((current) => ({
      ...current,
      motorState: Object.fromEntries(
        Object.entries(powers).map(([motorName, power]) => [
          motorName,
          clampMotorPower(power),
        ]),
      ),
    }));
  },

  resetTransforms: () => {
    setState((current) => ({
      ...current,
      motorState: {},
      isPickMode: false,
      resetTransformsToken: current.resetTransformsToken + 1,
    }));
  },
};

export function useCadStore<T>(selector: (store: CadStore) => T): T {
  return useSyncExternalStore(
    cadStore.subscribe,
    () => selector(cadStore.getState()),
    () => selector(cadStore.getState()),
  );
}

export const {
  selectPart,
  setPickMode,
  setAvailableParts,
  setModelUrl,
  setExpandPattern,
  drillIntoSelectedPart,
  drillUpOneLevel,
  setMotionDraft,
  setModelOrientation,
  selectMotionDirection,
  upsertBehavior,
  deleteBehaviorForPart,
  updateCadMotorDevice,
  setMotorPower,
  setMotorPowers,
  resetTransforms,
} = cadActions;
