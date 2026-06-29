import { useEffect, useMemo } from "react";
import {
  resetTransforms,
  setMotorPower,
  setMotionDraft,
  upsertBehavior,
  useCadStore,
} from "./cadStore";
import type { Axis, MotionType } from "./types";

const defaultMotorName = "armMotor";

export function MotionPanel() {
  const selectedPartName = useCadStore((store) => store.selectedPartName);
  const behavior = useCadStore((store) =>
    store.motionConfig.behaviors.find(
      (item) => item.partName === store.selectedPartName,
    ),
  );
  const motorState = useCadStore((store) => store.motorState);
  const motionDraft = useCadStore((store) => store.motionDraft);

  useEffect(() => {
    if (!selectedPartName) {
      return;
    }

    setMotionDraft({
      motorName: behavior?.motorName ?? defaultMotorName,
      type: behavior?.type ?? "rotate",
      axis: behavior?.axis ?? "z",
      speed: behavior?.speed ?? 1,
    });
  }, [behavior, selectedPartName]);

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
      type: motionDraft.type,
      axis: motionDraft.axis,
      speed: motionDraft.speed,
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
          <span>Speed</span>
          <input
            min="0"
            step="0.1"
            type="number"
            value={motionDraft.speed}
            onChange={(event) =>
              setMotionDraft({ speed: event.currentTarget.valueAsNumber || 0 })
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
