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
            try {
                opMode.runOpMode();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        opModeThread.start();

        double robotX = 0.0;

        while (opModeThread.isAlive()) {
            double averagePower =
                (leftFront.getPower()
                + rightFront.getPower()
                + leftBack.getPower()
                + rightBack.getPower()) / 4.0;

            robotX += averagePower * 0.05;

            System.out.println(
                "LF=" + leftFront.getPower()
                + " RF=" + rightFront.getPower()
                + " LB=" + leftBack.getPower()
                + " RB=" + rightBack.getPower()
                + " | robotX=" + robotX
            );

            Thread.sleep(100);
        }
    }
}