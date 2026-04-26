package org.firstinspires.ftc.teamcode.examples;

import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Test TeleOp", group="Test")
public class TestTele extends LinearOpMode {
    private DcMotor leftFront;
    private DcMotor rightFront;
    private DcMotor leftBack;
    private DcMotor rightBack;

    @Override
    public void runOpMode() {
        leftFront = hardwareMap.get(DcMotor.class, "leftFront");
        rightFront = hardwareMap.get(DcMotor.class, "rightFront");
        leftBack = hardwareMap.get(DcMotor.class, "leftBack");
        rightBack = hardwareMap.get(DcMotor.class, "rightBack");

        leftFront.setDirection(DcMotor.Direction.REVERSE);
        leftBack.setDirection(DcMotor.Direction.REVERSE);

        telemetry.addData("Status", "Initialized");
        telemetry.update();

        waitForStart();

        while (opModeIsActive()) {
            double drive = -gamepad1.left_stick_y;
            double turn = gamepad1.right_stick_x;

            double leftPower = drive + turn;
            double rightPower = drive - turn;

            leftFront.setPower(leftPower);
            leftBack.setPower(leftPower);
            rightFront.setPower(rightPower);
            rightBack.setPower(rightPower);

            telemetry.addData("Drive", drive);
            telemetry.addData("Turn", turn);
            telemetry.addData("Left Power", leftPower);
            telemetry.addData("Right Power", rightPower);
            telemetry.update();

            sleep(50);
        }
    }
}