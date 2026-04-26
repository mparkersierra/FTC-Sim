package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

public class Main {
    public static void main(String[] args) throws Exception {
        HardwareMap hardwareMap = new HardwareMap();

        DcMotor leftFront = new DcMotor();
        DcMotor rightFront = new DcMotor();
        DcMotor leftBack = new DcMotor();
        DcMotor rightBack = new DcMotor();

        hardwareMap.put("leftFront", leftFront);
        hardwareMap.put("rightFront", rightFront);
        hardwareMap.put("leftBack", leftBack);
        hardwareMap.put("rightBack", rightBack);

        OpModeManager opModeManager = new OpModeManager(hardwareMap, new Telemetry());

        RobotPose robotPose = new RobotPose();

        SimWebSocketServer server = new SimWebSocketServer(8080, opModeManager, robotPose);
        server.start();


        long lastTime = System.nanoTime();

        final double MAX_SPEED = 0.5;       // inches per second at full power
        final double MAX_TURN_SPEED = 0.5;   // radians per second at full turn power

        while (true) {
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

            double cos = Math.cos(robotPose.heading);
            double sin = Math.sin(robotPose.heading);

            // rotate robot-relative movement by current heading
            double fieldVx = robotVx * cos - robotVy * sin;
            double fieldVy = robotVx * sin + robotVy * cos;

            robotPose.x += fieldVx * dt;
            robotPose.y += fieldVy * dt;

            robotPose.heading += turn * MAX_TURN_SPEED * dt;
            robotPose.heading = Math.atan2(Math.sin(robotPose.heading), Math.cos(robotPose.heading));

            server.broadcastRobotState(robotPose.x, robotPose.y, robotPose.heading);

            Thread.sleep(20);
        }
    }
}
