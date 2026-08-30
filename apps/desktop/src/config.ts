import type { GamepadControl, GamepadMappingConfig, HardwareDevice, TeamCodeFileTemplate } from "./types";

export const FIELD_SIZE_INCHES = 144;
export const ROBOT_SIZE_INCHES = 18;
export const MIN_TERMINAL_HEIGHT = 0;
export const MAX_TERMINAL_HEIGHT = 520;

export const hardwareTypes = ["DcMotor", "Servo", "CRServo"] as const;
export const rootTeamCodeFolder = "(root)";

export const teamCodeFileTemplates: Array<{ id: TeamCodeFileTemplate; label: string }> = [
  { id: "java_class", label: "Java Class" },
  { id: "autonomous", label: "Autonomous" },
  { id: "teleop", label: "TeleOp" },
];

export const gamepadControls: Array<{ id: GamepadControl; label: string }> = [
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

export const bindableInputs = [
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

export const defaultHardwareMap: HardwareDevice[] = [
  { type: "DcMotor", name: "leftFront" },
  { type: "DcMotor", name: "rightFront" },
  { type: "DcMotor", name: "leftBack" },
  { type: "DcMotor", name: "rightBack" },
];

export const defaultGamepadMapping: GamepadMappingConfig = {
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
