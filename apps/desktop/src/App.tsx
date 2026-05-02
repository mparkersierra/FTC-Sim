import {
  type FormEvent as ReactFormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  MAX_TERMINAL_HEIGHT,
  MIN_TERMINAL_HEIGHT,
  bindableInputs,
  defaultGamepadMapping,
  defaultHardwareMap,
  gamepadControls,
  rootTeamCodeFolder,
} from "./config";
import { Tabs } from "./components/Tabs";
import { useFieldCanvas } from "./hooks/useFieldCanvas";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { DriverStationPage } from "./pages/DriverStationPage";
import { OnBotJavaPage } from "./pages/OnBotJavaPage";
import type {
  ActiveBinding,
  Binding,
  GamepadControl,
  GamepadMappingConfig,
  GamepadNumber,
  HardwareDevice,
  OpMode,
  RobotState,
  SimStatus,
  TabId,
  TeamCodeContextMenu,
  TeamCodeDialog,
  TeamCodeFileTemplate,
  TeamCodeFolder,
  TeamCodeOpModeBase,
  TeamCodeSelection,
  TelemetryItem,
} from "./types";
import "./App.css";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const robotRef = useRef<RobotState>({ x: 0, y: 0, heading: 0 });
  const hardwareMapRef = useRef<HardwareDevice[]>(defaultHardwareMap);
  const simStatusRef = useRef<SimStatus>("stopped");
  const activeTabRef = useRef<TabId>("driverStation");
  const activeBindingRef = useRef<ActiveBinding>(null);
  const mappingRef = useRef<GamepadMappingConfig>(defaultGamepadMapping);
  const pressedBindingsRef = useRef<Map<string, Binding>>(new Map());
  const dragStateRef = useRef({
    draggingRobot: false,
    rotatingRobot: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
  });

  const [activeTab, setActiveTab] = useState<TabId>("driverStation");
  const [statusText, setStatusText] = useState("Disconnected");
  const [infoText, setInfoText] = useState("Connecting...");
  const [simStatus, setSimStatus] = useState<SimStatus>("stopped");
  const [opModes, setOpModes] = useState<OpMode[]>([]);
  const [selectedOpModeId, setSelectedOpModeId] = useState("");
  const [hardwareMapConfig, setHardwareMapConfig] = useState<HardwareDevice[]>(defaultHardwareMap);
  const [gamepadMappingConfig, setGamepadMappingConfig] =
    useState<GamepadMappingConfig>(defaultGamepadMapping);
  const [activeBinding, setActiveBinding] = useState<ActiveBinding>(null);
  const [bindingHint, setBindingHint] = useState("");
  const [robot, setRobot] = useState<RobotState>(robotRef.current);
  const [telemetryItems, setTelemetryItems] = useState<TelemetryItem[]>([]);

  const [teamCodeFiles, setTeamCodeFiles] = useState<string[]>([]);
  const [teamCodeDirectories, setTeamCodeDirectories] = useState<string[]>([]);
  const [openCodeFileTabs, setOpenCodeFileTabs] = useState<string[]>([]);
  const [codeTextByFile, setCodeTextByFile] = useState<Record<string, string>>({});
  const [savedCodeTextByFile, setSavedCodeTextByFile] = useState<Record<string, string>>({});
  const [codeFileName, setCodeFileName] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeStatus, setCodeStatus] = useState("");
  const [runnerLog, setRunnerLog] = useState("");
  const [isLoadingCodeFile, setIsLoadingCodeFile] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(180);
  const [expandedTeamCodeFolders, setExpandedTeamCodeFolders] = useState<Record<TeamCodeFolder, boolean>>({});
  const [teamCodeContextMenu, setTeamCodeContextMenu] = useState<TeamCodeContextMenu | null>(null);
  const [teamCodeDialog, setTeamCodeDialog] = useState<TeamCodeDialog | null>(null);
  const [pendingCloseCodeFileTab, setPendingCloseCodeFileTab] = useState<string | null>(null);
  const [teamCodeSelection, setTeamCodeSelection] = useState<TeamCodeSelection>({ kind: "root", path: "" });

  useEffect(() => {
    robotRef.current = robot;
  }, [robot]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    hardwareMapRef.current = hardwareMapConfig;
  }, [hardwareMapConfig]);

  useEffect(() => {
    simStatusRef.current = simStatus;
  }, [simStatus]);

  useEffect(() => {
    activeBindingRef.current = activeBinding;
  }, [activeBinding]);

  useEffect(() => {
    mappingRef.current = gamepadMappingConfig;
  }, [gamepadMappingConfig]);

  const send = useCallback((message: unknown) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const requestOpModes = useCallback(() => {
    send({ type: "getOpModes" });
  }, [send]);

  const loadTeamCodeFiles = useCallback(async () => {
    try {
      const [files, directories] = await Promise.all([
        invoke<string[]>("list_teamcode_files"),
        invoke<string[]>("list_teamcode_directories"),
      ]);
      setTeamCodeFiles(files);
      setTeamCodeDirectories(directories);
    } catch (error) {
      setCodeStatus(String(error));
    }
  }, []);

  const loadRunnerLog = useCallback(async () => {
    try {
      const log = await invoke<string>("read_runner_log");
      setRunnerLog(log);
    } catch (error) {
      setRunnerLog(String(error));
    }
  }, []);

  const openCodeFile = async (fileName: string) => {
    try {
      setIsLoadingCodeFile(true);
      setCodeStatus(`Opening ${fileName}...`);
      setTeamCodeSelection({ kind: "file", path: fileName });
      const cachedContents = codeTextByFile[fileName];
      const contents =
        cachedContents ??
        (await invoke<string>("read_teamcode_file", {
          relativePath: fileName,
        }));

      setOpenCodeFileTabs((current) => (current.includes(fileName) ? current : [...current, fileName]));
      setCodeTextByFile((current) => ({ ...current, [fileName]: contents }));
      setSavedCodeTextByFile((current) =>
        cachedContents === undefined ? { ...current, [fileName]: contents } : current,
      );
      setCodeFileName(fileName);
      setCodeText(contents);
      setCodeStatus("");
    } catch (error) {
      setCodeStatus(String(error));
    } finally {
      setIsLoadingCodeFile(false);
    }
  };

  const closeCodeFileTab = async (fileName: string) => {
    const tabIndex = openCodeFileTabs.indexOf(fileName);
    if (tabIndex === -1) return;

    const tabText = codeTextByFile[fileName] ?? "";
    const savedTabText = savedCodeTextByFile[fileName] ?? "";
    if (tabText !== savedTabText) {
      setPendingCloseCodeFileTab(fileName);
      return;
    }

    closeCodeFileTabWithoutPrompt(fileName);
  };

  const closeCodeFileTabWithoutPrompt = async (fileName: string) => {
    const tabIndex = openCodeFileTabs.indexOf(fileName);
    if (tabIndex === -1) return;

    const nextTabs = openCodeFileTabs.filter((tab) => tab !== fileName);
    setOpenCodeFileTabs(nextTabs);
    setCodeTextByFile((current) => {
      const next = { ...current };
      delete next[fileName];
      return next;
    });
    setSavedCodeTextByFile((current) => {
      const next = { ...current };
      delete next[fileName];
      return next;
    });

    if (codeFileName !== fileName) return;

    const nextActiveFile = nextTabs[Math.max(0, tabIndex - 1)] ?? nextTabs[0] ?? "";
    if (!nextActiveFile) {
      setCodeFileName("");
      setCodeText("");
      setTeamCodeSelection({ kind: "root", path: "" });
      return;
    }

    await openCodeFile(nextActiveFile);
  };

  const saveAndClosePendingCodeFileTab = async () => {
    if (!pendingCloseCodeFileTab) return;

    const fileName = pendingCloseCodeFileTab;
    const saved = await saveCodeFileOnly(fileName);
    if (!saved) return;

    setPendingCloseCodeFileTab(null);
    closeCodeFileTabWithoutPrompt(fileName);
  };

  const refreshOpenCodeFileAfterPathChange = async (previousPath: string, nextPath: string) => {
    setOpenCodeFileTabs((current) => current.map((tab) => (tab === previousPath ? nextPath : tab)));

    const contents = await invoke<string>("read_teamcode_file", {
      relativePath: nextPath,
    });
    setCodeTextByFile((current) => {
      const next = { ...current, [nextPath]: contents };
      delete next[previousPath];
      return next;
    });
    setSavedCodeTextByFile((current) => {
      const next = { ...current, [nextPath]: contents };
      delete next[previousPath];
      return next;
    });

    if (codeFileName === previousPath) {
      setCodeFileName(nextPath);
      setCodeText(contents);
    }
  };

  const refreshOpenCodeFileAfterFolderPathChange = async (previousFolder: string, nextFolder: string) => {
    const movedOpenTabs = openCodeFileTabs.filter((tab) => tab.startsWith(`${previousFolder}/`));
    setOpenCodeFileTabs((current) =>
      current.map((tab) => (tab.startsWith(`${previousFolder}/`) ? tab.replace(previousFolder, nextFolder) : tab)),
    );

    const refreshedBuffers = await Promise.all(
      movedOpenTabs.map(async (previousPath) => {
        const nextPath = previousPath.replace(previousFolder, nextFolder);
        const contents = await invoke<string>("read_teamcode_file", {
          relativePath: nextPath,
        });
        return { contents, nextPath, previousPath };
      }),
    );

    setCodeTextByFile((current) => {
      const next = { ...current };
      for (const buffer of refreshedBuffers) {
        delete next[buffer.previousPath];
        next[buffer.nextPath] = buffer.contents;
      }
      return next;
    });
    setSavedCodeTextByFile((current) => {
      const next = { ...current };
      for (const buffer of refreshedBuffers) {
        delete next[buffer.previousPath];
        next[buffer.nextPath] = buffer.contents;
      }
      return next;
    });

    const activeBuffer = refreshedBuffers.find((buffer) => buffer.previousPath === codeFileName);
    if (activeBuffer) {
      setCodeFileName(activeBuffer.nextPath);
      setCodeText(activeBuffer.contents);
    }
  };

  useEffect(() => {
    loadTeamCodeFiles();
    loadRunnerLog();
  }, [loadRunnerLog, loadTeamCodeFiles]);

  const saveCodeFileOnly = async (fileName = codeFileName) => {
    if (!fileName) {
      setCodeStatus("Select a Java file before saving");
      return false;
    }

    const contents = fileName === codeFileName ? codeText : (codeTextByFile[fileName] ?? "");

    try {
      setCodeStatus(`Saving ${fileName}...`);
      await invoke<string>("save_teamcode_file", {
        relativePath: fileName,
        contents,
      });
      setCodeTextByFile((current) => ({ ...current, [fileName]: contents }));
      setSavedCodeTextByFile((current) => ({ ...current, [fileName]: contents }));
      setCodeStatus("Saved");
      return true;
    } catch (error) {
      setCodeStatus(String(error));
      return false;
    }
  };

  const saveCodeFile = async () => {
    if (!codeFileName) {
      setCodeStatus("Select a Java file before saving");
      return;
    }

    try {
      setCodeStatus("Saving and compiling...");
      await invoke<string>("save_teamcode_file", {
        relativePath: codeFileName,
        contents: codeText,
      });
      setCodeTextByFile((current) => ({ ...current, [codeFileName]: codeText }));
      setSavedCodeTextByFile((current) => ({ ...current, [codeFileName]: codeText }));

      setCodeStatus("Saved. Restarting sim runner to compile TeamCode...");
      send({ type: "shutdown" });
      const result = await invoke<string>("restart_sim_runner");

      setCodeStatus(`${result}. Reconnecting...`);
      setStatusText("Restarting sim runner");
      setInfoText("Restarting sim runner");
      loadTeamCodeFiles();
      window.setTimeout(() => {
        loadRunnerLog();
      }, 1200);
    } catch (error) {
      setCodeStatus(String(error));
      loadRunnerLog();
    }
  };

  const parentFolderForFile = (fileName: string) => {
    if (!fileName.includes("/")) return "";
    return fileName.slice(0, fileName.lastIndexOf("/"));
  };

  const basenameForPath = (path: string) => {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? path : path.slice(separatorIndex + 1);
  };

  const javaStemForPath = (path: string) => basenameForPath(path).replace(/\.java$/i, "");

  const selectedCreationFolder = () => {
    if (teamCodeSelection.kind === "folder") return teamCodeSelection.path;
    if (teamCodeSelection.kind === "file") return parentFolderForFile(teamCodeSelection.path);
    return "";
  };

  const normalizeTeamCodeFilePath = (value: string) => {
    const trimmed = value.trim().split("\\").join("/").replace(/^\/+|\/+$/g, "");
    if (!trimmed) return "";
    return trimmed.endsWith(".java") ? trimmed : `${trimmed}.java`;
  };

  const normalizeTeamCodeFolderPath = (value: string) => value.trim().split("\\").join("/").replace(/^\/+|\/+$/g, "");

  const normalizeTeamCodeName = (value: string) => value.trim().replace(/^\/+|\/+$/g, "");

  const teamCodePathInFolder = (parentFolder: string, name: string) =>
    parentFolder ? `${parentFolder}/${name}` : name;

  const createCodeFile = async () => {
    setTeamCodeDialog({
      kind: "createFile",
      opModeBase: "linear",
      parentFolder: selectedCreationFolder(),
      template: "java_class",
      value: "NewClass",
    });
  };

  const createCodeFolder = async () => {
    setTeamCodeDialog({
      kind: "createFolder",
      parentFolder: selectedCreationFolder(),
      value: "NewFolder",
    });
  };

  const openTeamCodeContextMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    menu: Omit<TeamCodeContextMenu, "x" | "y">,
  ) => {
    event.preventDefault();
    setTeamCodeSelection(menu.kind === "file" ? { kind: "file", path: menu.path } : { kind: "folder", path: menu.path });
    setTeamCodeContextMenu({
      ...menu,
      x: event.clientX,
      y: event.clientY,
    } as TeamCodeContextMenu);
  };

  const renameTeamCodeItem = async () => {
    if (!teamCodeContextMenu) return;

    const target = teamCodeContextMenu;
    setTeamCodeContextMenu(null);
    setTeamCodeDialog({
      kind: target.kind === "file" ? "renameFile" : "renameFolder",
      path: target.path,
      value: target.kind === "file" ? javaStemForPath(target.path) : target.path,
    });
  };

  const deleteTeamCodeItem = async () => {
    if (!teamCodeContextMenu) return;

    const target = teamCodeContextMenu;
    setTeamCodeContextMenu(null);
    setTeamCodeDialog({
      kind: target.kind === "file" ? "deleteFile" : "deleteFolder",
      path: target.path,
      value: target.path,
    });
  };

  const createCodeFileFromContextFolder = () => {
    if (!teamCodeContextMenu || teamCodeContextMenu.kind !== "folder") return;

    const folder = teamCodeContextMenu.path;
    setTeamCodeContextMenu(null);
    setTeamCodeSelection({ kind: "folder", path: folder });
    setTeamCodeDialog({ kind: "createFile", opModeBase: "linear", parentFolder: folder, template: "java_class", value: "NewClass" });
  };

  const createCodeFolderFromContextFolder = () => {
    if (!teamCodeContextMenu || teamCodeContextMenu.kind !== "folder") return;

    const folder = teamCodeContextMenu.path;
    setTeamCodeContextMenu(null);
    setTeamCodeSelection({ kind: "folder", path: folder });
    setTeamCodeDialog({ kind: "createFolder", parentFolder: folder, value: "NewFolder" });
  };

  const submitTeamCodeDialog = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teamCodeDialog) return;

    const dialog = teamCodeDialog;
    try {
      if (dialog.kind === "createFile") {
        const fileName = normalizeTeamCodeName(dialog.value);
        if (!fileName) {
          setCodeStatus("Enter a Java file path");
          return;
        }
        if (fileName.includes("/") || fileName.includes("\\")) {
          setCodeStatus("Enter only a file name. The folder is already selected.");
          return;
        }

        const relativePath = normalizeTeamCodeFilePath(teamCodePathInFolder(dialog.parentFolder, fileName));
        setCodeStatus(`Creating ${relativePath}...`);
        const contents = await invoke<string>("create_teamcode_file", {
          opModeBase: dialog.opModeBase,
          relativePath,
          template: dialog.template,
        });
        setCodeFileName(relativePath);
        setCodeText(contents);
        setOpenCodeFileTabs((current) => (current.includes(relativePath) ? current : [...current, relativePath]));
        setCodeTextByFile((current) => ({ ...current, [relativePath]: contents }));
        setSavedCodeTextByFile((current) => ({ ...current, [relativePath]: contents }));
        setTeamCodeSelection({ kind: "file", path: relativePath });
        setExpandedTeamCodeFolders((current) => {
          const folder = relativePath.includes("/")
            ? relativePath.slice(0, relativePath.lastIndexOf("/"))
            : rootTeamCodeFolder;
          return { ...current, [folder]: true };
        });
      }

      if (dialog.kind === "createFolder") {
        const folderName = normalizeTeamCodeName(dialog.value);
        if (!folderName) {
          setCodeStatus("Enter a folder path");
          return;
        }
        if (folderName.includes("/") || folderName.includes("\\")) {
          setCodeStatus("Enter only a folder name. The parent folder is already selected.");
          return;
        }

        const relativePath = normalizeTeamCodeFolderPath(teamCodePathInFolder(dialog.parentFolder, folderName));
        setCodeStatus(`Creating ${relativePath}...`);
        await invoke<string>("create_teamcode_folder", { relativePath });
        setTeamCodeSelection({ kind: "folder", path: relativePath });
        setExpandedTeamCodeFolders((current) => ({ ...current, [relativePath]: true }));
      }

      if (dialog.kind === "renameFile" || dialog.kind === "renameFolder") {
        const nextPath =
          dialog.kind === "renameFile"
            ? normalizeTeamCodeFilePath(teamCodePathInFolder(parentFolderForFile(dialog.path), normalizeTeamCodeName(dialog.value)))
            : normalizeTeamCodeFolderPath(dialog.value);
        if (!nextPath) {
          setCodeStatus(dialog.kind === "renameFile" ? "Enter a Java file path" : "Enter a folder path");
          return;
        }

        setCodeStatus(`Renaming ${dialog.path}...`);
        if (dialog.kind === "renameFile") {
          await invoke<string>("rename_teamcode_file", {
            fromPath: dialog.path,
            toPath: nextPath,
          });
          await refreshOpenCodeFileAfterPathChange(dialog.path, nextPath);
          if (teamCodeSelection.kind === "file" && teamCodeSelection.path === dialog.path) {
            setTeamCodeSelection({ kind: "file", path: nextPath });
          }
        } else {
          await invoke<string>("rename_teamcode_folder", {
            fromPath: dialog.path,
            toPath: nextPath,
          });
          await refreshOpenCodeFileAfterFolderPathChange(dialog.path, nextPath);
          if (teamCodeSelection.kind === "folder" && teamCodeSelection.path === dialog.path) {
            setTeamCodeSelection({ kind: "folder", path: nextPath });
          }
          if (teamCodeSelection.kind === "file" && teamCodeSelection.path.startsWith(`${dialog.path}/`)) {
            setTeamCodeSelection({ kind: "file", path: teamCodeSelection.path.replace(dialog.path, nextPath) });
          }
          setExpandedTeamCodeFolders((current) => {
            const next = { ...current };
            next[nextPath] = next[dialog.path] ?? true;
            delete next[dialog.path];
            return next;
          });
        }
      }

      if (dialog.kind === "deleteFile" || dialog.kind === "deleteFolder") {
        setCodeStatus(`Deleting ${dialog.path}...`);
        if (dialog.kind === "deleteFile") {
          await invoke<string>("delete_teamcode_file", { relativePath: dialog.path });
          setOpenCodeFileTabs((current) => current.filter((tab) => tab !== dialog.path));
          setCodeTextByFile((current) => {
            const next = { ...current };
            delete next[dialog.path];
            return next;
          });
          setSavedCodeTextByFile((current) => {
            const next = { ...current };
            delete next[dialog.path];
            return next;
          });
          if (codeFileName === dialog.path) {
            setCodeFileName("");
            setCodeText("");
          }
          if (teamCodeSelection.kind === "file" && teamCodeSelection.path === dialog.path) {
            setTeamCodeSelection({ kind: "root", path: "" });
          }
        } else {
          await invoke<string>("delete_teamcode_folder", { relativePath: dialog.path });
          setOpenCodeFileTabs((current) => current.filter((tab) => !tab.startsWith(`${dialog.path}/`)));
          setCodeTextByFile((current) => {
            const next = { ...current };
            for (const path of Object.keys(next)) {
              if (path.startsWith(`${dialog.path}/`)) {
                delete next[path];
              }
            }
            return next;
          });
          setSavedCodeTextByFile((current) => {
            const next = { ...current };
            for (const path of Object.keys(next)) {
              if (path.startsWith(`${dialog.path}/`)) {
                delete next[path];
              }
            }
            return next;
          });
          if (codeFileName === dialog.path || codeFileName.startsWith(`${dialog.path}/`)) {
            setCodeFileName("");
            setCodeText("");
          }
          if (teamCodeSelection.path === dialog.path || teamCodeSelection.path.startsWith(`${dialog.path}/`)) {
            setTeamCodeSelection({ kind: "root", path: "" });
          }
          setExpandedTeamCodeFolders((current) => {
            const next = { ...current };
            delete next[dialog.path];
            return next;
          });
        }
      }

      setTeamCodeDialog(null);
      await loadTeamCodeFiles();
      setCodeStatus("");
    } catch (error) {
      setCodeStatus(String(error));
    }
  };

  const moveTeamCodeItem = async (item: { kind: "file" | "folder"; path: string }, targetFolder: string) => {
    const targetPath = normalizeTeamCodeFolderPath(targetFolder);
    const sourceParent = parentFolderForFile(item.path);
    if (sourceParent === targetPath) return;

    const nextPath =
      item.kind === "file"
        ? normalizeTeamCodeFilePath(teamCodePathInFolder(targetPath, basenameForPath(item.path)))
        : normalizeTeamCodeFolderPath(teamCodePathInFolder(targetPath, basenameForPath(item.path)));

    if (nextPath === item.path) return;
    if (item.kind === "folder" && (targetPath === item.path || targetPath.startsWith(`${item.path}/`))) {
      setCodeStatus("Cannot move a folder inside itself.");
      return;
    }

    try {
      setCodeStatus(`Moving ${item.path}...`);
      if (item.kind === "file") {
        await invoke<string>("rename_teamcode_file", {
          fromPath: item.path,
          toPath: nextPath,
        });
        await refreshOpenCodeFileAfterPathChange(item.path, nextPath);
        setTeamCodeSelection({ kind: "file", path: nextPath });
      } else {
        await invoke<string>("rename_teamcode_folder", {
          fromPath: item.path,
          toPath: nextPath,
        });
        await refreshOpenCodeFileAfterFolderPathChange(item.path, nextPath);
        if (teamCodeSelection.kind === "file" && teamCodeSelection.path.startsWith(`${item.path}/`)) {
          setTeamCodeSelection({ kind: "file", path: teamCodeSelection.path.replace(item.path, nextPath) });
        } else if (teamCodeSelection.kind === "folder" && teamCodeSelection.path.startsWith(`${item.path}/`)) {
          setTeamCodeSelection({ kind: "folder", path: teamCodeSelection.path.replace(item.path, nextPath) });
        } else {
          setTeamCodeSelection({ kind: "folder", path: nextPath });
        }
        setExpandedTeamCodeFolders((current) => {
          const next = { ...current };
          next[nextPath] = next[item.path] ?? true;
          delete next[item.path];
          return next;
        });
      }

      if (targetPath) {
        setExpandedTeamCodeFolders((current) => ({ ...current, [targetPath]: true }));
      }
      await loadTeamCodeFiles();
      setCodeStatus("");
    } catch (error) {
      setCodeStatus(String(error));
    }
  };

  const updateTeamCodeDialogValue = (value: string) => {
    setTeamCodeDialog((current) => (current ? { ...current, value } : current));
  };

  const updateCodeText = (value: string) => {
    setCodeText(value);
    if (codeFileName) {
      setCodeTextByFile((current) => ({ ...current, [codeFileName]: value }));
    }
  };

  const updateTeamCodeDialogTemplate = (template: TeamCodeFileTemplate) => {
    setTeamCodeDialog((current) => (current?.kind === "createFile" ? { ...current, template } : current));
  };

  const updateTeamCodeDialogOpModeBase = (opModeBase: TeamCodeOpModeBase) => {
    setTeamCodeDialog((current) => (current?.kind === "createFile" ? { ...current, opModeBase } : current));
  };

  const saveHardwareMap = useCallback(() => {
    const cleaned = hardwareMapRef.current
      .map((item) => ({
        type: item.type,
        name: item.name.trim(),
      }))
      .filter((item) => item.name.length > 0);

    send({
      type: "setHardwareMap",
      devices: cleaned,
    });

    setStatusText("Hardware map saved");
  }, [send]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | undefined;

    const connect = (delayMs = 0) => {
      window.clearTimeout(reconnectTimer);

      reconnectTimer = window.setTimeout(() => {
        if (disposed) return;

        const socket = new WebSocket("ws://localhost:8080");
        socketRef.current = socket;

        socket.onopen = () => {
          setStatusText("Connected");
          setInfoText("Connected");
          setCodeStatus((current) => (current.endsWith("Reconnecting...") ? "Hot reload complete" : current));
          requestOpModes();
          loadRunnerLog();
          saveHardwareMap();
        };

        socket.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "opModes") {
            setOpModes(msg.items);
            setSelectedOpModeId((current) => current || msg.items[0]?.id || "");
            if (msg.items.length === 0) {
              setCodeStatus("No OpModes found. Check Runner Output for compile errors.");
              loadRunnerLog();
            }
          }

          if (msg.type === "robotState") {
            const nextRobot = {
              x: Number(msg.x),
              y: Number(msg.y),
              heading: Number(msg.heading),
            };
            robotRef.current = nextRobot;
            setRobot(nextRobot);
          }

          if (msg.type === "opModeStopped") {
            setSimStatus("stopped");
            setStatusText("Stopped");
            setTelemetryItems([]);
          }

          if (msg.type === "telemetry") {
            const items = Array.isArray(msg.items) ? msg.items : [];
            setTelemetryItems(
              items.map((item: { caption?: unknown; value?: unknown }) => ({
                caption: String(item.caption ?? ""),
                value: String(item.value ?? ""),
              })),
            );
          }
        };

        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }

          if (!disposed) {
            setStatusText("Disconnected. Reconnecting...");
            setInfoText("Disconnected. Reconnecting...");
            connect(750);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      }, delayMs);
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [loadRunnerLog, requestOpModes, saveHardwareMap]);

  useEffect(() => {
    saveHardwareMap();
  }, [saveHardwareMap]);

  useEffect(() => {
    const closeContextMenu = () => setTeamCodeContextMenu(null);
    const closeContextMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", closeContextMenuOnEscape);

    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", closeContextMenuOnEscape);
    };
  }, []);

  const mainActionButtonText = useMemo(() => {
    if (simStatus === "initialized") return "START";
    if (simStatus === "running") return "STOP";
    return "INIT";
  }, [simStatus]);

  const teamCodeFilesByFolder = useMemo(() => {
    const groups: Record<TeamCodeFolder, string[]> = {};

    for (const directory of teamCodeDirectories) {
      groups[directory] = groups[directory] ?? [];
    }

    for (const fileName of teamCodeFiles) {
      const separatorIndex = fileName.lastIndexOf("/");
      const folder = separatorIndex === -1 ? rootTeamCodeFolder : fileName.slice(0, separatorIndex);
      groups[folder] = [...(groups[folder] ?? []), fileName];
    }

    return groups;
  }, [teamCodeDirectories, teamCodeFiles]);

  const teamCodeFolders = useMemo(
    () =>
      Object.keys(teamCodeFilesByFolder)
        .filter((folder) => folder !== rootTeamCodeFolder)
        .sort((a, b) => a.localeCompare(b)),
    [teamCodeFilesByFolder],
  );

  const rootTeamCodeFiles = teamCodeFilesByFolder[rootTeamCodeFolder] ?? [];

  const selectedTargetLabel = teamCodeSelection.kind === "root" ? "TeamCode" : teamCodeSelection.path;

  const toggleTeamCodeFolder = (folder: TeamCodeFolder) => {
    setTeamCodeSelection({ kind: "folder", path: folder });
    setExpandedTeamCodeFolders((current) => ({
      ...current,
      [folder]: !current[folder],
    }));
  };

  const startTerminalResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = terminalHeight;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + startY - moveEvent.clientY;
      setTerminalHeight(Math.max(MIN_TERMINAL_HEIGHT, Math.min(MAX_TERMINAL_HEIGHT, nextHeight)));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const initOpMode = () => {
    saveHardwareMap();

    send({
      type: "init",
      id: selectedOpModeId,
    });

    setTelemetryItems([]);
    const selected = opModes.find((item) => item.id === selectedOpModeId);
    setSimStatus("initialized");
    setStatusText(`Initialized: ${selected ? `${selected.modeType} - ${selected.name}` : selectedOpModeId}`);
  };

  const startOpMode = () => {
    send({ type: "start" });
    setSimStatus("running");
    setStatusText("Started");
    setActiveTab("driverStation");
  };

  const stopOpMode = () => {
    send({ type: "stop" });
    setSimStatus("stopped");
    setStatusText("Stopped");
    setTelemetryItems([]);
  };

  const mainAction = () => {
    if (simStatus === "stopped") initOpMode();
    if (simStatus === "initialized") startOpMode();
    if (simStatus === "running") stopOpMode();
  };

  const addHardwareRow = () => {
    setHardwareMapConfig((items) => [...items, { type: "DcMotor", name: "" }]);
  };

  const updateHardwareRow = (index: number, updates: Partial<HardwareDevice>) => {
    setHardwareMapConfig((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)),
    );
  };

  const removeHardwareRow = (index: number) => {
    setHardwareMapConfig((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const inputLabel = (code?: string) => {
    if (!code) return "Unassigned";
    const input = bindableInputs.find((item) => item.code === code);
    return input ? input.label : code.toUpperCase();
  };

  const assignBinding = useCallback((code: string) => {
    const binding = activeBindingRef.current;
    if (!binding) return;

    setGamepadMappingConfig((current) => {
      const next: GamepadMappingConfig = {
        1: { ...current[1] },
        2: { ...current[2] },
      };

      if (code) {
        ([1, 2] as GamepadNumber[]).forEach((gamepadNumber) => {
          gamepadControls.forEach((control) => {
            if (next[gamepadNumber][control.id] === code) {
              delete next[gamepadNumber][control.id];
            }
          });
        });

        next[binding.gamepadNumber][binding.control] = code;
        setBindingHint(`${inputLabel(code)} assigned`);
      } else {
        delete next[binding.gamepadNumber][binding.control];
        setBindingHint("Mapping cleared");
      }

      mappingRef.current = next;
      return next;
    });

    setActiveBinding(null);
    activeBindingRef.current = null;
  }, []);

  const bindingsForKey = useCallback((key: string) => {
    const bindings: Binding[] = [];
    const mapping = mappingRef.current;

    ([1, 2] as GamepadNumber[]).forEach((gamepadNumber) => {
      Object.entries(mapping[gamepadNumber]).forEach(([control, mappedKey]) => {
        if (mappedKey === key) {
          bindings.push({ gamepadNumber, control: control as GamepadControl });
        }
      });
    });

    return bindings;
  }, []);

  const bindingId = (binding: Binding) => `${binding.gamepadNumber}:${binding.control}`;

  const sendBinding = useCallback(
    (binding: Binding, pressed: boolean) => {
      send({
        type: "gamepad",
        gamepad: binding.gamepadNumber,
        control: binding.control,
        pressed,
      });
    },
    [send],
  );

  const releasePressedBindings = useCallback(() => {
    pressedBindingsRef.current.forEach((binding) => {
      sendBinding(binding, false);
    });
    pressedBindingsRef.current.clear();
  }, [sendBinding]);

  useEffect(() => {
    if (activeTab !== "driverStation") {
      releasePressedBindings();
    }
  }, [activeTab, releasePressedBindings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (activeBindingRef.current) {
        event.preventDefault();
        assignBinding(key);
        return;
      }

      if (activeTabRef.current !== "driverStation") return;

      const bindings = bindingsForKey(key);
      if (bindings.length === 0) return;

      event.preventDefault();
      bindings.forEach((binding) => {
        const id = bindingId(binding);

        if (!pressedBindingsRef.current.has(id)) {
          pressedBindingsRef.current.set(id, binding);
          sendBinding(binding, true);
        }
      });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (activeTabRef.current !== "driverStation") return;

      const bindings = bindingsForKey(key);
      if (bindings.length === 0) return;

      event.preventDefault();
      bindings.forEach((binding) => {
        const id = bindingId(binding);

        if (pressedBindingsRef.current.has(id)) {
          pressedBindingsRef.current.delete(id);
          sendBinding(binding, false);
        }
      });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [assignBinding, bindingsForKey, sendBinding]);

  const sendPose = useCallback(
    (nextRobot: RobotState) => {
      send({
        type: "setPose",
        x: nextRobot.x,
        y: nextRobot.y,
        heading: nextRobot.heading,
      });
    },
    [send],
  );

  useFieldCanvas({
    activeTabRef,
    canvasRef,
    dragStateRef,
    robotRef,
    setRobot,
    simStatusRef,
    sendPose,
  });

  const isDeleteTeamCodeDialog =
    teamCodeDialog?.kind === "deleteFile" || teamCodeDialog?.kind === "deleteFolder";
  const teamCodeDialogTitle = teamCodeDialog
    ? {
        createFile: "New File",
        createFolder: "New Folder",
        renameFile: "Rename File",
        renameFolder: "Rename Folder",
        deleteFile: "Delete File",
        deleteFolder: "Delete Folder",
      }[teamCodeDialog.kind]
    : "";
  const teamCodeDialogSubmitLabel = isDeleteTeamCodeDialog ? "Delete" : "OK";

  return (
    <>
      <Tabs activeTab={activeTab} onChange={setActiveTab} />

      <DriverStationPage
        activeTab={activeTab}
        canvasRef={canvasRef}
        infoText={infoText}
        mainActionButtonText={mainActionButtonText}
        opModes={opModes}
        selectedOpModeId={selectedOpModeId}
        statusText={statusText}
        telemetryItems={telemetryItems}
        onMainAction={mainAction}
        onRequestOpModes={requestOpModes}
        onSelectOpMode={setSelectedOpModeId}
      />

      <ConfigurationPage
        activeBinding={activeBinding}
        activeTab={activeTab}
        bindingHint={bindingHint}
        gamepadMappingConfig={gamepadMappingConfig}
        hardwareMapConfig={hardwareMapConfig}
        inputLabel={inputLabel}
        onAddHardwareRow={addHardwareRow}
        onAssignBinding={assignBinding}
        onRemoveHardwareRow={removeHardwareRow}
        onSaveHardwareMap={saveHardwareMap}
        onSelectBinding={(binding, label) => {
          activeBindingRef.current = binding;
          setActiveBinding(binding);
          setBindingHint(`Choose input for Gamepad ${binding.gamepadNumber} ${label}`);
        }}
        onUpdateHardwareRow={updateHardwareRow}
      />

      <OnBotJavaPage
        activeTab={activeTab}
        codeFileName={codeFileName}
        codeStatus={codeStatus}
        codeText={codeText}
        openCodeFileTabs={openCodeFileTabs}
        pendingCloseCodeFileTab={pendingCloseCodeFileTab}
        expandedTeamCodeFolders={expandedTeamCodeFolders}
        isLoadingCodeFile={isLoadingCodeFile}
        rootTeamCodeFiles={rootTeamCodeFiles}
        runnerLog={runnerLog}
        selectedTargetLabel={selectedTargetLabel}
        teamCodeContextMenu={teamCodeContextMenu}
        teamCodeDialog={teamCodeDialog}
        teamCodeDialogSubmitLabel={teamCodeDialogSubmitLabel}
        teamCodeDialogTitle={teamCodeDialogTitle}
        teamCodeFilesByFolder={teamCodeFilesByFolder}
        teamCodeFolders={teamCodeFolders}
        teamCodeSelection={teamCodeSelection}
        terminalHeight={terminalHeight}
        onCreateCodeFile={createCodeFile}
        onCreateCodeFileFromContextFolder={createCodeFileFromContextFolder}
        onCreateCodeFolder={createCodeFolder}
        onCreateCodeFolderFromContextFolder={createCodeFolderFromContextFolder}
        onCancelCloseCodeFileTab={() => setPendingCloseCodeFileTab(null)}
        onConfirmSaveAndCloseCodeFileTab={() => {
          void saveAndClosePendingCodeFileTab();
        }}
        onDeleteTeamCodeItem={deleteTeamCodeItem}
        onDismissDialog={() => setTeamCodeDialog(null)}
        onLoadRunnerLog={loadRunnerLog}
        onLoadTeamCodeFiles={loadTeamCodeFiles}
        onMoveTeamCodeItem={moveTeamCodeItem}
        onCloseCodeFileTab={closeCodeFileTab}
        onOpenCodeFile={openCodeFile}
        onOpenTeamCodeContextMenu={openTeamCodeContextMenu}
        onRenameTeamCodeItem={renameTeamCodeItem}
        onSaveCodeFile={saveCodeFile}
        onSaveCodeFileOnly={() => {
          void saveCodeFileOnly();
        }}
        onSetCodeText={updateCodeText}
        onStartTerminalResize={startTerminalResize}
        onSubmitTeamCodeDialog={submitTeamCodeDialog}
        onToggleTeamCodeFolder={toggleTeamCodeFolder}
        onUpdateTeamCodeDialogOpModeBase={updateTeamCodeDialogOpModeBase}
        onUpdateTeamCodeDialogTemplate={updateTeamCodeDialogTemplate}
        onUpdateTeamCodeDialogValue={updateTeamCodeDialogValue}
      />
    </>
  );
}

export default App;
