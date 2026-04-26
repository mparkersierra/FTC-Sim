const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const statusEl = document.getElementById("status");
const opModeSelect = document.getElementById("opModeSelect");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 42;

let robot = { x: 0, y: 0, heading: 0 };
let socket;

let simStatus = "stopped"; 

let draggingRobot = false;
let rotatingRobot = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

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

const mainActionButton = document.getElementById("mainActionButton");

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
  const scale = 100;
  const screenX = canvas.width / 2 + robot.x * scale;
  const screenY = canvas.height / 2 - robot.y * scale;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(-robot.heading);

  ctx.fillStyle = "#ddd";
  ctx.fillRect(-35, -35, 70, 70);

  ctx.fillStyle = "#ff4444";
  ctx.fillRect(-10, -35, 20, 15);

  ctx.restore();
}

function robotScreenPosition() {
  const scale = 100;
  return {
    x: canvas.width / 2 + robot.x * scale,
    y: canvas.height / 2 - robot.y * scale
  };
}

function screenToWorld(screenX, screenY) {
  const scale = 100;
  return {
    x: (screenX - canvas.width / 2) / scale,
    y: -(screenY - canvas.height / 2) / scale
  };
}

function isMouseOnRobot(mouseX, mouseY) {
  const pos = robotScreenPosition();
  return Math.abs(mouseX - pos.x) < 45 && Math.abs(mouseY - pos.y) < 45;
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

  if (!isMouseOnRobot(mouseX, mouseY)) return;

  if (event.shiftKey) {
    rotatingRobot = true;
  } else {
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
    robot.heading = angle * 180 / Math.PI + 90;
    sendPose();
  }
});

window.addEventListener("mouseup", () => {
  draggingRobot = false;
  rotatingRobot = false;
});

connect();
updateMainButton();
draw();
