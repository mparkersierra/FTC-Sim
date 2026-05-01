package com.qualcomm.robotcore.eventloop.opmode;

import java.util.concurrent.CountDownLatch;

public abstract class LinearOpMode extends OpMode {
    private volatile boolean active = false;
    private final CountDownLatch startLatch = new CountDownLatch(1);

    public abstract void runOpMode();

    @Override
    public final void init() {
    }

    @Override
    public final void loop() {
    }

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

    @Override
    public void internalStart() {
        super.internalStart();
        startLatch.countDown();
    }

    public boolean opModeIsActive() {
        return active && !isStopRequested();
    }

    @Override
    public void requestOpModeStop() {
        super.requestOpModeStop();
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
