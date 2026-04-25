package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;
import org.firstinspires.ftc.teamcode.examples.TestOpMode;

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

        TestOpMode opMode = new TestOpMode();
        opMode.hardwareMap = hardwareMap;
        opMode.telemetry = new Telemetry();

        Thread opModeThread = new Thread(() -> {
            opMode.runOpMode();
        });

        opModeThread.start();

        double robotX = 0.0;
        double heading = 0.0;

        while (opModeThread.isAlive()) {
            double leftPower =
                (leftFront.getAppliedPower() + leftBack.getAppliedPower()) / 2.0;

            double rightPower =
                (rightFront.getAppliedPower() + rightBack.getAppliedPower()) / 2.0;

            // FTC motors physically spin the same way by default.
            // So same power on left + right should rotate unless one side is reversed.
            double forward = (leftPower - rightPower) / 2.0;
            double turn = -(leftPower + rightPower) / 2.0;

            robotX += forward * 0.05;
            heading += turn * 3.0;

            System.out.println(
                "LF=" + leftFront.getPower()
                + " RF=" + rightFront.getPower()
                + " LB=" + leftBack.getPower()
                + " RB=" + rightBack.getPower()
                + " | x=" + robotX
                + " heading=" + heading
            );

            Thread.sleep(100);
        }
    }
}