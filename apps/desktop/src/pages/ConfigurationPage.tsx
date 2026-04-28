import { bindableInputs, gamepadControls, hardwareTypes } from "../config";
import type { ActiveBinding, Binding, GamepadMappingConfig, GamepadNumber, HardwareDevice, TabId } from "../types";

type ConfigurationPageProps = {
  activeBinding: ActiveBinding;
  activeTab: TabId;
  bindingHint: string;
  gamepadMappingConfig: GamepadMappingConfig;
  hardwareMapConfig: HardwareDevice[];
  inputLabel: (code?: string) => string;
  onAddHardwareRow: () => void;
  onAssignBinding: (code: string) => void;
  onRemoveHardwareRow: (index: number) => void;
  onSaveHardwareMap: () => void;
  onSelectBinding: (binding: Binding, label: string) => void;
  onUpdateHardwareRow: (index: number, updates: Partial<HardwareDevice>) => void;
};

export function ConfigurationPage({
  activeBinding,
  activeTab,
  bindingHint,
  gamepadMappingConfig,
  hardwareMapConfig,
  inputLabel,
  onAddHardwareRow,
  onAssignBinding,
  onRemoveHardwareRow,
  onSaveHardwareMap,
  onSelectBinding,
  onUpdateHardwareRow,
}: ConfigurationPageProps) {
  return (
    <section className={`tab app-panel ${activeTab === "configuration" ? "active" : ""}`}>
      <h1>Configuration</h1>

      <h2>Hardware Map</h2>

      <div className="config-actions">
        <button onClick={onAddHardwareRow} type="button">
          + Add Component
        </button>
        <button onClick={onSaveHardwareMap} type="button">
          Save Hardware Map
        </button>
      </div>

      <div>
        {hardwareMapConfig.map((item, index) => (
          <div className="hardware-row" key={`${index}-${item.name}`}>
            <select value={item.type} onChange={(event) => onUpdateHardwareRow(index, { type: event.target.value })}>
              {hardwareTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              onChange={(event) => onUpdateHardwareRow(index, { name: event.target.value })}
              placeholder="hardware name"
              value={item.name}
            />

            <button onClick={() => onRemoveHardwareRow(index)} type="button">
              Remove
            </button>
          </div>
        ))}
      </div>

      <h2>Gamepad Mapping</h2>
      <p className="binding-hint">{bindingHint}</p>

      <div className="input-palette">
        {bindableInputs.map((input) => (
          <button key={input.code} onClick={() => onAssignBinding(input.code)} type="button">
            {input.label}
          </button>
        ))}
        <button onClick={() => onAssignBinding("")} type="button">
          Clear
        </button>
      </div>

      <div className="gamepad-configs">
        {([1, 2] as GamepadNumber[]).map((gamepadNumber) => (
          <section className="gamepad-config" key={gamepadNumber}>
            <h3>Gamepad {gamepadNumber}</h3>

            <div className="mapping-grid">
              {gamepadControls.map((control) => (
                <button
                  className={`mapping-slot ${
                    activeBinding?.gamepadNumber === gamepadNumber && activeBinding.control === control.id
                      ? "active"
                      : ""
                  }`}
                  key={control.id}
                  onClick={() => onSelectBinding({ gamepadNumber, control: control.id }, control.label)}
                  type="button"
                >
                  <span className="mapping-label">{control.label}</span>
                  <span className="mapping-value">{inputLabel(gamepadMappingConfig[gamepadNumber][control.id])}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
