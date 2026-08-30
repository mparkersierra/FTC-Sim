import { useEffect, useMemo, useState } from "react";
import { hardwareTypes } from "../config";
import {
  canonicalCadPartName,
  deleteBehaviorForPart,
  selectPart,
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
  const cadMotorDevices = useCadStore((store) => store.cadMotorDevices);
  const motorState = useCadStore((store) => store.motorState);
  const motionDraft = useCadStore((store) => store.motionDraft);
  const [maxPowerInput, setMaxPowerInput] = useState(String(motionDraft.maxPower));
  const behaviorMotorNames = useMemo(
    () => motionConfig.behaviors.map((item) => item.motorName),
    [motionConfig],
  );
  const parsedMaxPower = Number(maxPowerInput);
  const canSaveBehavior =
    Boolean(selectedPartName && motionDraft.motorName.trim()) &&
    (motionDraft.motorType === "Servo" ||
      (maxPowerInput.trim() !== "" && Number.isFinite(parsedMaxPower)));

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
    setMaxPowerInput(String(behavior?.maxPower ?? 1));
  }, [behavior, behaviorMotorNames, selectedPartName]);

  const motorPower = useMemo(() => {
    return motorState[motionDraft.motorName] ?? 0;
  }, [motionDraft.motorName, motorState]);

  function saveBehavior() {
    const trimmedMotorName = motionDraft.motorName.trim();

    if (!selectedPartName || !trimmedMotorName || !canSaveBehavior) {
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
      maxPower: motionDraft.motorType === "Servo" ? 1 : parsedMaxPower,
    });
  }

  function deleteSelectedBehavior() {
    if (selectedPartName) {
      deleteBehaviorForPart(selectedPartName);
    }
  }

  function selectMotorDevice(partNames: string[]) {
    if (partNames.length === 0) {
      return;
    }

    const selectedIndex = selectedPartName
      ? partNames.findIndex((partName) => partName === selectedPartName)
      : -1;
    const nextIndex = selectedIndex >= 0
      ? (selectedIndex + 1) % partNames.length
      : 0;
    const firstPartName = partNames[nextIndex];

    if (firstPartName) {
      selectPart(firstPartName);
    }
  }

  return (
    <aside className="sidebar motion-panel">
      <header className="panel-header">
        <h2>Motion</h2>
      </header>

      {selectedPartName ? (
        <>
          <section className="field-group">
            <label>
              <span>Selected part</span>
              <output>{selectedPartName}</output>
            </label>
          </section>

          <fieldset>
            <label>
              <span>Hardware name</span>
              <input
                autoCapitalize="none"
                autoCorrect="off"
                value={motionDraft.motorName}
                onChange={(event) => setMotionDraft({ motorName: event.currentTarget.value })}
                placeholder="armMotor"
                spellCheck={false}
              />
            </label>

            <label>
              <span>Hardware type</span>
              <select
                value={motionDraft.motorType}
                onChange={(event) =>
                  setMotionDraft({
                    motorType: event.currentTarget.value as typeof motionDraft.motorType,
                  })
                }
              >
                {hardwareTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
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

            {motionDraft.motorType === "Servo" ? null : (
              <label>
                <span>Max power</span>
                <input
                  max="1"
                  min="-1"
                  step="0.01"
                  type="number"
                  value={maxPowerInput}
                  onChange={(event) => setMaxPowerInput(event.currentTarget.value)}
                />
              </label>
            )}

            <button
              className="primary-action"
              disabled={!canSaveBehavior}
              type="button"
              onClick={saveBehavior}
            >
              {behavior ? "Update behavior" : "Save behavior"}
            </button>

            {behavior ? (
              <button
                className="danger-action"
                type="button"
                onClick={deleteSelectedBehavior}
              >
                Delete part
              </button>
            ) : null}

            <label>
              <span>{motionDraft.motorType === "Servo" ? "Fake servo position" : "Fake motor power"}</span>
              <input
                max="1"
                min={motionDraft.motorType === "Servo" ? "0" : "-1"}
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
        </>
      ) : (
        <p className="empty-state">Select a part to assign a motor.</p>
      )}

      {cadMotorDevices.length > 0 ? (
        <section className="configured-motors">
          <h3>Configured motors</h3>
          <div className="configured-motor-list">
            {cadMotorDevices.map((device) => (
              <button
                className="configured-motor-item"
                key={device.motorName}
                type="button"
                onClick={() => selectMotorDevice(device.partNames)}
                title={
                  device.partNames.length > 1
                    ? "Click to cycle through parts"
                    : "Click to select part"
                }
              >
                <strong>{device.motorName}</strong>
                <span>{device.partNames.length} {device.partNames.length === 1 ? "part" : "parts"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

    </aside>
  );
}
