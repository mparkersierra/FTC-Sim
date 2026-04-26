package com.qualcomm.robotcore.eventloop.opmode;

import com.qualcomm.robotcore.hardware.Gamepad;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

import java.util.concurrent.CountDownLatch;

public abstract class LinearOpMode {
    public HardwareMap hardwareMap;
    public Telemetry telemetry;

    public Gamepad gamepad1 = new Gamepad();
    public Gamepad gamepad2 = new Gamepad();

    private volatile boolean active = false;
    private final CountDownLatch startLatch = new CountDownLatch(1);

    public abstract void runOpMode();

    public void waitForStart() {
        try {
            System.out.println("Waiting for START...");
            startLatch.await();
            active = true;
            System.out.println("STARTED");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public void internalStart() {
        startLatch.countDown();
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