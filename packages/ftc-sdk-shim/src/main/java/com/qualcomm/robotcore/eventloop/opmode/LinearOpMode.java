package com.qualcomm.robotcore.eventloop.opmode;

import com.qualcomm.robotcore.hardware.Gamepad;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

public abstract class LinearOpMode {
    public HardwareMap hardwareMap;
    public Telemetry telemetry;

    public Gamepad gamepad1 = new Gamepad();
    public Gamepad gamepad2 = new Gamepad();

    private boolean active = false;

    public abstract void runOpMode();

    public void waitForStart() {
        System.out.println("STARTED");
        active = true;
    }

    public boolean opModeIsActive() {
        return active;
    }

    public void requestOpModeStop() {
        active = false;
    }

    public void sleep(long milliseconds) {
        try {
            Thread.sleep(milliseconds);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}