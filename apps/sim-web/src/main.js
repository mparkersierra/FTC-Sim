const canvas = document.getElementById("field");
const info = document.getElementById("info");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let robot = {
  x: 0,
  y: 0,
  heading: 0
};

const socket = new WebSocket("ws://localhost:8080");

socket.onopen = () => {
  info.textContent = "Connected";
};

socket.onmessage = (event) => {
  robot = JSON.parse(event.data);
};

socket.onclose = () => {
  info.textContent = "Disconnected";
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawField();
  drawRobot();

  info.textContent =
    `x=${robot.x.toFixed(2)} y=${robot.y.toFixed(2)} heading=${robot.heading.toFixed(1)}`;

  requestAnimationFrame(draw);
}

function drawField() {
  ctx.fillStyle = "#2f6f3e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;

  const size = 40;

  for (let x = 0; x < canvas.width; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += size) {
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

  const robotWidth = 70;
  const robotHeight = 70;

  ctx.save();

  ctx.translate(screenX, screenY);
  ctx.rotate(robot.heading);

  ctx.fillStyle = "#ddd";
  ctx.fillRect(-robotWidth / 2, -robotHeight / 2, robotWidth, robotHeight);

  ctx.fillStyle = "#ff4444";
  ctx.fillRect(-10, -robotHeight / 2, 20, 15);

  ctx.restore();
}

draw();