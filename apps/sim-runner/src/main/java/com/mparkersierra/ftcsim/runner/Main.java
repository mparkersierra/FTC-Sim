package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;
import org.firstinspires.ftc.teamcode.examples.TestMecanum;

public class Main {
    public static void main(String[] args) throws Exception {
        SimWebSocketServer server = new SimWebSocketServer(8080);
        server.start();

        LinearOpMode opMode = new TestMecanum();

        HardwareMap hardwareMap = new HardwareMap();

        DcMotor leftFront = new DcMotor();
        DcMotor rightFront = new DcMotor();
        DcMotor leftBack = new DcMotor();
        DcMotor rightBack = new DcMotor();

        hardwareMap.put("leftFront", leftFront);
        hardwareMap.put("rightFront", rightFront);
        hardwareMap.put("leftBack", leftBack);
        hardwareMap.put("rightBack", rightBack);

        opMode.hardwareMap = hardwareMap;
        opMode.telemetry = new Telemetry();

        BrowserGamepadController controller =
            new BrowserGamepadController(opMode.gamepad1);

        server.setController(controller);

        Thread opModeThread = new Thread(opMode::runOpMode);
        opModeThread.start();

        double robotX = 0.0;      // field X, left/right
        double robotY = 0.0;      // field Y, forward/back
        double heading = 0.0;     // radians

        long lastTime = System.nanoTime();

        final double MAX_SPEED = 0.5;       // inches per second at full power
        final double MAX_TURN_SPEED = 0.5;   // radians per second at full turn power

        while (opModeThread.isAlive()) {
            //System.out.println("Running" + opMode.gamepad1.left_stick_y);
            long nowNano = System.nanoTime();
            double dt = (nowNano - lastTime) / 1_000_000_000.0;
            lastTime = nowNano;

            double lf = leftFront.getAppliedPower();
            double rf = rightFront.getAppliedPower();
            double lb = leftBack.getAppliedPower();
            double rb = rightBack.getAppliedPower();

            
            double forward = (-lf + rf - lb + rb) / 4.0;
            double strafe = (-lf - rf + lb + rb) / 4.0;
            double turn    = (lf + rf + lb + rb) / 4.0;

            double robotVx = strafe * MAX_SPEED;
            double robotVy = forward * MAX_SPEED;

            double cos = Math.cos(heading);
            double sin = Math.sin(heading);

            // rotate robot-relative movement by current heading
            double fieldVx = robotVx * cos - robotVy * sin;
            double fieldVy = robotVx * sin + robotVy * cos;

            robotX += fieldVx * dt;
            robotY += fieldVy * dt;

            heading += turn * MAX_TURN_SPEED * dt;
            heading = Math.atan2(Math.sin(heading), Math.cos(heading));

            server.broadcastRobotState(robotX, robotY, heading);

            Thread.sleep(20);
        }

        server.stop();
    }
}
