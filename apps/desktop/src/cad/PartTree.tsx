import {
  drillIntoSelectedPart,
  drillUpOneLevel,
  selectPart,
  useCadStore,
} from "./cadStore";

export function PartTree() {
  const availableParts = useCadStore((store) => store.availableParts);
  const selectedPartName = useCadStore((store) => store.selectedPartName);
  const drillStack = useCadStore((store) => store.drillStack);

  return (
    <aside className="sidebar part-tree">
      <header className="panel-header">
        <h2>Parts</h2>
        <span>{availableParts.length}</span>
      </header>

      <div className="part-drill-controls">
        <button
          disabled={!selectedPartName}
          type="button"
          onClick={drillIntoSelectedPart}
        >
          Break down
        </button>
        <button
          disabled={drillStack.length === 0}
          type="button"
          onClick={drillUpOneLevel}
        >
          Up layer
        </button>
      </div>

      {availableParts.length === 0 ? (
        <p className="empty-state">Add `public/models/test-robot.glb`.</p>
      ) : (
        <ul className="part-list">
          {availableParts.map((partName) => (
            <li key={partName}>
              <button
                className={partName === selectedPartName ? "selected" : ""}
                type="button"
                onClick={() => selectPart(partName)}
              >
                {partName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
