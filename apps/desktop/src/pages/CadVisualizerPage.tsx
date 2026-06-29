import { CadViewer } from "../cad/CadViewer";
import { MotionPanel } from "../cad/MotionPanel";
import { PartTree } from "../cad/PartTree";
import { StepImportPanel } from "../cad/StepImportPanel";
import type { TabId } from "../types";
import "./CadVisualizerPage.css";

type CadVisualizerPageProps = {
  activeTab: TabId;
};

export function CadVisualizerPage({ activeTab }: CadVisualizerPageProps) {
  return (
    <main className={`tab cad-visualizer-tab ${activeTab === "cadVisualizer" ? "active" : ""}`}>
      <div className="cad-visualizer-page">
        <div className="cad-visualizer-shell">
          <PartTree />
          <CadViewer />
          <div className="right-rail">
            <StepImportPanel />
            <MotionPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
