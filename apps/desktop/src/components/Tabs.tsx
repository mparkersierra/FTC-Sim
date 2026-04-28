import type { TabId } from "../types";

type TabsProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "driverStation", label: "Driver Station" },
  { id: "configuration", label: "Configuration" },
  { id: "onbotJava", label: "OnBot Java" },
  { id: "field", label: "Field" },
];

export function Tabs({ activeTab, onChange }: TabsProps) {
  return (
    <nav className="tabs">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
