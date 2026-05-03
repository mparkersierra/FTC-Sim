package com.mparkersierra.ftcsim.runner.simulation;

import com.mparkersierra.ftcsim.runner.hardware.SimHardwareRegistry;
import com.qualcomm.robotcore.hardware.DcMotor;

public class DrivetrainSimulation {
    private static final double MAX_SPEED_INCHES_PER_SECOND = 15.0;
    private static final double MAX_TURN_SPEED_RADIANS_PER_SECOND = 1.5;
    private static final long TICK_MS = 20;

    private final SimHardwareRegistry hardwareRegistry;
    private final RobotPose robotPose;
    private final RobotStateBroadcaster broadcaster;

    public DrivetrainSimulation(
        SimHardwareRegistry hardwareRegistry,
        RobotPose robotPose,
        RobotStateBroadcaster broadcaster
    ) {
        this.hardwareRegistry = hardwareRegistry;
        this.robotPose = robotPose;
        this.broadcaster = broadcaster;
    }

    public void run() throws InterruptedException {
        long lastTime = System.nanoTime();

        while (true) {
            long nowNano = System.nanoTime();
            double dt = (nowNano - lastTime) / 1_000_000_000.0;
            lastTime = nowNano;

            update(dt);
            broadcaster.broadcast(robotPose.x, robotPose.y, robotPose.heading);

            Thread.sleep(TICK_MS);
        }
    }

    private void update(double dt) {
        DcMotor leftFront = hardwareRegistry.getMotor("leftFront");
        DcMotor rightFront = hardwareRegistry.getMotor("rightFront");
        DcMotor leftBack = hardwareRegistry.getMotor("leftBack");
        DcMotor rightBack = hardwareRegistry.getMotor("rightBack");

        if (
            leftFront == null ||
            rightFront == null ||
            leftBack == null ||
            rightBack == null
        ) {
            return;
        }

        double lf = leftFront.getAppliedPower();
        double rf = rightFront.getAppliedPower();
        double lb = leftBack.getAppliedPower();
        double rb = rightBack.getAppliedPower();

        double forward = (-lf + rf - lb + rb) / 4.0;
        double strafe = (-lf - rf + lb + rb) / 4.0;
        double turn = (lf + rf + lb + rb) / 4.0;

        double robotVx = strafe * MAX_SPEED_INCHES_PER_SECOND;
        double robotVy = forward * MAX_SPEED_INCHES_PER_SECOND;

        double cos = Math.cos(robotPose.heading);
        double sin = Math.sin(robotPose.heading);

        double fieldVx = robotVx * cos - robotVy * sin;
        double fieldVy = robotVx * sin + robotVy * cos;

        robotPose.x += fieldVx * dt;
        robotPose.y += fieldVy * dt;

        robotPose.heading += turn * MAX_TURN_SPEED_RADIANS_PER_SECOND * dt;
        robotPose.heading = Math.atan2(Math.sin(robotPose.heading), Math.cos(robotPose.heading));
    }
}
