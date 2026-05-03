export type GeneratedJavaMember = {
  kind: "field" | "method";
  label: string;
  detail: string;
  insertText: string;
};

export type GeneratedJavaType = {
  kind: "annotation" | "class" | "enum" | "interface";
  simpleName: string;
  fullName: string;
  detail: string;
  extendsName?: string;
  members?: GeneratedJavaMember[];
  enumValues?: string[];
};

export const generatedFtcJavaApi: GeneratedJavaType[] = 
[
  {
    "kind": "annotation",
    "simpleName": "Autonomous",
    "fullName": "com.qualcomm.robotcore.eventloop.opmode.Autonomous",
    "detail": "FTC Java annotation Autonomous"
  },
  {
    "kind": "class",
    "simpleName": "LinearOpMode",
    "fullName": "com.qualcomm.robotcore.eventloop.opmode.LinearOpMode",
    "detail": "FTC Java class LinearOpMode",
    "extendsName": "OpMode",
    "members": [
      {
        "kind": "method",
        "label": "runOpMode",
        "detail": "void runOpMode()",
        "insertText": "runOpMode($1)"
      },
      {
        "kind": "method",
        "label": "init",
        "detail": "void init()",
        "insertText": "init($1)"
      },
      {
        "kind": "method",
        "label": "loop",
        "detail": "void loop()",
        "insertText": "loop($1)"
      },
      {
        "kind": "method",
        "label": "waitForStart",
        "detail": "void waitForStart()",
        "insertText": "waitForStart($1)"
      },
      {
        "kind": "method",
        "label": "internalStart",
        "detail": "void internalStart()",
        "insertText": "internalStart($1)"
      },
      {
        "kind": "method",
        "label": "opModeIsActive",
        "detail": "boolean opModeIsActive()",
        "insertText": "opModeIsActive($1)"
      },
      {
        "kind": "method",
        "label": "requestOpModeStop",
        "detail": "void requestOpModeStop()",
        "insertText": "requestOpModeStop($1)"
      },
      {
        "kind": "method",
        "label": "sleep",
        "detail": "void sleep(long milliseconds)",
        "insertText": "sleep($1)"
      }
    ]
  },
  {
    "kind": "class",
    "simpleName": "OpMode",
    "fullName": "com.qualcomm.robotcore.eventloop.opmode.OpMode",
    "detail": "FTC Java class OpMode",
    "members": [
      {
        "kind": "field",
        "label": "hardwareMap",
        "detail": "HardwareMap hardwareMap",
        "insertText": "hardwareMap"
      },
      {
        "kind": "field",
        "label": "telemetry",
        "detail": "Telemetry telemetry",
        "insertText": "telemetry"
      },
      {
        "kind": "field",
        "label": "gamepad1",
        "detail": "Gamepad gamepad1",
        "insertText": "gamepad1"
      },
      {
        "kind": "field",
        "label": "gamepad2",
        "detail": "Gamepad gamepad2",
        "insertText": "gamepad2"
      },
      {
        "kind": "field",
        "label": "time",
        "detail": "double time",
        "insertText": "time"
      },
      {
        "kind": "method",
        "label": "init",
        "detail": "void init()",
        "insertText": "init($1)"
      },
      {
        "kind": "method",
        "label": "init_loop",
        "detail": "void init_loop()",
        "insertText": "init_loop($1)"
      },
      {
        "kind": "method",
        "label": "start",
        "detail": "void start()",
        "insertText": "start($1)"
      },
      {
        "kind": "method",
        "label": "loop",
        "detail": "void loop()",
        "insertText": "loop($1)"
      },
      {
        "kind": "method",
        "label": "stop",
        "detail": "void stop()",
        "insertText": "stop($1)"
      },
      {
        "kind": "method",
        "label": "resetStartTime",
        "detail": "void resetStartTime()",
        "insertText": "resetStartTime($1)"
      },
      {
        "kind": "method",
        "label": "getRuntime",
        "detail": "double getRuntime()",
        "insertText": "getRuntime($1)"
      },
      {
        "kind": "method",
        "label": "requestOpModeStop",
        "detail": "void requestOpModeStop()",
        "insertText": "requestOpModeStop($1)"
      },
      {
        "kind": "method",
        "label": "isStarted",
        "detail": "boolean isStarted()",
        "insertText": "isStarted($1)"
      },
      {
        "kind": "method",
        "label": "isStopRequested",
        "detail": "boolean isStopRequested()",
        "insertText": "isStopRequested($1)"
      },
      {
        "kind": "method",
        "label": "idle",
        "detail": "void idle()",
        "insertText": "idle($1)"
      },
      {
        "kind": "method",
        "label": "internalStart",
        "detail": "void internalStart()",
        "insertText": "internalStart($1)"
      }
    ]
  },
  {
    "kind": "class",
    "simpleName": "OpModeStopRequestedException",
    "fullName": "com.qualcomm.robotcore.eventloop.opmode.OpModeStopRequestedException",
    "detail": "FTC Java class OpModeStopRequestedException",
    "extendsName": "RuntimeException"
  },
  {
    "kind": "annotation",
    "simpleName": "TeleOp",
    "fullName": "com.qualcomm.robotcore.eventloop.opmode.TeleOp",
    "detail": "FTC Java annotation TeleOp"
  },
  {
    "kind": "class",
    "simpleName": "DcMotor",
    "fullName": "com.qualcomm.robotcore.hardware.DcMotor",
    "detail": "FTC Java class DcMotor",
    "members": [
      {
        "kind": "method",
        "label": "setPower",
        "detail": "void setPower(double power)",
        "insertText": "setPower($1)"
      },
      {
        "kind": "method",
        "label": "getPower",
        "detail": "double getPower()",
        "insertText": "getPower($1)"
      },
      {
        "kind": "method",
        "label": "getAppliedPower",
        "detail": "double getAppliedPower()",
        "insertText": "getAppliedPower($1)"
      },
      {
        "kind": "method",
        "label": "setDirection",
        "detail": "void setDirection(Direction direction)",
        "insertText": "setDirection($1)"
      },
      {
        "kind": "method",
        "label": "getDirection",
        "detail": "Direction getDirection()",
        "insertText": "getDirection($1)"
      }
    ]
  },
  {
    "kind": "enum",
    "simpleName": "Direction",
    "fullName": "com.qualcomm.robotcore.hardware.DcMotor.Direction",
    "detail": "FTC Java enum Direction",
    "enumValues": [
      "FORWARD",
      "REVERSE"
    ]
  },
  {
    "kind": "class",
    "simpleName": "Gamepad",
    "fullName": "com.qualcomm.robotcore.hardware.Gamepad",
    "detail": "FTC Java class Gamepad",
    "members": [
      {
        "kind": "field",
        "label": "dpad_up",
        "detail": "boolean dpad_up",
        "insertText": "dpad_up"
      },
      {
        "kind": "field",
        "label": "dpad_down",
        "detail": "boolean dpad_down",
        "insertText": "dpad_down"
      },
      {
        "kind": "field",
        "label": "dpad_left",
        "detail": "boolean dpad_left",
        "insertText": "dpad_left"
      },
      {
        "kind": "field",
        "label": "dpad_right",
        "detail": "boolean dpad_right",
        "insertText": "dpad_right"
      },
      {
        "kind": "field",
        "label": "a",
        "detail": "boolean a",
        "insertText": "a"
      },
      {
        "kind": "field",
        "label": "b",
        "detail": "boolean b",
        "insertText": "b"
      },
      {
        "kind": "field",
        "label": "x",
        "detail": "boolean x",
        "insertText": "x"
      },
      {
        "kind": "field",
        "label": "y",
        "detail": "boolean y",
        "insertText": "y"
      },
      {
        "kind": "field",
        "label": "left_bumper",
        "detail": "boolean left_bumper",
        "insertText": "left_bumper"
      },
      {
        "kind": "field",
        "label": "right_bumper",
        "detail": "boolean right_bumper",
        "insertText": "right_bumper"
      },
      {
        "kind": "field",
        "label": "left_trigger",
        "detail": "double left_trigger",
        "insertText": "left_trigger"
      },
      {
        "kind": "field",
        "label": "right_trigger",
        "detail": "double right_trigger",
        "insertText": "right_trigger"
      },
      {
        "kind": "field",
        "label": "left_stick_x",
        "detail": "double left_stick_x",
        "insertText": "left_stick_x"
      },
      {
        "kind": "field",
        "label": "left_stick_y",
        "detail": "double left_stick_y",
        "insertText": "left_stick_y"
      },
      {
        "kind": "field",
        "label": "right_stick_x",
        "detail": "double right_stick_x",
        "insertText": "right_stick_x"
      },
      {
        "kind": "field",
        "label": "right_stick_y",
        "detail": "double right_stick_y",
        "insertText": "right_stick_y"
      },
      {
        "kind": "method",
        "label": "resetButtons",
        "detail": "void resetButtons()",
        "insertText": "resetButtons($1)"
      }
    ]
  },
  {
    "kind": "class",
    "simpleName": "HardwareMap",
    "fullName": "com.qualcomm.robotcore.hardware.HardwareMap",
    "detail": "FTC Java class HardwareMap",
    "members": [
      {
        "kind": "method",
        "label": "put",
        "detail": "void put(String name, Object device)",
        "insertText": "put($1)"
      },
      {
        "kind": "method",
        "label": "clear",
        "detail": "void clear()",
        "insertText": "clear($1)"
      },
      {
        "kind": "method",
        "label": "get",
        "detail": "T get(Class<T> type, String name)",
        "insertText": "get($1)"
      }
    ]
  },
  {
    "kind": "enum",
    "simpleName": "AngleUnit",
    "fullName": "org.firstinspires.ftc.robotcore.external.navigation.AngleUnit",
    "detail": "FTC Java enum AngleUnit",
    "members": [
      {
        "kind": "method",
        "label": "toRadians",
        "detail": "double toRadians(double value)",
        "insertText": "toRadians($1)"
      },
      {
        "kind": "method",
        "label": "fromRadians",
        "detail": "double fromRadians(double radians)",
        "insertText": "fromRadians($1)"
      },
      {
        "kind": "method",
        "label": "convert",
        "detail": "double convert(double value, AngleUnit fromUnit)",
        "insertText": "convert($1)"
      }
    ],
    "enumValues": [
      "RADIANS",
      "DEGREES"
    ]
  },
  {
    "kind": "enum",
    "simpleName": "DistanceUnit",
    "fullName": "org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit",
    "detail": "FTC Java enum DistanceUnit",
    "members": [
      {
        "kind": "method",
        "label": "toMm",
        "detail": "double toMm(double value)",
        "insertText": "toMm($1)"
      },
      {
        "kind": "method",
        "label": "fromMm",
        "detail": "double fromMm(double mm)",
        "insertText": "fromMm($1)"
      },
      {
        "kind": "method",
        "label": "toMeters",
        "detail": "double toMeters(double value)",
        "insertText": "toMeters($1)"
      },
      {
        "kind": "method",
        "label": "fromMeters",
        "detail": "double fromMeters(double meters)",
        "insertText": "fromMeters($1)"
      },
      {
        "kind": "method",
        "label": "toCm",
        "detail": "double toCm(double value)",
        "insertText": "toCm($1)"
      },
      {
        "kind": "method",
        "label": "fromCm",
        "detail": "double fromCm(double cm)",
        "insertText": "fromCm($1)"
      },
      {
        "kind": "method",
        "label": "toInches",
        "detail": "double toInches(double value)",
        "insertText": "toInches($1)"
      },
      {
        "kind": "method",
        "label": "fromInches",
        "detail": "double fromInches(double inches)",
        "insertText": "fromInches($1)"
      },
      {
        "kind": "method",
        "label": "convert",
        "detail": "double convert(double value, DistanceUnit fromUnit)",
        "insertText": "convert($1)"
      }
    ],
    "enumValues": [
      "METER",
      "CM",
      "MM",
      "INCH"
    ]
  },
  {
    "kind": "class",
    "simpleName": "Pose2D",
    "fullName": "org.firstinspires.ftc.robotcore.external.navigation.Pose2D",
    "detail": "FTC Java class Pose2D",
    "members": [
      {
        "kind": "method",
        "label": "getX",
        "detail": "double getX(DistanceUnit unit)",
        "insertText": "getX($1)"
      },
      {
        "kind": "method",
        "label": "getY",
        "detail": "double getY(DistanceUnit unit)",
        "insertText": "getY($1)"
      },
      {
        "kind": "method",
        "label": "getHeading",
        "detail": "double getHeading(AngleUnit unit)",
        "insertText": "getHeading($1)"
      }
    ]
  },
  {
    "kind": "class",
    "simpleName": "Telemetry",
    "fullName": "org.firstinspires.ftc.robotcore.external.Telemetry",
    "detail": "FTC Java class Telemetry",
    "members": [
      {
        "kind": "method",
        "label": "setSink",
        "detail": "void setSink(Sink sink)",
        "insertText": "setSink($1)"
      },
      {
        "kind": "method",
        "label": "addData",
        "detail": "void addData(String caption, Object value)",
        "insertText": "addData($1)"
      },
      {
        "kind": "method",
        "label": "update",
        "detail": "void update()",
        "insertText": "update($1)"
      }
    ]
  }
];
