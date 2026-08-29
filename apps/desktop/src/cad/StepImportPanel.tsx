import { useEffect, useMemo, useState } from "react";
import { apiUrl, backendAssetUrl, cadBackendBaseUrl } from "./api";
import { setExpandPattern, setModelUrl, useCadStore } from "./cadStore";

type QualityPreset = "fast" | "balanced" | "detailed";

const qualitySettings: Record<
  QualityPreset,
  {
    label: string;
    preview: boolean;
    minBboxMm: number;
    linearDeflection: number;
    angularDeflection: number;
  }
> = {
  fast: {
    label: "Fast",
    preview: true,
    minBboxMm: 12,
    linearDeflection: 3,
    angularDeflection: 1.5,
  },
  balanced: {
    label: "Balanced",
    preview: true,
    minBboxMm: 8,
    linearDeflection: 2,
    angularDeflection: 1.2,
  },
  detailed: {
    label: "Detailed",
    preview: false,
    minBboxMm: 0,
    linearDeflection: 0.25,
    angularDeflection: 0.6,
  },
};

interface ConversionResponse {
  modelUrl: string;
  parts: Array<{
    name: string;
    nodeName: string;
  }>;
}

interface InspectResponse {
  treeUrl: string;
  treeText: string;
}

interface GeneratedModel {
  name: string;
  modelUrl: string;
  sizeBytes: number;
  modifiedAt: number;
}

interface GeneratedModelsResponse {
  models: GeneratedModel[];
}

export function StepImportPanel() {
  const modelUrl = useCadStore((store) => store.modelUrl);
  const availableParts = useCadStore((store) => store.availableParts);
  const [backendBaseUrl, setBackendBaseUrl] = useState("http://127.0.0.1:8087");
  const [stepFile, setStepFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState("robot");
  const [isManagingRobot, setIsManagingRobot] = useState(false);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("fast");
  const [skipPattern, setSkipPattern] = useState(
    "hardware,label,motor,servo,connector,screw,bolt,nut,washer,spacer,standoff,bearing,thread,fastener,pin,snap ring",
  );
  const [expandPatternInput, setExpandPatternInput] = useState("chassis");
  const [minBboxMm, setMinBboxMm] = useState(qualitySettings.fast.minBboxMm);
  const [status, setStatus] = useState<string | null>(null);
  const [treeText, setTreeText] = useState("");
  const [generatedModels, setGeneratedModels] = useState<GeneratedModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const activeGeneratedModel = useMemo(() => {
    const activePath = normalizedModelPath(modelUrl);

    return generatedModels.find((model) => normalizedModelPath(model.modelUrl) === activePath) ?? null;
  }, [generatedModels, modelUrl]);
  const activeRobotName = activeGeneratedModel?.name ?? modelNameFromUrl(modelUrl);

  useEffect(() => {
    let cancelled = false;

    async function connectCadBackend() {
      const baseUrl = await cadBackendBaseUrl();
      if (cancelled) return;

      setBackendBaseUrl(baseUrl);
      await loadGeneratedModels(baseUrl);
    }

    void connectCadBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadGeneratedModels(baseUrl = backendBaseUrl) {
    setIsLoadingModels(true);

    try {
      const response = await fetchWithRetry(apiUrl(baseUrl, "/api/generated-models"));
      const payload = (await response.json()) as
        | GeneratedModelsResponse
        | { message?: string };

      if (!response.ok || !("models" in payload)) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(message ?? "Could not load generated models.");
      }

      setGeneratedModels(payload.models);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load generated models.");
    } finally {
      setIsLoadingModels(false);
    }
  }

  function loadGeneratedModel(model: GeneratedModel) {
    setModelUrl(`${backendAssetUrl(backendBaseUrl, model.modelUrl)}?v=${model.modifiedAt || Date.now()}`);
    setStatus(`Loaded existing model ${model.name}.`);
    setIsManagingRobot(false);
  }

  async function convertStep() {
    if (!stepFile) {
      setStatus("Choose a STEP file.");
      return;
    }

    setIsConverting(true);
    setStatus("Converting STEP to GLB...");

    try {
      const formData = new FormData();
      const quality = qualitySettings[qualityPreset];
      formData.append("stepFile", stepFile);
      formData.append("jobName", jobName.trim() || stepFile.name);
      formData.append("preview", String(quality.preview));
      formData.append("qualityPreset", qualityPreset);
      formData.append("skipPattern", skipPattern);
      formData.append("expandPattern", expandPatternInput);
      formData.append("minBboxMm", String(minBboxMm));
      formData.append("linearDeflection", String(quality.linearDeflection));
      formData.append("angularDeflection", String(quality.angularDeflection));

      const response = await fetchWithRetry(apiUrl(backendBaseUrl, "/api/convert-step-upload"), {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as
        | ConversionResponse
        | { message?: string };

      if (!response.ok || !("modelUrl" in payload)) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(message ?? "Conversion failed.");
      }

      setModelUrl(`${backendAssetUrl(backendBaseUrl, payload.modelUrl)}?v=${Date.now()}`);
      setExpandPattern(expandPatternInput);
      setStatus(`Loaded ${payload.parts.length} parts from ${payload.modelUrl}.`);
      setIsManagingRobot(false);
      await loadGeneratedModels();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  }

  async function inspectStep() {
    if (!stepFile) {
      setStatus("Choose a STEP file.");
      return;
    }

    setIsInspecting(true);
    setStatus("Inspecting STEP hierarchy...");
    setTreeText("");

    try {
      const formData = new FormData();
      formData.append("stepFile", stepFile);
      formData.append("jobName", jobName.trim() || stepFile.name);

      const response = await fetchWithRetry(apiUrl(backendBaseUrl, "/api/inspect-step-upload"), {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as InspectResponse | { message?: string };

      if (!response.ok || !("treeText" in payload)) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(message ?? "Inspection failed.");
      }

      setTreeText(payload.treeText);
      setStatus(`Inspected hierarchy at ${payload.treeUrl}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Inspection failed.");
    } finally {
      setIsInspecting(false);
    }
  }

  return (
    <section className="import-panel">
      <header className="subpanel-header">
        <h3>Robot</h3>
      </header>

      <section className="robot-summary">
        <div>
          <strong>{activeRobotName}</strong>
          <span>{availableParts.length > 0 ? `${availableParts.length} selectable parts` : "Loading parts..."}</span>
        </div>
        <button
          className="secondary-action"
          type="button"
          onClick={() => setIsManagingRobot((current) => !current)}
        >
          {isManagingRobot ? "Done" : "Change"}
        </button>
      </section>

      {isManagingRobot ? (
        <>
          <label>
            <span>STEP file</span>
            <input
              accept=".step,.stp"
              type="file"
              onChange={(event) => {
                setStepFile(event.currentTarget.files?.[0] ?? null);
              }}
            />
          </label>

          <label>
            <span>Job name</span>
            <input
              value={jobName}
              onChange={(event) => setJobName(event.currentTarget.value)}
              placeholder="robot"
            />
          </label>

          <label>
            <span>Import quality</span>
            <select
              value={qualityPreset}
              onChange={(event) => {
                const nextPreset = event.currentTarget.value as QualityPreset;
                setQualityPreset(nextPreset);
                setMinBboxMm(qualitySettings[nextPreset].minBboxMm);
              }}
            >
              {Object.entries(qualitySettings).map(([value, setting]) => (
                <option key={value} value={value}>
                  {setting.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Skip names containing</span>
            <input
              value={skipPattern}
              onChange={(event) => setSkipPattern(event.currentTarget.value)}
              placeholder="screw,bolt,nut,washer"
            />
          </label>

          <label>
            <span>Expand names containing</span>
            <input
              value={expandPatternInput}
              onChange={(event) => setExpandPatternInput(event.currentTarget.value)}
              placeholder="chassis,drive,5103"
            />
          </label>

          <label>
            <span>Minimum part size mm</span>
            <input
              min="0"
              step="0.5"
              type="number"
              value={minBboxMm}
              onChange={(event) => setMinBboxMm(event.currentTarget.valueAsNumber || 0)}
            />
          </label>

          <button
            className="primary-action"
            disabled={isConverting}
            type="button"
            onClick={convertStep}
          >
            {isConverting ? "Converting..." : "Convert STEP"}
          </button>

          <button
            className="secondary-action"
            disabled={isInspecting}
            type="button"
            onClick={inspectStep}
          >
            {isInspecting ? "Inspecting..." : "Inspect hierarchy"}
          </button>

          <section className="generated-models">
            <div className="generated-models-header">
              <span>Existing models</span>
              <button
                className="text-action"
                disabled={isLoadingModels}
                type="button"
                onClick={() => {
                  void loadGeneratedModels();
                }}
              >
                {isLoadingModels ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {generatedModels.length > 0 ? (
              <div className="generated-model-list">
                {generatedModels.map((model) => {
                  const isActive =
                    normalizedModelPath(model.modelUrl) === normalizedModelPath(modelUrl);

                  return (
                    <button
                      className={isActive ? "generated-model-item active" : "generated-model-item"}
                      key={model.modelUrl}
                      type="button"
                      onClick={() => loadGeneratedModel(model)}
                    >
                      <span>{model.name}</span>
                      <small>
                        {isActive ? "Current · " : ""}
                        {formatBytes(model.sizeBytes)}
                        {model.modifiedAt ? ` · ${formatDate(model.modifiedAt)}` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="empty-generated-models">
                {isLoadingModels ? "Loading generated models..." : "No generated models found."}
              </p>
            )}
          </section>

          <div className="model-url">{modelUrl}</div>
        </>
      ) : null}
      {status ? <p className="import-status">{status}</p> : null}
      {isManagingRobot && treeText ? <pre className="tree-preview">{treeText}</pre> : null}
    </section>
  );
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(1)} MiB`;
  }

  return `${(mib / 1024).toFixed(1)} GiB`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizedModelPath(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return "";
  }

  try {
    return new URL(trimmedUrl, window.location.origin).pathname;
  } catch {
    return trimmedUrl.split("?")[0].split("#")[0];
  }
}

function modelNameFromUrl(url: string) {
  const path = normalizedModelPath(url);
  const pathParts = path.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] ?? "Robot";
  const baseName = fileName.replace(/\.[^.]+$/, "");

  return baseName
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ") || "Robot";
}
