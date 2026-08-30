package com.qualcomm.robotcore.hardware;

public class DcMotor extends DcMotorSimple {
    public static final double SIM_MAX_TICKS_PER_SECOND = 6000.0;

    public enum RunMode {
        RUN_WITHOUT_ENCODER,
        RUN_USING_ENCODER,
        RUN_TO_POSITION,
        STOP_AND_RESET_ENCODER
    }

    public enum ZeroPowerBehavior {
        BRAKE,
        FLOAT
    }

    private int currentPosition = 0;
    private int targetPosition = 0;
    private RunMode mode = RunMode.RUN_WITHOUT_ENCODER;
    private ZeroPowerBehavior zeroPowerBehavior = ZeroPowerBehavior.FLOAT;

    public void setMode(RunMode mode) {
        this.mode = mode;

        if (mode == RunMode.STOP_AND_RESET_ENCODER) {
            currentPosition = 0;
            targetPosition = 0;
        }
    }

    public RunMode getMode() {
        return mode;
    }

    public void setTargetPosition(int position) {
        targetPosition = position;
    }

    public int getTargetPosition() {
        return targetPosition;
    }

    public int getCurrentPosition() {
        return currentPosition;
    }

    public boolean isBusy() {
        return mode == RunMode.RUN_TO_POSITION && currentPosition != targetPosition;
    }

    public double getSimulatedAppliedPower() {
        if (mode != RunMode.RUN_TO_POSITION) {
            return getAppliedPower();
        }

        if (!isBusy()) {
            return 0.0;
        }

        return Math.copySign(Math.abs(getPower()), targetPosition - currentPosition);
    }

    public void updateSimulatedPosition(double seconds) {
        if (mode != RunMode.RUN_TO_POSITION || !isBusy() || getPower() == 0.0) {
            return;
        }

        int direction = targetPosition > currentPosition ? 1 : -1;
        int deltaTicks = (int) Math.max(
            1,
            Math.round(Math.abs(getPower()) * SIM_MAX_TICKS_PER_SECOND * seconds)
        );
        int nextPosition = currentPosition + direction * deltaTicks;

        if (
            (direction > 0 && nextPosition >= targetPosition) ||
            (direction < 0 && nextPosition <= targetPosition)
        ) {
            currentPosition = targetPosition;
        } else {
            currentPosition = nextPosition;
        }
    }

    public void setZeroPowerBehavior(ZeroPowerBehavior zeroPowerBehavior) {
        this.zeroPowerBehavior = zeroPowerBehavior;
    }

    public ZeroPowerBehavior getZeroPowerBehavior() {
        return zeroPowerBehavior;
    }
}
