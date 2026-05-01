package com.qualcomm.robotcore.eventloop.opmode;

import com.qualcomm.robotcore.hardware.Gamepad;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

public abstract class OpMode {
    public HardwareMap hardwareMap;
    public Telemetry telemetry;

    public Gamepad gamepad1 = new Gamepad();
    public Gamepad gamepad2 = new Gamepad();

    public double time = 0.0;

    private volatile boolean started = false;
    private volatile boolean stopRequested = false;
    private long startTimeNanos = System.nanoTime();

    public abstract void init();

    public void init_loop() {
    }

    public void start() {
        resetStartTime();
    }

    public abstract void loop();

    public void stop() {
    }

    public void resetStartTime() {
        startTimeNanos = System.nanoTime();
        time = 0.0;
    }

    public double getRuntime() {
        time = (System.nanoTime() - startTimeNanos) / 1_000_000_000.0;
        return time;
    }

    public void requestOpModeStop() {
        stopRequested = true;
    }

    public boolean isStarted() {
        return started;
    }

    public boolean isStopRequested() {
        return stopRequested;
    }

    public void idle() {
        if (isStopRequested()) {
            throw new OpModeStopRequestedException();
        }
        Thread.yield();
    }

    public void internalStart() {
        started = true;
        resetStartTime();
    }
}
