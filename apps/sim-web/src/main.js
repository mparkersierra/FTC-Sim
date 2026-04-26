const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const statusEl = document.getElementById("status");
const opModeSelect = document.getElementById("opModeSelect");
const mainActionButton = document.getElementById("mainActionButton");
const hardwareRows = document.getElementById("hardwareRows");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 42;

let robot = { x: 0, y: 0, heading: 0 };
let socket;

let simStatus = "stopped";

let draggingRobot = false;
let rotatingRobot = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const FIELD_SCALE = 100;
const ROBOT_HALF_SIZE = 35;
const ROTATION_HANDLE_LENGTH = 70;
const ROTATION_HANDLE_RADIUS = 9;

const hardwareTypes = ["DcMotor"];

let hardwareMapConfig = [
  { type: "DcMotor", name: "leftFront" },
  { type: "DcMotor", name: "rightFront" },
  { type: "DcMotor", name: "leftBack" },
  { type: "DcMotor", name: "rightBack" }
];

function showTab(id) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function connect() {
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    statusEl.textContent = "Connected";
    info.textContent = "Connected";
    requestOpModes();
    saveHardwareMap();
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "opModes") {
      renderOpModes(msg.items);
    }

    if (msg.type === "robotState") {
      robot = msg;
    }

    if (msg.type === "opModeStopped") {
      setStopped();
    }
  };

  socket.onclose = () => {
    statusEl.textContent = "Disconnected";
    info.textContent = "Disconnected";
  };
}

function updateMainButton() {
  if (simStatus === "stopped") {
    mainActionButton.textContent = "INIT";
  } else if (simStatus === "initialized") {
    mainActionButton.textContent = "START";
  } else if (simStatus === "running") {
    mainActionButton.textContent = "STOP";
  }
}

function mainAction() {
  if (simStatus === "stopped") {
    initOpMode();
  } else if (simStatus === "initialized") {
    startOpMode();
  } else if (simStatus === "running") {
    stopOpMode();
  }
}

function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function requestOpModes() {
  send({ type: "getOpModes" });
}

function renderOpModes(items) {
  opModeSelect.innerHTML = "";

  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.modeType} - ${item.name}`;
    opModeSelect.appendChild(option);
  });
}

function initOpMode() {
  saveHardwareMap();

  send({
    type: "init",
    id: opModeSelect.value
  });

  simStatus = "initialized";
  statusEl.textContent = "Initialized: " + opModeSelect.options[opModeSelect.selectedIndex].textContent;
  updateMainButton();
}

function startOpMode() {
  send({ type: "start" });

  simStatus = "running";
  statusEl.textContent = "Started";
  updateMainButton();
  showTab("fieldTab");
}

function stopOpMode() {
  send({ type: "stop" });
  setStopped();
}

function setStopped() {
  simStatus = "stopped";
  statusEl.textContent = "Stopped";
  updateMainButton();
}

function renderHardwareRows() {
  hardwareRows.innerHTML = "";

  hardwareMapConfig.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "hardware-row";

    const typeSelect = document.createElement("select");

    hardwareTypes.forEach(type => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      option.selected = item.type === type;
      typeSelect.appendChild(option);
    });

    typeSelect.onchange = () => {
      hardwareMapConfig[index].type = typeSelect.value;
    };

    const nameInput = document.createElement("input");
    nameInput.placeholder = "hardware name";
    nameInput.value = item.name;

    nameInput.oninput = () => {
      hardwareMapConfig[index].name = nameInput.value;
    };

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Remove";

    deleteButton.onclick = () => {
      hardwareMapConfig.splice(index, 1);
      renderHardwareRows();
    };

    row.appendChild(typeSelect);
    row.appendChild(nameInput);
    row.appendChild(deleteButton);

    hardwareRows.appendChild(row);
  });
}

function addHardwareRow() {
  hardwareMapConfig.push({
    type: "DcMotor",
    name: ""
  });

  renderHardwareRows();
}

function saveHardwareMap() {
  const cleaned = hardwareMapConfig
    .map(item => ({
      type: item.type,
      name: item.name.trim()
    }))
    .filter(item => item.name.length > 0);

  send({
    type: "setHardwareMap",
    devices: cleaned
  });

  statusEl.textContent = "Hardware map saved";
}

const allowedKeys = [
  "w", "a", "s", "d", " ",
  "arrowup", "arrowdown", "arrowleft", "arrowright"
];

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (allowedKeys.includes(key)) {
    event.preventDefault();
    send({ type: "key", key, pressed: true });
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (allowedKeys.includes(key)) {
    event.preventDefault();
    send({ type: "key", key, pressed: false });
  }
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawField();
  drawRobot();

  info.textContent =
    `x=${robot.x.toFixed(2)} y=${robot.y.toFixed(2)} heading=${(robot.heading * 180 / Math.PI).toFixed(1)}`;

  requestAnimationFrame(draw);
}

function drawField() {
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
}

function drawRobot() {
  const screenX = canvas.width / 2 + robot.x * FIELD_SCALE;
  const screenY = canvas.height / 2 - robot.y * FIELD_SCALE;

  if (simStatus === "stopped") {
    drawRotationHandle(screenX, screenY);
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(-robot.heading);

  ctx.fillStyle = "#ddd";
  ctx.fillRect(-ROBOT_HALF_SIZE, -ROBOT_HALF_SIZE, ROBOT_HALF_SIZE * 2, ROBOT_HALF_SIZE * 2);

  ctx.fillStyle = "#ff4444";
  ctx.fillRect(-10, -ROBOT_HALF_SIZE, 20, 15);

  ctx.restore();
}

function drawRotationHandle(screenX, screenY) {
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
}

function robotScreenPosition() {
  return {
    x: canvas.width / 2 + robot.x * FIELD_SCALE,
    y: canvas.height / 2 - robot.y * FIELD_SCALE
  };
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - canvas.width / 2) / FIELD_SCALE,
    y: -(screenY - canvas.height / 2) / FIELD_SCALE
  };
}

function isMouseOnRobot(mouseX, mouseY) {
  const pos = robotScreenPosition();
  return Math.abs(mouseX - pos.x) < 45 && Math.abs(mouseY - pos.y) < 45;
}

function rotationHandlePosition() {
  const pos = robotScreenPosition();
  const distance = ROBOT_HALF_SIZE + ROTATION_HANDLE_LENGTH;

  return {
    x: pos.x - Math.sin(robot.heading) * distance,
    y: pos.y - Math.cos(robot.heading) * distance
  };
}

function robotFrontPosition() {
  const pos = robotScreenPosition();

  return {
    x: pos.x - Math.sin(robot.heading) * ROBOT_HALF_SIZE,
    y: pos.y - Math.cos(robot.heading) * ROBOT_HALF_SIZE
  };
}

function isMouseOnRotationHandle(mouseX, mouseY) {
  const handle = rotationHandlePosition();
  const dx = mouseX - handle.x;
  const dy = mouseY - handle.y;

  return Math.hypot(dx, dy) <= ROTATION_HANDLE_RADIUS + 6;
}

function sendPose() {
  send({
    type: "setPose",
    x: robot.x,
    y: robot.y,
    heading: robot.heading
  });
}

canvas.addEventListener("mousedown", (event) => {
  if (simStatus !== "stopped") return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (isMouseOnRotationHandle(mouseX, mouseY) || (event.shiftKey && isMouseOnRobot(mouseX, mouseY))) {
    rotatingRobot = true;
  } else if (isMouseOnRobot(mouseX, mouseY)) {
    draggingRobot = true;

    const pos = robotScreenPosition();
    dragOffsetX = mouseX - pos.x;
    dragOffsetY = mouseY - pos.y;
  }
});

canvas.addEventListener("mousemove", (event) => {
  if (simStatus !== "stopped") return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (draggingRobot) {
    const world = screenToWorld(mouseX - dragOffsetX, mouseY - dragOffsetY);
    robot.x = world.x;
    robot.y = world.y;
    sendPose();
  }

  if (rotatingRobot) {
    const pos = robotScreenPosition();
    const angle = Math.atan2(mouseY - pos.y, mouseX - pos.x);
    robot.heading = -(angle + Math.PI / 2);
    sendPose();
  }
});

canvas.addEventListener("mouseleave", () => {
  canvas.style.cursor = "";
});

canvas.addEventListener("mousemove", (event) => {
  if (simStatus !== "stopped" || draggingRobot || rotatingRobot) {
    canvas.style.cursor = "";
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (isMouseOnRotationHandle(mouseX, mouseY)) {
    canvas.style.cursor = "grab";
  } else if (isMouseOnRobot(mouseX, mouseY)) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "";
  }
});

window.addEventListener("mouseup", () => {
  draggingRobot = false;
  rotatingRobot = false;
});

connect();
updateMainButton();
renderHardwareRows();
draw();
