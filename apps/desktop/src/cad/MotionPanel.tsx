import { useEffect, useMemo } from "react";
import {
  canonicalCadPartName,
  resetTransforms,
  setMotorPower,
  setMotionDraft,
  upsertBehavior,
  useCadStore,
} from "./cadStore";
import type { Axis, MotionType } from "./types";

function suggestedMotorName(existingNames: string[]) {
  const names = new Set(existingNames);

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

export function MotionPanel() {
  const selectedPartName = useCadStore((store) => store.selectedPartName);
  const behavior = useCadStore((store) =>
    store.motionConfig.behaviors.find(
      (item) =>
        store.selectedPartName &&
        canonicalCadPartName(item.partName) ===
          canonicalCadPartName(store.selectedPartName),
    ),
  );
  const motionConfig = useCadStore((store) => store.motionConfig);
  const motorState = useCadStore((store) => store.motorState);
  const motionDraft = useCadStore((store) => store.motionDraft);
  const behaviorMotorNames = useMemo(
    () => motionConfig.behaviors.map((item) => item.motorName),
    [motionConfig],
  );

  useEffect(() => {
    if (!selectedPartName) {
      return;
    }

    setMotionDraft({
      motorName: behavior?.motorName ?? suggestedMotorName(behaviorMotorNames),
      motorType: behavior?.motorType ?? "DcMotor",
      type: behavior?.type ?? "rotate",
      axis: behavior?.axis ?? "z",
      positiveDirectionSign: behavior?.positiveDirectionSign ?? 1,
      speed: 1,
      maxPower: behavior?.maxPower ?? 1,
    });
  }, [behavior, behaviorMotorNames, selectedPartName]);

  const motorPower = useMemo(() => {
    return motorState[motionDraft.motorName] ?? 0;
  }, [motionDraft.motorName, motorState]);

  function saveBehavior() {
    const trimmedMotorName = motionDraft.motorName.trim();

    if (!selectedPartName || !trimmedMotorName) {
      return;
    }

    upsertBehavior({
      id: `${selectedPartName}:${trimmedMotorName}`,
      partName: selectedPartName,
      motorName: trimmedMotorName,
      motorType: motionDraft.motorType,
      type: motionDraft.type,
      axis: motionDraft.axis,
      positiveDirectionSign: motionDraft.positiveDirectionSign,
      speed: 1,
      maxPower: motionDraft.maxPower,
    });
  }

  return (
    <aside className="sidebar motion-panel">
      <header className="panel-header">
        <h2>Motion</h2>
      </header>

      <section className="field-group">
        <label>
          <span>Selected part</span>
          <output>{selectedPartName ?? "None"}</output>
        </label>
      </section>

      <fieldset disabled={!selectedPartName}>
        <label>
          <span>Motor name</span>
          <input
            value={motionDraft.motorName}
            onChange={(event) => setMotionDraft({ motorName: event.currentTarget.value })}
            placeholder="armMotor"
          />
        </label>

        <label>
          <span>Motion type</span>
          <select
            value={motionDraft.type}
            onChange={(event) =>
              setMotionDraft({ type: event.currentTarget.value as MotionType })
            }
          >
            <option value="rotate">Rotate</option>
            <option value="translate">Translate</option>
          </select>
        </label>

        <label>
          <span>Axis</span>
          <select
            value={motionDraft.axis}
            onChange={(event) =>
              setMotionDraft({ axis: event.currentTarget.value as Axis })
            }
          >
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="z">Z</option>
          </select>
        </label>

        <label>
          <span>Max speed</span>
          <input
            max="1"
            min="0"
            step="0.01"
            type="number"
            value={motionDraft.maxPower}
            onChange={(event) =>
              setMotionDraft({ maxPower: event.currentTarget.valueAsNumber || 0 })
            }
          />
        </label>

        <button className="primary-action" type="button" onClick={saveBehavior}>
          Save behavior
        </button>

        <label>
          <span>Fake motor power</span>
          <input
            max="1"
            min="-1"
            step="0.01"
            type="range"
            value={motorPower}
            onChange={(event) =>
              setMotorPower(motionDraft.motorName, event.currentTarget.valueAsNumber)
            }
          />
          <output>{motorPower.toFixed(2)}</output>
        </label>
      </fieldset>

      <section className="field-group">
        <button className="secondary-action" type="button" onClick={resetTransforms}>
          Reset positions
        </button>
      </section>
    </aside>
  );
}
