package com.qualcomm.robotcore.hardware;

public class DcMotor {
    public enum Direction {
        FORWARD,
        REVERSE
    }

    private double power = 0.0;
    private Direction direction = Direction.FORWARD;

    public void setPower(double power) {
        this.power = Math.max(-1.0, Math.min(1.0, power));
    }

    public double getPower() {
        return power;
    }

    public double getAppliedPower() {
        return direction == Direction.REVERSE ? -power : power;
    }

    public void setDirection(Direction direction) {
        this.direction = direction;
    }

    public Direction getDirection() {
        return direction;
    }
}