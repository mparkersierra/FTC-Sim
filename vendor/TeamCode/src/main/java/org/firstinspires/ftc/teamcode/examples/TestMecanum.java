package org.firstinspires.ftc.teamcode.examples;

import org.firstinspires.ftc.teamcode.hardware.RobotHardware;
import org.firstinspires.ftc.teamcode.software.MecanumDrive;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

public class TestMecanum extends LinearOpMode {

    @Override
    public void runOpMode() {
        // Initialize hardware and mecanum drive
        RobotHardware robot = new RobotHardware(hardwareMap);
        MecanumDrive drive = new MecanumDrive(robot);

        waitForStart();

        while (opModeIsActive()) {
            // Read gamepad inputs
            double leftStickX = gamepad1.left_stick_x;
            double leftStickY = gamepad1.left_stick_y;
            double rightStickX = gamepad1.right_stick_x;
            double rightStickY = gamepad1.right_stick_y;

            // Update mecanum drive with joystick inputs
            drive.update(leftStickX, leftStickY, rightStickX, rightStickY);
        }
    }
    
}
