package org.firstinspires.ftc.teamcode.software;

import org.firstinspires.ftc.teamcode.hardware.RobotHardware;
public class MecanumDrive {

    private final RobotHardware robot;

    // Configurable fields
    public final static double DEADZONE = 0.05;
    public double speed = 1.0;

    // State variables
    private double leftFrontPower, rightFrontPower, leftBackPower, rightBackPower;
    private double strafe, forward, rotate;
    private boolean joystickActive;

    // Constructors
    public MecanumDrive(RobotHardware robot) {
        this.robot = robot;
    }

    // Main update method (called each loop)
    /**
     * Uses stick inputs for drive train, uses centric defined in init
     * */
    public void update(double leftStickX, double leftStickY, double rightStickX, double rightStickY) {
        strafe = leftStickX;
        rotate = rightStickX;

        forward = -(leftStickY + rightStickY);
        forward = Math.clamp(forward, -1.0, 1.0);

        joystickActive = Math.abs(strafe) > DEADZONE ||
                Math.abs(forward) > DEADZONE ||
                Math.abs(rotate) > DEADZONE;

        if (joystickActive) {
            robotCentricDrive(strafe, forward, rotate);
        } else {
            stopMotors();
        }
    }

    // --- Robot Centric ---
    private void robotCentricDrive(double strafe, double forward, double rotate) {
        leftBackPower   = (forward - strafe + rotate);
        leftFrontPower  = (forward + strafe + rotate);
        rightFrontPower = (forward - strafe - rotate);
        rightBackPower  = (forward + strafe - rotate);

        applyMotorPowers();
    }

    // --- Motor Power Handling ---
    private void applyMotorPowers() {
        leftFrontPower  *= speed;
        leftBackPower   *= speed;
        rightFrontPower *= speed;
        rightBackPower  *= speed;
        double max = Math.max(1.0, Math.max(Math.abs(leftFrontPower),
                Math.max(Math.abs(rightFrontPower),
                        Math.max(Math.abs(leftBackPower), Math.abs(rightBackPower)))));

        leftFrontPower  /= max;
        rightFrontPower /= max;
        leftBackPower   /= max;
        rightBackPower  /= max;

        robot.lf.setPower(0);
        robot.rf.setPower(rightFrontPower);
        robot.lb.setPower(leftBackPower);
        robot.rb.setPower(rightBackPower);
    }

    public void stopMotors() {
        robot.lf.setPower(0);
        robot.rf.setPower(0);
        robot.lb.setPower(0);
        robot.rb.setPower(0);
    }

}