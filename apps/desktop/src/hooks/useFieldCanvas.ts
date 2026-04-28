import { type Dispatch, type RefObject, type SetStateAction, useEffect } from "react";
import {
  FIELD_SCALE,
  ROBOT_HALF_SIZE,
  ROTATION_HANDLE_LENGTH,
  ROTATION_HANDLE_RADIUS,
} from "../config";
import type { RobotState, SimStatus, TabId } from "../types";

type FieldDragState = {
  draggingRobot: boolean;
  rotatingRobot: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
};

type UseFieldCanvasOptions = {
  activeTabRef: RefObject<TabId>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  dragStateRef: RefObject<FieldDragState>;
  robotRef: RefObject<RobotState>;
  setRobot: Dispatch<SetStateAction<RobotState>>;
  simStatusRef: RefObject<SimStatus>;
  sendPose: (robot: RobotState) => void;
};

export function useFieldCanvas({
  activeTabRef,
  canvasRef,
  dragStateRef,
  robotRef,
  setRobot,
  simStatusRef,
  sendPose,
}: UseFieldCanvasOptions) {
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
      const rect = canvas.getBoundingClientRect();
      const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      canvas.width = size;
      canvas.height = size;
      draw();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (activeTabRef.current !== "driverStation" || simStatusRef.current !== "stopped") return;

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
      if (activeTabRef.current !== "driverStation" || simStatusRef.current !== "stopped") {
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
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.cancelAnimationFrame(frameId);
    };
  }, [activeTabRef, canvasRef, dragStateRef, robotRef, setRobot, simStatusRef, sendPose]);
}
