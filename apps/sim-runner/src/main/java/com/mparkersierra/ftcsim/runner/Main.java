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
        SimWebSocketServer server = new SimWebSocketServer(8080);
        server.start();

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

        double robotX = 0.0;      // field X, left/right
        double robotY = 0.0;      // field Y, forward/back
        double heading = 0.0;     // radians

        long lastTime = System.nanoTime();
        long lastPrint = 0;

        final double MAX_SPEED = 0.1;       // inches per second at full power
        final double MAX_TURN_SPEED = 0.1;   // radians per second at full turn power

        while (opModeThread.isAlive()) {
            long nowNano = System.nanoTime();
            double dt = (nowNano - lastTime) / 1_000_000_000.0;
            lastTime = nowNano;

            double lf = leftFront.getAppliedPower();
            double rf = rightFront.getAppliedPower();
            double lb = leftBack.getAppliedPower();
            double rb = rightBack.getAppliedPower();

            /*
            * Mecanum inverse calculation.
            *
            * Assumes your applied powers are:
            * LF = forward + strafe + turn
            * RF = forward - strafe - turn
            * LB = forward - strafe + turn
            * RB = forward + strafe - turn
            */
            double forward = (-lf + rf - lb + rb) / 4.0;
            double strafe  = (-lf + rf + lb - rb) / 4.0;
            double turn    = (lf + rf + lb + rb) / 4.0;

            // Convert robot-relative movement into field-relative movement
            double cos = Math.cos(heading);
            double sin = Math.sin(heading);

            double robotVx = strafe * MAX_SPEED;
            double robotVy = forward * MAX_SPEED;

            double fieldVx = robotVx * cos - robotVy * sin;
            double fieldVy = robotVx * sin + robotVy * cos;

            robotX += fieldVx * dt;
            robotY += fieldVy * dt;
            heading += turn * MAX_TURN_SPEED * dt;

            // Keep heading between -pi and pi
            heading = Math.atan2(Math.sin(heading), Math.cos(heading));

            long now = System.currentTimeMillis();

            if (now - lastPrint > 2000) {
                System.out.println(
                    "LF=" + lf
                    + " RF=" + rf
                    + " LB=" + lb
                    + " RB=" + rb
                    + " | forward=" + forward
                    + " strafe=" + strafe
                    + " turn=" + turn
                    + " | x=" + robotX
                    + " y=" + robotY
                    + " headingDeg=" + Math.toDegrees(heading)
                );
                lastPrint = now;
            }

            server.broadcastRobotState(robotX, robotY, heading);

            Thread.sleep(20);
        }

        System.out.println("Simulator stopped.");
        scanner.close();
    }
}