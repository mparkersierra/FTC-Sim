package com.qualcomm.robotcore.hardware;

public class Servo {
    public static final double MIN_POSITION = 0.0;
    public static final double MAX_POSITION = 1.0;
    public static final double SIM_MAX_RANGE_DEGREES = 300.0;

    public enum Direction {
        FORWARD,
        REVERSE
    }

    private final ServoController controller = new ServoController();
    private final int portNumber;
    private Direction direction = Direction.FORWARD;
    private double minPosition = MIN_POSITION;
    private double maxPosition = MAX_POSITION;
    private double position = MIN_POSITION;

    public Servo() {
        this(0);
    }

    public Servo(int portNumber) {
        this.portNumber = portNumber;
    }

    public ServoController getController() {
        return controller;
    }

    public int getPortNumber() {
        return portNumber;
    }

    public void setDirection(Direction direction) {
        this.direction = direction;
    }

    public Direction getDirection() {
        return direction;
    }

    public void setPosition(double position) {
        double clippedPosition = Math.max(MIN_POSITION, Math.min(MAX_POSITION, position));
        double directedPosition =
            direction == Direction.REVERSE ? MAX_POSITION - clippedPosition : clippedPosition;
        this.position = minPosition + directedPosition * (maxPosition - minPosition);
    }

    public double getPosition() {
        if (maxPosition == minPosition) {
            return MIN_POSITION;
        }

        double scaledPosition = (position - minPosition) / (maxPosition - minPosition);
        return direction == Direction.REVERSE ? MAX_POSITION - scaledPosition : scaledPosition;
    }

    public void scaleRange(double min, double max) {
        double logicalPosition = getPosition();
        double clippedMin = Math.max(MIN_POSITION, Math.min(MAX_POSITION, min));
        double clippedMax = Math.max(MIN_POSITION, Math.min(MAX_POSITION, max));

        if (clippedMin > clippedMax) {
            throw new IllegalArgumentException("min must be less than or equal to max");
        }

        minPosition = clippedMin;
        maxPosition = clippedMax;
        setPosition(logicalPosition);
    }

    public double getSimulatedPosition() {
        return position;
    }

    public double getSimulatedAngleDegrees() {
        return position * SIM_MAX_RANGE_DEGREES;
    }
}
