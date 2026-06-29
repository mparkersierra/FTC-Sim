export type MotorState = Record<string, number>;

export type MotionType = "rotate" | "translate";

export type Axis = "x" | "y" | "z";

export type ModelOrientation = [number, number, number, number];

export interface MotionBehavior {
  id: string;
  partName: string;
  motorName: string;
  type: MotionType;
  axis: Axis;
  speed: number;
  min?: number;
  max?: number;
}

export interface MotionConfig {
  behaviors: MotionBehavior[];
}

export interface MotionDraft {
  motorName: string;
  type: MotionType;
  axis: Axis;
  speed: number;
}
