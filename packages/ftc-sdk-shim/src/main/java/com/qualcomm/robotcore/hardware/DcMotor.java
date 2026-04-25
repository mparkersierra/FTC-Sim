package com.qualcomm.robotcore.hardware;

public class DcMotor {
    private double power = 0.0;

    public void setPower(double power) {
        this.power = Math.max(-1.0, Math.min(1.0, power));
    }

    public double getPower() {
        return power;
    }
}