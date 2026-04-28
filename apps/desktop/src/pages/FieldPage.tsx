import type { RefObject } from "react";
import type { TabId } from "../types";

type FieldPageProps = {
  activeTab: TabId;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  infoText: string;
};

export function FieldPage({ activeTab, canvasRef, infoText }: FieldPageProps) {
  return (
    <section className={`tab field-tab ${activeTab === "field" ? "active" : ""}`}>
      <div className="info">{infoText}</div>
      <canvas ref={canvasRef} />
    </section>
  );
}
