import { useSyncExternalStore } from "react";
import type {
  Axis,
  ModelOrientation,
  MotionBehavior,
  MotionConfig,
  MotionDraft,
  MotorState,
} from "./types";

const defaultMotionDraft: MotionDraft = {
  motorName: "armMotor",
  type: "rotate",
  axis: "z",
  speed: 1,
};

const defaultDirectionPower = 0.5;
const defaultModelUrl = "/models/test-robot.glb";
const defaultExpandPattern = "chassis";
const identityOrientation: ModelOrientation = [0, 0, 0, 1];
const orientationStoragePrefix = "cad-motion:model-orientation:";
const drillStoragePrefix = "cad-motion:drill-state:";

interface CadState {
  modelUrl: string;
  expandPattern: string;
  drillStack: string[];
  selectedPartName: string | null;
  isPickMode: boolean;
  availableParts: string[];
  motionConfig: MotionConfig;
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
  setMotorPower: (motorName: string, power: number) => void;
  resetTransforms: () => void;
}

type Listener = () => void;
type DrillState = {
  expandPattern: string;
  drillStack: string[];
};

const initialDrillState = loadModelDrillState(defaultModelUrl);
const initialState: CadState = {
  modelUrl: defaultModelUrl,
  expandPattern: initialDrillState.expandPattern,
  drillStack: initialDrillState.drillStack,
  selectedPartName: null,
  isPickMode: false,
  availableParts: [],
  motionConfig: { behaviors: [] },
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
    setMotorPower: cadActions.setMotorPower,
    resetTransforms: cadActions.resetTransforms,
  }),
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const cadActions = {
  selectPart: (name: string | null) => {
    setState((current) => ({
      ...current,
      selectedPartName: name,
    }));
  },

  setPickMode: (enabled: boolean) => {
    setState((current) => ({
      ...current,
      isPickMode: enabled,
    }));
  },

  setAvailableParts: (parts: string[]) => {
    const availableParts = uniqueSortedParts(parts);

    setState((current) => ({
      ...current,
      availableParts,
      selectedPartName:
        current.selectedPartName &&
        availableParts.includes(current.selectedPartName)
          ? current.selectedPartName
          : null,
    }));
  },

  setModelUrl: (url: string) => {
    if (!url.trim()) {
      return;
    }

    const modelUrl = url.trim();
    const drillState = loadModelDrillState(modelUrl);

    setState((current) => ({
      ...current,
      modelUrl,
      expandPattern: drillState.expandPattern,
      drillStack: drillState.drillStack,
      selectedPartName: null,
      isPickMode: false,
      availableParts: [],
      motionConfig: { behaviors: [] },
      motorState: {},
      motionDraft: defaultMotionDraft,
      modelOrientation: loadModelOrientation(modelUrl),
      resetTransformsToken: current.resetTransformsToken + 1,
    }));
  },

  setExpandPattern: (pattern: string) => {
    setState((current) => {
      const nextDrillState = {
        expandPattern: pattern,
        drillStack: [],
      };

      saveModelDrillState(current.modelUrl, nextDrillState);

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
        type: nextDraft.type,
        axis,
        speed: nextDraft.speed,
      };
      const behaviors = current.motionConfig.behaviors.filter(
        (item) => item.id !== behavior.id,
      );

      return {
        ...nextState,
        motionConfig: {
          behaviors: [...behaviors, behavior],
        },
        motorState: {
          ...current.motorState,
          [trimmedMotorName]: clampMotorPower(nextPower),
        },
      };
    });
  },

  upsertBehavior: (behavior: MotionBehavior) => {
    setState((current) => {
      const behaviors = current.motionConfig.behaviors.filter(
        (item) => item.id !== behavior.id,
      );

      return {
        ...current,
        motionConfig: {
          behaviors: [...behaviors, behavior],
        },
        isPickMode: false,
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
  setMotorPower,
  resetTransforms,
} = cadActions;
