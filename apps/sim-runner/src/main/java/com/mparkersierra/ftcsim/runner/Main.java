package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;
import org.firstinspires.ftc.teamcode.examples.TestAuto;
import org.firstinspires.ftc.teamcode.examples.TestTele;

import java.util.Scanner;

public class Main {
    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);

        System.out.println("Select OpMode:");
        System.out.println("1. TestAuto");
        System.out.println("2. TestTele");
        System.out.print("> ");

        String choice = scanner.nextLine().trim();

        LinearOpMode opMode;

        if (choice.equals("2")) {
            opMode = new TestTele();
        } else {
            opMode = new TestAuto();
        }

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

        Thread opModeThread = new Thread(opMode::runOpMode);
        opModeThread.start();

        Thread keyboardThread = new Thread(() -> {
            System.out.println();
            System.out.println("Keyboard controls:");
            System.out.println("w = forward");
            System.out.println("s = backward");
            System.out.println("a = turn left");
            System.out.println("d = turn right");
            System.out.println("x = stop");
            System.out.println("q = quit");
            System.out.println("Type a key and press Enter.");

            while (opModeThread.isAlive()) {
                String input = scanner.nextLine().trim().toLowerCase();

                System.out.println("Input: " + input);

                switch (input) {
                    case "w":
                        opMode.gamepad1.resetButtons();
                        opMode.gamepad1.left_stick_y = -1.0;
                        break;
                    case "s":
                        opMode.gamepad1.resetButtons();
                        opMode.gamepad1.left_stick_y = 1.0;
                        break;
                    case "a":
                        opMode.gamepad1.resetButtons();
                        opMode.gamepad1.right_stick_x = -1.0;
                        break;
                    case "d":
                        opMode.gamepad1.resetButtons();
                        opMode.gamepad1.right_stick_x = 1.0;
                        break;
                    case "x":
                        opMode.gamepad1.resetButtons();
                        break;
                    case "q":
                        opMode.requestOpModeStop();
                        return;
                    default:
                        System.out.println("Unknown key: " + input);
                }
            }
        });

        keyboardThread.setDaemon(true);
        keyboardThread.start();

        double robotX = 0.0;
        double heading = 0.0;

        long lastPrint = 0;

        while (opModeThread.isAlive()) {
            double leftPower =
                (leftFront.getAppliedPower() + leftBack.getAppliedPower()) / 2.0;

            double rightPower =
                (rightFront.getAppliedPower() + rightBack.getAppliedPower()) / 2.0;

            double forward = (leftPower - rightPower) / 2.0;
            double turn = -(leftPower + rightPower) / 2.0;

            robotX += forward * 0.05;
            heading += turn * 3.0;

            long now = System.currentTimeMillis();

            if (now - lastPrint > 5000) {
                System.out.println(
                    "LF=" + leftFront.getPower()
                    + " RF=" + rightFront.getPower()
                    + " LB=" + leftBack.getPower()
                    + " RB=" + rightBack.getPower()
                    + " | appliedL=" + leftPower
                    + " appliedR=" + rightPower
                    + " | x=" + robotX
                    + " heading=" + heading
                    + " dpad_up=" + (opMode.gamepad1.dpad_up)
                    + " dpad_down=" + (opMode.gamepad1.dpad_down)
                );
                lastPrint = now;

            }  

            Thread.sleep(100);
        }

        System.out.println("Simulator stopped.");
        scanner.close();
    }
}