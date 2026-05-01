package com.mparkersierra.ftcsim.runner.opmode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

import java.util.List;

public class OpModeManager {
    private static final long LOOP_INTERVAL_MILLIS = 20;

    private final HardwareMap hardwareMap;
    private final Telemetry telemetry;
    private final OpModeScanner opModeScanner;

    private OpMode currentOpMode;
    private Thread opModeThread;
    private Runnable stopListener;

    public OpModeManager(HardwareMap hardwareMap, Telemetry telemetry, OpModeScanner opModeScanner) {
        this.hardwareMap = hardwareMap;
        this.telemetry = telemetry;
        this.opModeScanner = opModeScanner;
    }

    public List<OpModeInfo> getOpModes() {
        return opModeScanner.scan();
    }

    public synchronized OpMode getCurrentOpMode() {
        return currentOpMode;
    }

    public synchronized void setStopListener(Runnable stopListener) {
        this.stopListener = stopListener;
    }

    public synchronized void init(String opModeId) {
        stop();

        for (OpModeInfo info : getOpModes()) {
            if (info.id.equals(opModeId)) {
                try {
                    OpMode opMode = (OpMode) info.clazz.getDeclaredConstructor().newInstance();
                    opMode.hardwareMap = hardwareMap;
                    opMode.telemetry = telemetry;

                    currentOpMode = opMode;
                    opModeThread = new Thread(() -> runOpMode(opMode), "OpMode-" + info.name);
                    opModeThread.start();

                    System.out.println("Initialized " + info.name);
                    return;
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
        }

        throw new RuntimeException("OpMode not found: " + opModeId);
    }

    public synchronized void start() {
        if (currentOpMode != null) {
            currentOpMode.internalStart();
        }
    }

    public synchronized void stop() {
        boolean hadOpMode = currentOpMode != null;

        if (currentOpMode != null) {
            currentOpMode.requestOpModeStop();
            currentOpMode.stop();
        }

        clearCurrentOpMode();

        if (hadOpMode) {
            notifyStopped();
        }
    }

    private void runOpMode(OpMode opMode) {
        try {
            if (opMode instanceof LinearOpMode) {
                ((LinearOpMode) opMode).runOpMode();
            } else {
                runIterativeOpMode(opMode);
            }
        } catch (Throwable t) {
            t.printStackTrace();
        } finally {
            handleOpModeFinished(opMode, Thread.currentThread());
        }
    }

    private void runIterativeOpMode(OpMode opMode) {
        opMode.init();

        while (isCurrent(opMode) && !opMode.isStarted() && !opMode.isStopRequested()) {
            opMode.init_loop();
            sleepLoopInterval();
        }

        if (!isCurrent(opMode) || opMode.isStopRequested()) {
            return;
        }

        opMode.start();

        while (isCurrent(opMode) && !opMode.isStopRequested()) {
            opMode.loop();
            sleepLoopInterval();
        }
    }

    private synchronized boolean isCurrent(OpMode opMode) {
        return currentOpMode == opMode;
    }

    private void sleepLoopInterval() {
        try {
            Thread.sleep(LOOP_INTERVAL_MILLIS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private synchronized void handleOpModeFinished(OpMode opMode, Thread thread) {
        if (currentOpMode != opMode || opModeThread != thread) {
            return;
        }

        opMode.requestOpModeStop();
        opMode.stop();
        clearCurrentOpMode();
        notifyStopped();
    }

    private void clearCurrentOpMode() {
        currentOpMode = null;
        opModeThread = null;
    }

    private void notifyStopped() {
        if (stopListener != null) {
            stopListener.run();
        }
    }
}
