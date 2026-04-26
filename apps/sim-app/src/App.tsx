import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type TabId = "driverStation" | "configuration" | "field";
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

const FIELD_SCALE = 100;
const ROBOT_HALF_SIZE = 35;
const ROTATION_HANDLE_LENGTH = 70;
const ROTATION_HANDLE_RADIUS = 9;
const TOP_BAR_HEIGHT = 42;

const hardwareTypes = ["DcMotor"];

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

  useEffect(() => {
    robotRef.current = robot;
  }, [robot]);

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
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    socket.onopen = () => {
      setStatusText("Connected");
      setInfoText("Connected");
      requestOpModes();
      saveHardwareMap();
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "opModes") {
        setOpModes(msg.items);
        setSelectedOpModeId((current) => current || msg.items[0]?.id || "");
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
      setStatusText("Disconnected");
      setInfoText("Disconnected");
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [requestOpModes, saveHardwareMap]);

  useEffect(() => {
    saveHardwareMap();
  }, [saveHardwareMap]);

  const mainActionButtonText = useMemo(() => {
    if (simStatus === "initialized") return "START";
    if (simStatus === "running") return "STOP";
    return "INIT";
  }, [simStatus]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (activeBindingRef.current) {
        event.preventDefault();
        assignBinding(key);
        return;
      }

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

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - TOP_BAR_HEIGHT;
    };

    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frameId = 0;

    const robotScreenPosition = () => ({
      x: canvas.width / 2 + robotRef.current.x * FIELD_SCALE,
      y: canvas.height / 2 - robotRef.current.y * FIELD_SCALE,
    });

    const rotationHandlePosition = () => {
      const pos = robotScreenPosition();
      const distance = ROBOT_HALF_SIZE + ROTATION_HANDLE_LENGTH;

      return {
        x: pos.x - Math.sin(robotRef.current.heading) * distance,
        y: pos.y - Math.cos(robotRef.current.heading) * distance,
      };
    };

    const robotFrontPosition = () => {
      const pos = robotScreenPosition();

      return {
        x: pos.x - Math.sin(robotRef.current.heading) * ROBOT_HALF_SIZE,
        y: pos.y - Math.cos(robotRef.current.heading) * ROBOT_HALF_SIZE,
      };
    };

    const drawField = () => {
      ctx.fillStyle = "#2f6f3e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;

      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const drawRotationHandle = () => {
      const handle = rotationHandlePosition();
      const front = robotFrontPosition();

      ctx.save();
      ctx.strokeStyle = "#f7d84a";
      ctx.fillStyle = "#f7d84a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.lineTo(handle.x, handle.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(handle.x, handle.y, ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawRobot = () => {
      const screenX = canvas.width / 2 + robotRef.current.x * FIELD_SCALE;
      const screenY = canvas.height / 2 - robotRef.current.y * FIELD_SCALE;

      if (simStatusRef.current === "stopped") {
        drawRotationHandle();
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(-robotRef.current.heading);

      ctx.fillStyle = "#ddd";
      ctx.fillRect(-ROBOT_HALF_SIZE, -ROBOT_HALF_SIZE, ROBOT_HALF_SIZE * 2, ROBOT_HALF_SIZE * 2);

      ctx.fillStyle = "#ff4444";
      ctx.fillRect(-10, -ROBOT_HALF_SIZE, 20, 15);

      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawField();
      drawRobot();

      setInfoText(
        `x=${robotRef.current.x.toFixed(2)} y=${robotRef.current.y.toFixed(2)} heading=${(
          (robotRef.current.heading * 180) /
          Math.PI
        ).toFixed(1)}`,
      );

      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const robotScreenPosition = () => ({
      x: canvas.width / 2 + robotRef.current.x * FIELD_SCALE,
      y: canvas.height / 2 - robotRef.current.y * FIELD_SCALE,
    });

    const screenToWorld = (screenX: number, screenY: number) => ({
      x: (screenX - canvas.width / 2) / FIELD_SCALE,
      y: -(screenY - canvas.height / 2) / FIELD_SCALE,
    });

    const isMouseOnRobot = (mouseX: number, mouseY: number) => {
      const pos = robotScreenPosition();
      return Math.abs(mouseX - pos.x) < 45 && Math.abs(mouseY - pos.y) < 45;
    };

    const rotationHandlePosition = () => {
      const pos = robotScreenPosition();
      const distance = ROBOT_HALF_SIZE + ROTATION_HANDLE_LENGTH;

      return {
        x: pos.x - Math.sin(robotRef.current.heading) * distance,
        y: pos.y - Math.cos(robotRef.current.heading) * distance,
      };
    };

    const isMouseOnRotationHandle = (mouseX: number, mouseY: number) => {
      const handle = rotationHandlePosition();
      return Math.hypot(mouseX - handle.x, mouseY - handle.y) <= ROTATION_HANDLE_RADIUS + 6;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (simStatusRef.current !== "stopped") return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      if (isMouseOnRotationHandle(mouseX, mouseY) || (event.shiftKey && isMouseOnRobot(mouseX, mouseY))) {
        dragStateRef.current.rotatingRobot = true;
      } else if (isMouseOnRobot(mouseX, mouseY)) {
        const pos = robotScreenPosition();
        dragStateRef.current.draggingRobot = true;
        dragStateRef.current.dragOffsetX = mouseX - pos.x;
        dragStateRef.current.dragOffsetY = mouseY - pos.y;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      if (simStatusRef.current !== "stopped") {
        canvas.style.cursor = "";
        return;
      }

      if (dragStateRef.current.draggingRobot) {
        const world = screenToWorld(
          mouseX - dragStateRef.current.dragOffsetX,
          mouseY - dragStateRef.current.dragOffsetY,
        );
        const nextRobot = { ...robotRef.current, x: world.x, y: world.y };
        robotRef.current = nextRobot;
        setRobot(nextRobot);
        sendPose(nextRobot);
      }

      if (dragStateRef.current.rotatingRobot) {
        const pos = robotScreenPosition();
        const angle = Math.atan2(mouseY - pos.y, mouseX - pos.x);
        const nextRobot = { ...robotRef.current, heading: -(angle + Math.PI / 2) };
        robotRef.current = nextRobot;
        setRobot(nextRobot);
        sendPose(nextRobot);
      }

      if (dragStateRef.current.draggingRobot || dragStateRef.current.rotatingRobot) {
        canvas.style.cursor = "";
      } else if (isMouseOnRotationHandle(mouseX, mouseY)) {
        canvas.style.cursor = "grab";
      } else if (isMouseOnRobot(mouseX, mouseY)) {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "";
      }
    };

    const onMouseLeave = () => {
      canvas.style.cursor = "";
    };

    const onMouseUp = () => {
      dragStateRef.current.draggingRobot = false;
      dragStateRef.current.rotatingRobot = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [sendPose]);

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
        <p>
          Add hardware names so code like <code>hardwareMap.get(DcMotor.class, "leftFront")</code> works.
        </p>

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
        <p>Click a mapping space, then click a control button below or press a key.</p>
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

      <section className={`tab field-tab ${activeTab === "field" ? "active" : ""}`}>
        <div className="info">{infoText}</div>
        <canvas ref={canvasRef} />
      </section>
    </>
  );
}

export default App;
