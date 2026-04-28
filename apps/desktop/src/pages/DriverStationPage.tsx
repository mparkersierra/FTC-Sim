import type { OpMode, TabId } from "../types";

type DriverStationPageProps = {
  activeTab: TabId;
  mainActionButtonText: string;
  opModes: OpMode[];
  selectedOpModeId: string;
  statusText: string;
  onMainAction: () => void;
  onRequestOpModes: () => void;
  onSelectOpMode: (id: string) => void;
};

export function DriverStationPage({
  activeTab,
  mainActionButtonText,
  opModes,
  selectedOpModeId,
  statusText,
  onMainAction,
  onRequestOpModes,
  onSelectOpMode,
}: DriverStationPageProps) {
  return (
    <section className={`tab app-panel ${activeTab === "driverStation" ? "active" : ""}`}>
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
    </section>
  );
}
