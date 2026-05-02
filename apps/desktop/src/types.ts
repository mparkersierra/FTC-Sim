export type TabId = "driverStation" | "configuration" | "onbotJava";
export type SimStatus = "stopped" | "initialized" | "running";

export type RobotState = {
  x: number;
  y: number;
  heading: number;
};

export type HardwareDevice = {
  type: string;
  name: string;
};

export type OpMode = {
  id: string;
  name: string;
  modeType: string;
};

export type TelemetryItem = {
  caption: string;
  value: string;
};

export type GamepadNumber = 1 | 2;
export type GamepadControl =
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

export type Binding = {
  gamepadNumber: GamepadNumber;
  control: GamepadControl;
};

export type ActiveBinding = Binding | null;
export type GamepadMappingConfig = Record<GamepadNumber, Partial<Record<GamepadControl, string>>>;
export type TeamCodeFolder = string;

export type TeamCodeContextMenu =
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

export type TeamCodeFileTemplate = "java_class" | "autonomous" | "teleop";
export type TeamCodeOpModeBase = "linear" | "iterative";

export type TeamCodeSelection =
  | {
      kind: "root";
      path: "";
    }
  | {
      kind: "file" | "folder";
      path: string;
    };

export type TeamCodeDialog =
  | {
      kind: "createFile";
      parentFolder: string;
      opModeBase: TeamCodeOpModeBase;
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
