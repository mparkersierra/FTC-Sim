export type MotorState = Record<string, number>;

export type MotionType = "rotate" | "translate";

export type Axis = "x" | "y" | "z";

export type ModelOrientation = [number, number, number, number];
export type CadMotorType = "DcMotor" | "Servo" | "CRServo";

export interface MotionBehavior {
  id: string;
  partName: string;
  motorName: string;
  motorType: CadMotorType;
  type: MotionType;
  axis: Axis;
  positiveDirectionSign: 1 | -1;
  speed: number;
  maxPower: number;
  min?: number;
  max?: number;
}

export interface MotionConfig {
  behaviors: MotionBehavior[];
}

export interface CadMotorDevice {
  motorName: string;
  motorType: CadMotorType;
  partNames: string[];
}

export interface MotionDraft {
  motorName: string;
  motorType: CadMotorType;
  type: MotionType;
  axis: Axis;
  positiveDirectionSign: 1 | -1;
  speed: number;
  maxPower: number;
}
