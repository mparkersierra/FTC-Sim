import { CadViewer } from "../cad/CadViewer";
import type { OpMode, TabId, TelemetryItem } from "../types";

type DriverStationPageProps = {
  activeTab: TabId;
  infoText: string;
  mainActionButtonText: string;
  opModes: OpMode[];
  selectedOpModeId: string;
  statusText: string;
  telemetryItems: TelemetryItem[];
  onMainAction: () => void;
  onRequestOpModes: () => void;
  onSelectOpMode: (id: string) => void;
};

export function DriverStationPage({
  activeTab,
  infoText,
  mainActionButtonText,
  opModes,
  selectedOpModeId,
  statusText,
  telemetryItems,
  onMainAction,
  onRequestOpModes,
  onSelectOpMode,
}: DriverStationPageProps) {
  return (
    <section className={`tab driver-station-tab ${activeTab === "driverStation" ? "active" : ""}`}>
      <div className="driver-station-layout">
        <div className="driver-station-left">
          <div className="driver-station-card">
            <h1>Driver Station</h1>

            <button onClick={onRequestOpModes} type="button">
              Scan OpModes
            </button>

            <p>Select program:</p>
            <select value={selectedOpModeId} onChange={(event) => onSelectOpMode(event.target.value)}>
              {opModes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.modeType} - {item.name}
                </option>
              ))}
            </select>

            <div className="driver-actions">
              <button onClick={onMainAction} type="button">
                {mainActionButtonText}
              </button>
            </div>

            <p>{statusText}</p>
          </div>

          <section className="telemetry-panel" aria-label="Telemetry">
            {telemetryItems.map((item) => (
              <div className="telemetry-row" key={item.caption}>
                <span className="telemetry-caption">{item.caption}</span>
                <span className="telemetry-value">{item.value}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="driver-robot-panel" aria-label="Robot visualizer">
          <div className="info">{infoText}</div>
          <CadViewer mode="display" />
        </section>
      </div>
    </section>
  );
}
