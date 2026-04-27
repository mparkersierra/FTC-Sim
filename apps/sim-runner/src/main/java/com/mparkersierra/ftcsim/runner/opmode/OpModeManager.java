package com.mparkersierra.ftcsim.runner.opmode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.firstinspires.ftc.robotcore.external.Telemetry;

import java.util.List;

public class OpModeManager {
    private final HardwareMap hardwareMap;
    private final Telemetry telemetry;
    private final OpModeScanner opModeScanner;

    private LinearOpMode currentOpMode;
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

    public synchronized LinearOpMode getCurrentOpMode() {
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
                    LinearOpMode opMode = (LinearOpMode) info.clazz.getDeclaredConstructor().newInstance();
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
        }

        clearCurrentOpMode();

        if (hadOpMode) {
            notifyStopped();
        }
    }

    private void runOpMode(LinearOpMode opMode) {
        try {
            opMode.runOpMode();
        } catch (Throwable t) {
            t.printStackTrace();
        } finally {
            handleOpModeFinished(opMode, Thread.currentThread());
        }
    }

    private synchronized void handleOpModeFinished(LinearOpMode opMode, Thread thread) {
        if (currentOpMode != opMode || opModeThread != thread) {
            return;
        }

        opMode.requestOpModeStop();
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
