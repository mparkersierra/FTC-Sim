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
import Editor from "@monaco-editor/react";
import "./App.css";

type TabId = "driverStation" | "configuration" | "onbotJava" | "field";
type SimStatus = "stopped" | "initialized" | "running";

type RobotState = {
  x: number;
  y: number;
  heading: number;
};

type HardwareDevice = {
  type: string;
  name: string;
};

type OpMode = {
  id: string;
  name: string;
  modeType: string;
};

type GamepadNumber = 1 | 2;
type GamepadControl =
  | "left_stick_up"
  | "left_stick_down"
  | "left_stick_left"
  | "left_stick_right"
  | "right_stick_up"
  | "right_stick_down"
  | "right_stick_left"
  | "right_stick_right"
  | "dpad_up"
  | "dpad_down"
  | "dpad_left"
  | "dpad_right"
  | "a"
  | "b"
  | "x"
  | "y"
  | "left_bumper"
  | "right_bumper"
  | "left_trigger"
  | "right_trigger";

type Binding = {
  gamepadNumber: GamepadNumber;
  control: GamepadControl;
};

type ActiveBinding = Binding | null;
type GamepadMappingConfig = Record<GamepadNumber, Partial<Record<GamepadControl, string>>>;
type TeamCodeFolder = string;
type TeamCodeContextMenu =
  | {
      kind: "file";
      path: string;
      x: number;
      y: number;
    }
  | {
      kind: "folder";
      path: string;
      x: number;
      y: number;
    };
type TeamCodeFileTemplate = "java_class" | "autonomous" | "teleop";
type TeamCodeSelection =
  | {
      kind: "root";
      path: "";
    }
  | {
      kind: "file" | "folder";
      path: string;
    };
type TeamCodeDialog =
  | {
      kind: "createFile";
      parentFolder: string;
      template: TeamCodeFileTemplate;
      value: string;
    }
  | {
      kind: "createFolder";
      parentFolder: string;
      value: string;
    }
  | {
      kind: "renameFile" | "renameFolder" | "deleteFile" | "deleteFolder";
      path: string;
      value: string;
    };

const FIELD_SCALE = 100;
const ROBOT_HALF_SIZE = 35;
const ROTATION_HANDLE_LENGTH = 70;
const ROTATION_HANDLE_RADIUS = 9;
const TOP_BAR_HEIGHT = 42;
const MIN_TERMINAL_HEIGHT = 0;
const MAX_TERMINAL_HEIGHT = 520;

const hardwareTypes = ["DcMotor"];
const rootTeamCodeFolder = "(root)";
const teamCodeFileTemplates: Array<{ id: TeamCodeFileTemplate; label: string }> = [
  { id: "java_class", label: "Java Class" },
  { id: "autonomous", label: "Autonomous" },
  { id: "teleop", label: "TeleOp" },
];

const gamepadControls: Array<{ id: GamepadControl; label: string }> = [
  { id: "left_stick_up", label: "Left Stick Up" },
  { id: "left_stick_down", label: "Left Stick Down" },
  { id: "left_stick_left", label: "Left Stick Left" },
  { id: "left_stick_right", label: "Left Stick Right" },
  { id: "right_stick_up", label: "Right Stick Up" },
  { id: "right_stick_down", label: "Right Stick Down" },
  { id: "right_stick_left", label: "Right Stick Left" },
  { id: "right_stick_right", label: "Right Stick Right" },
  { id: "dpad_up", label: "D-Pad Up" },
  { id: "dpad_down", label: "D-Pad Down" },
  { id: "dpad_left", label: "D-Pad Left" },
  { id: "dpad_right", label: "D-Pad Right" },
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "x", label: "X" },
  { id: "y", label: "Y" },
  { id: "left_bumper", label: "Left Bumper" },
  { id: "right_bumper", label: "Right Bumper" },
  { id: "left_trigger", label: "Left Trigger" },
  { id: "right_trigger", label: "Right Trigger" },
];

const bindableInputs = [
  { code: "w", label: "W" },
  { code: "a", label: "A" },
  { code: "s", label: "S" },
  { code: "d", label: "D" },
  { code: "arrowup", label: "Up" },
  { code: "arrowdown", label: "Down" },
  { code: "arrowleft", label: "Left" },
  { code: "arrowright", label: "Right" },
  { code: " ", label: "Space" },
  { code: "q", label: "Q" },
  { code: "e", label: "E" },
  { code: "r", label: "R" },
  { code: "f", label: "F" },
  { code: "z", label: "Z" },
  { code: "x", label: "X" },
  { code: "c", label: "C" },
  { code: "v", label: "V" },
  { code: "1", label: "1" },
  { code: "2", label: "2" },
  { code: "3", label: "3" },
  { code: "4", label: "4" },
];

const defaultHardwareMap: HardwareDevice[] = [
  { type: "DcMotor", name: "leftFront" },
  { type: "DcMotor", name: "rightFront" },
  { type: "DcMotor", name: "leftBack" },
  { type: "DcMotor", name: "rightBack" },
];

const defaultGamepadMapping: GamepadMappingConfig = {
  1: {
    left_stick_up: "w",
    left_stick_down: "s",
    left_stick_left: "a",
    left_stick_right: "d",
    right_stick_up: "arrowup",
    right_stick_down: "arrowdown",
    right_stick_left: "arrowleft",
    right_stick_right: "arrowright",
    a: " ",
    b: "e",
    x: "q",
    y: "r",
    left_bumper: "z",
    right_bumper: "c",
  },
  2: {},
};

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

  const [teamCodeFiles, setTeamCodeFiles] = useState<string[]>([]);
  const [teamCodeDirectories, setTeamCodeDirectories] = useState<string[]>([]);
  const [codeFileName, setCodeFileName] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeStatus, setCodeStatus] = useState("");
  const [runnerLog, setRunnerLog] = useState("");
  const [isLoadingCodeFile, setIsLoadingCodeFile] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(180);
  const [expandedTeamCodeFolders, setExpandedTeamCodeFolders] = useState<Record<TeamCodeFolder, boolean>>({});
  const [teamCodeContextMenu, setTeamCodeContextMenu] = useState<TeamCodeContextMenu | null>(null);
  const [teamCodeDialog, setTeamCodeDialog] = useState<TeamCodeDialog | null>(null);
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
      const contents = await invoke<string>("read_teamcode_file", {
        relativePath: fileName,
      });

      setCodeFileName(fileName);
      setCodeText(contents);
      setCodeStatus("");
    } catch (error) {
      setCodeStatus(String(error));
    } finally {
      setIsLoadingCodeFile(false);
    }
  };

  useEffect(() => {
    loadTeamCodeFiles();
    loadRunnerLog();
  }, [loadRunnerLog, loadTeamCodeFiles]);

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
      parentFolder: selectedCreationFolder(),
      template: "java_class",
      value: "NewClass.java",
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
      value: target.path,
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
    setTeamCodeDialog({ kind: "createFile", parentFolder: folder, template: "java_class", value: "NewClass.java" });
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
          relativePath,
          template: dialog.template,
        });
        setCodeFileName(relativePath);
        setCodeText(contents);
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
            ? normalizeTeamCodeFilePath(dialog.value)
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
          if (codeFileName === dialog.path) {
            setCodeFileName(nextPath);
          }
          if (teamCodeSelection.kind === "file" && teamCodeSelection.path === dialog.path) {
            setTeamCodeSelection({ kind: "file", path: nextPath });
          }
        } else {
          await invoke<string>("rename_teamcode_folder", {
            fromPath: dialog.path,
            toPath: nextPath,
          });
          if (codeFileName === dialog.path || codeFileName.startsWith(`${dialog.path}/`)) {
            setCodeFileName(codeFileName.replace(dialog.path, nextPath));
          }
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
          if (codeFileName === dialog.path) {
            setCodeFileName("");
            setCodeText("");
          }
          if (teamCodeSelection.kind === "file" && teamCodeSelection.path === dialog.path) {
            setTeamCodeSelection({ kind: "root", path: "" });
          }
        } else {
          await invoke<string>("delete_teamcode_folder", { relativePath: dialog.path });
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

  const updateTeamCodeDialogValue = (value: string) => {
    setTeamCodeDialog((current) => (current ? { ...current, value } : current));
  };

  const updateTeamCodeDialogTemplate = (template: TeamCodeFileTemplate) => {
    setTeamCodeDialog((current) => (current?.kind === "createFile" ? { ...current, template } : current));
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

    const selected = opModes.find((item) => item.id === selectedOpModeId);
    setSimStatus("initialized");
    setStatusText(`Initialized: ${selected ? `${selected.modeType} - ${selected.name}` : selectedOpModeId}`);
  };

  const startOpMode = () => {
    send({ type: "start" });
    setSimStatus("running");
    setStatusText("Started");
    setActiveTab("field");
  };

  const stopOpMode = () => {
    send({ type: "stop" });
    setSimStatus("stopped");
    setStatusText("Stopped");
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
    if (activeTab !== "field") {
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

      if (activeTabRef.current !== "field") return;

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
      if (activeTabRef.current !== "field") return;

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const getCanvasPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const robotScreenPosition = (state: RobotState) => ({
      x: canvas.width / 2 + state.x * FIELD_SCALE,
      y: canvas.height / 2 - state.y * FIELD_SCALE,
    });

    const rotationHandlePosition = (state: RobotState) => {
      const position = robotScreenPosition(state);
      return {
        x: position.x - Math.sin(state.heading) * ROTATION_HANDLE_LENGTH,
        y: position.y - Math.cos(state.heading) * ROTATION_HANDLE_LENGTH,
      };
    };

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#2f6f3e";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.strokeStyle = "rgba(255, 255, 255, 0.18)";
      context.lineWidth = 1;
      for (let x = canvas.width / 2 % FIELD_SCALE; x < canvas.width; x += FIELD_SCALE) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      for (let y = canvas.height / 2 % FIELD_SCALE; y < canvas.height; y += FIELD_SCALE) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }

      const state = robotRef.current;
      const position = robotScreenPosition(state);
      const handle = rotationHandlePosition(state);

      context.save();
      context.translate(position.x, position.y);
      context.rotate(-state.heading);
      context.fillStyle = "#d7dce2";
      context.strokeStyle = "#111";
      context.lineWidth = 3;
      context.fillRect(-ROBOT_HALF_SIZE, -ROBOT_HALF_SIZE, ROBOT_HALF_SIZE * 2, ROBOT_HALF_SIZE * 2);
      context.strokeRect(-ROBOT_HALF_SIZE, -ROBOT_HALF_SIZE, ROBOT_HALF_SIZE * 2, ROBOT_HALF_SIZE * 2);
      context.fillStyle = "#e64b3c";
      context.fillRect(-10, -ROBOT_HALF_SIZE, 20, 15);
      context.restore();

      context.strokeStyle = "#f7d84a";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(position.x, position.y);
      context.lineTo(handle.x, handle.y);
      context.stroke();

      context.fillStyle = "#f7d84a";
      context.beginPath();
      context.arc(handle.x, handle.y, ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
      context.fill();
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - TOP_BAR_HEIGHT;
      draw();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (activeTabRef.current !== "field" || simStatusRef.current !== "stopped") return;

      const point = getCanvasPoint(event);
      const state = robotRef.current;
      const position = robotScreenPosition(state);
      const handle = rotationHandlePosition(state);
      const handleDistance = Math.hypot(point.x - handle.x, point.y - handle.y);
      const robotDistanceX = Math.abs(point.x - position.x);
      const robotDistanceY = Math.abs(point.y - position.y);

      if (handleDistance <= ROTATION_HANDLE_RADIUS + 8) {
        dragStateRef.current.rotatingRobot = true;
        canvas.setPointerCapture(event.pointerId);
        return;
      }

      if (robotDistanceX <= ROBOT_HALF_SIZE && robotDistanceY <= ROBOT_HALF_SIZE) {
        dragStateRef.current.draggingRobot = true;
        dragStateRef.current.dragOffsetX = point.x - position.x;
        dragStateRef.current.dragOffsetY = point.y - position.y;
        canvas.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activeTabRef.current !== "field" || simStatusRef.current !== "stopped") {
        dragStateRef.current.draggingRobot = false;
        dragStateRef.current.rotatingRobot = false;
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState.draggingRobot && !dragState.rotatingRobot) return;

      const point = getCanvasPoint(event);
      const current = robotRef.current;
      let nextRobot = current;

      if (dragState.draggingRobot) {
        nextRobot = {
          ...current,
          x: (point.x - dragState.dragOffsetX - canvas.width / 2) / FIELD_SCALE,
          y: (canvas.height / 2 - (point.y - dragState.dragOffsetY)) / FIELD_SCALE,
        };
      }

      if (dragState.rotatingRobot) {
        const position = robotScreenPosition(current);
        nextRobot = {
          ...current,
          heading: Math.atan2(position.x - point.x, position.y - point.y),
        };
      }

      robotRef.current = nextRobot;
      setRobot(nextRobot);
      sendPose(nextRobot);
      draw();
    };

    const onPointerUp = (event: PointerEvent) => {
      dragStateRef.current.draggingRobot = false;
      dragStateRef.current.rotatingRobot = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    let frameId = 0;
    const renderLoop = () => {
      draw();
      frameId = window.requestAnimationFrame(renderLoop);
    };

    resize();
    renderLoop();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.cancelAnimationFrame(frameId);
    };
  }, [sendPose]);

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
      <nav className="tabs">
        <button
          className={activeTab === "driverStation" ? "active" : ""}
          onClick={() => setActiveTab("driverStation")}
          type="button"
        >
          Driver Station
        </button>

        <button
          className={activeTab === "configuration" ? "active" : ""}
          onClick={() => setActiveTab("configuration")}
          type="button"
        >
          Configuration
        </button>

        <button
          className={activeTab === "onbotJava" ? "active" : ""}
          onClick={() => setActiveTab("onbotJava")}
          type="button"
        >
          OnBot Java
        </button>

        <button className={activeTab === "field" ? "active" : ""} onClick={() => setActiveTab("field")} type="button">
          Field
        </button>
      </nav>

      <section className={`tab app-panel ${activeTab === "driverStation" ? "active" : ""}`}>
        <h1>Driver Station</h1>

        <button onClick={requestOpModes} type="button">
          Scan OpModes
        </button>

        <p>Select program:</p>
        <select value={selectedOpModeId} onChange={(event) => setSelectedOpModeId(event.target.value)}>
          {opModes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.modeType} - {item.name}
            </option>
          ))}
        </select>

        <div className="driver-actions">
          <button onClick={mainAction} type="button">
            {mainActionButtonText}
          </button>
        </div>

        <p>{statusText}</p>
      </section>

      <section className={`tab app-panel ${activeTab === "configuration" ? "active" : ""}`}>
        <h1>Configuration</h1>

        <h2>Hardware Map</h2>

        <div className="config-actions">
          <button onClick={addHardwareRow} type="button">
            + Add Component
          </button>
          <button onClick={saveHardwareMap} type="button">
            Save Hardware Map
          </button>
        </div>

        <div>
          {hardwareMapConfig.map((item, index) => (
            <div className="hardware-row" key={`${index}-${item.name}`}>
              <select value={item.type} onChange={(event) => updateHardwareRow(index, { type: event.target.value })}>
                {hardwareTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <input
                onChange={(event) => updateHardwareRow(index, { name: event.target.value })}
                placeholder="hardware name"
                value={item.name}
              />

              <button onClick={() => removeHardwareRow(index)} type="button">
                Remove
              </button>
            </div>
          ))}
        </div>

        <h2>Gamepad Mapping</h2>
        <p className="binding-hint">{bindingHint}</p>

        <div className="input-palette">
          {bindableInputs.map((input) => (
            <button key={input.code} onClick={() => assignBinding(input.code)} type="button">
              {input.label}
            </button>
          ))}
          <button onClick={() => assignBinding("")} type="button">
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
                    onClick={() => {
                      const nextBinding = { gamepadNumber, control: control.id };
                      activeBindingRef.current = nextBinding;
                      setActiveBinding(nextBinding);
                      setBindingHint(`Choose input for Gamepad ${gamepadNumber} ${control.label}`);
                    }}
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

      <section className={`tab app-panel onbot-panel ${activeTab === "onbotJava" ? "active" : ""}`}>
        <div className="ide-shell">
          <aside className="file-browser">
            <div className="file-browser-title">
              <div>
                <span>TeamCode</span>
                <span className="file-browser-target">Target: {selectedTargetLabel}</span>
              </div>
              <div className="file-browser-actions" aria-label="TeamCode file commands">
                <button onClick={createCodeFile} title="New File" type="button">
                  +
                </button>
                <button onClick={createCodeFolder} title="New Folder" type="button">
                  +/
                </button>
              </div>
            </div>

            {rootTeamCodeFiles.map((fileName) => (
              <button
                className={`file-item ${teamCodeSelection.kind === "file" && teamCodeSelection.path === fileName ? "selected" : ""}`}
                disabled={isLoadingCodeFile}
                key={fileName}
                onClick={() => openCodeFile(fileName)}
                onContextMenu={(event) => openTeamCodeContextMenu(event, { kind: "file", path: fileName })}
                type="button"
              >
                {fileName}
              </button>
            ))}

            {teamCodeFolders.map((folder) => (
              <div className="file-group" key={folder}>
                <button
                  className="file-group-title"
                  onClick={() => toggleTeamCodeFolder(folder)}
                  onContextMenu={(event) => openTeamCodeContextMenu(event, { kind: "folder", path: folder })}
                  data-selected={teamCodeSelection.kind === "folder" && teamCodeSelection.path === folder}
                  type="button"
                >
                  <span>{expandedTeamCodeFolders[folder] ?? true ? "v" : ">"}</span>
                  <span>{folder}</span>
                </button>

                {(expandedTeamCodeFolders[folder] ?? true) &&
                  teamCodeFilesByFolder[folder].map((fileName) => (
                    <button
                      className={`file-item nested ${teamCodeSelection.kind === "file" && teamCodeSelection.path === fileName ? "selected" : ""}`}
                      disabled={isLoadingCodeFile}
                      key={fileName}
                      onClick={() => openCodeFile(fileName)}
                      onContextMenu={(event) => openTeamCodeContextMenu(event, { kind: "file", path: fileName })}
                      type="button"
                    >
                      {folder === rootTeamCodeFolder ? fileName : fileName.slice(folder.length + 1)}
                    </button>
                  ))}
              </div>
            ))}
          </aside>

          <div className="editor-pane">
            <div className="editor-titlebar">
              <span>{codeFileName || "No file selected"}</span>
            </div>

            <div className="monaco-shell">
            <Editor
              height="100%"
              language="java"
              onChange={(value) => setCodeText(value ?? "")}
              options={{
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
              }}
              path={codeFileName || "blank.java"}
              theme="vs-dark"
              value={codeText}
            />
            </div>

            <div
              className="terminal-resize-handle"
              onPointerDown={startTerminalResize}
              role="separator"
              tabIndex={0}
            />

            <section className="runner-output" style={{ height: terminalHeight }}>
              <div className="runner-output-title">
                <span>Terminal</span>
                <span>{codeStatus}</span>
              </div>
              <pre>{runnerLog || "Runner output will appear here."}</pre>
            </section>
          </div>

          <div className="ide-action-dock" style={{ bottom: terminalHeight + 18 }}>
            <div className="ide-action-secondary">
              <button onClick={loadRunnerLog} title="Refresh Runner Output" type="button">
                !
              </button>
              <button onClick={loadTeamCodeFiles} title="Refresh Files" type="button">
                R
              </button>
            </div>

            <button
              className="ide-save-button"
              disabled={!codeFileName || isLoadingCodeFile}
              onClick={saveCodeFile}
              title="Save"
              type="button"
            >
              <span className="save-icon" aria-hidden="true" />
            </button>
          </div>

          {teamCodeContextMenu && (
            <div
              className="teamcode-context-menu"
              onClick={(event) => event.stopPropagation()}
              style={{ left: teamCodeContextMenu.x, top: teamCodeContextMenu.y }}
            >
              {teamCodeContextMenu.kind === "folder" && (
                <>
                  <button onClick={createCodeFileFromContextFolder} type="button">
                    New File
                  </button>
                  <button onClick={createCodeFolderFromContextFolder} type="button">
                    New Folder
                  </button>
                </>
              )}
              <button onClick={renameTeamCodeItem} type="button">
                Rename
              </button>
              <button onClick={deleteTeamCodeItem} type="button">
                Delete
              </button>
            </div>
          )}

          {teamCodeDialog && (
            <div className="teamcode-dialog-backdrop" onMouseDown={() => setTeamCodeDialog(null)}>
              <form
                className="teamcode-dialog"
                onMouseDown={(event) => event.stopPropagation()}
                onSubmit={submitTeamCodeDialog}
              >
                <h2>{teamCodeDialogTitle}</h2>

                {isDeleteTeamCodeDialog ? (
                  <p>
                    {teamCodeDialog.kind === "deleteFolder"
                      ? `Delete folder ${teamCodeDialog.path} and everything inside it?`
                      : `Delete ${teamCodeDialog.path}?`}
                  </p>
                ) : (
                  <>
                    {(teamCodeDialog.kind === "createFile" || teamCodeDialog.kind === "createFolder") &&
                    teamCodeDialog.parentFolder ? (
                      <div className="teamcode-path-input">
                        <span>{teamCodeDialog.parentFolder}/</span>
                        <input
                          autoFocus
                          onChange={(event) => updateTeamCodeDialogValue(event.target.value)}
                          value={teamCodeDialog.value}
                        />
                      </div>
                    ) : (
                      <input
                        autoFocus
                        onChange={(event) => updateTeamCodeDialogValue(event.target.value)}
                        value={teamCodeDialog.value}
                      />
                    )}

                    {teamCodeDialog.kind === "createFile" && (
                      <div className="teamcode-template-options">
                        <label htmlFor="teamcode-file-template">Template</label>
                        <select
                          id="teamcode-file-template"
                          onChange={(event) => updateTeamCodeDialogTemplate(event.target.value as TeamCodeFileTemplate)}
                          value={teamCodeDialog.template}
                        >
                          {teamCodeFileTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="teamcode-dialog-actions">
                  <button onClick={() => setTeamCodeDialog(null)} type="button">
                    Cancel
                  </button>
                  <button type="submit">{teamCodeDialogSubmitLabel}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      <section className={`tab field-tab ${activeTab === "field" ? "active" : ""}`}>
        <div className="info">{infoText}</div>
        <canvas ref={canvasRef} />
      </section>
    </>
  );
}

export default App;
