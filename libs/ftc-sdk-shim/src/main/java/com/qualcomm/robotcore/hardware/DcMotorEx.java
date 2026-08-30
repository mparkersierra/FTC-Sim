package com.qualcomm.robotcore.hardware;

import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.CurrentUnit;

import java.util.EnumMap;
import java.util.Map;

public class DcMotorEx extends DcMotor {
    public static final double SIM_MAX_ANGULAR_RATE_RADIANS_PER_SECOND = 1.0;
    private boolean motorEnabled = true;
    private int targetPositionTolerance = 0;
    private double currentAlertAmps = Double.POSITIVE_INFINITY;
    private final Map<RunMode, PIDFCoefficients> pidfCoefficientsByMode =
        new EnumMap<>(RunMode.class);

    public void setMotorEnable() {
        motorEnabled = true;
    }

    public void setMotorDisable() {
        motorEnabled = false;
        setPower(0.0);
    }

    public boolean isMotorEnabled() {
        return motorEnabled;
    }

    public void setVelocity(double angularRate) {
        setPower(angularRate / SIM_MAX_TICKS_PER_SECOND);
    }

    public void setVelocity(double angularRate, AngleUnit unit) {
        setPower(unit.toRadians(angularRate) / SIM_MAX_ANGULAR_RATE_RADIANS_PER_SECOND);
    }

    public double getVelocity() {
        return getAppliedPower() * SIM_MAX_TICKS_PER_SECOND;
    }

    public double getVelocity(AngleUnit unit) {
        return unit.fromRadians(getVelocity());
    }

    public void setPIDCoefficients(RunMode mode, PIDCoefficients pidCoefficients) {
        setPIDFCoefficients(
            mode,
            new PIDFCoefficients(
                pidCoefficients.p,
                pidCoefficients.i,
                pidCoefficients.d,
                0.0
            )
        );
    }

    public void setPIDFCoefficients(RunMode mode, PIDFCoefficients pidfCoefficients) {
        pidfCoefficientsByMode.put(mode, pidfCoefficients);
    }

    public void setVelocityPIDFCoefficients(double p, double i, double d, double f) {
        setPIDFCoefficients(RunMode.RUN_USING_ENCODER, new PIDFCoefficients(p, i, d, f));
    }

    public void setPositionPIDFCoefficients(double p) {
        setPIDFCoefficients(RunMode.RUN_TO_POSITION, new PIDFCoefficients(p, 0.0, 0.0, 0.0));
    }

    public PIDCoefficients getPIDCoefficients(RunMode mode) {
        PIDFCoefficients coefficients = getPIDFCoefficients(mode);
        return new PIDCoefficients(coefficients.p, coefficients.i, coefficients.d);
    }

    public PIDFCoefficients getPIDFCoefficients(RunMode mode) {
        PIDFCoefficients coefficients = pidfCoefficientsByMode.get(mode);
        return coefficients == null ? new PIDFCoefficients() : coefficients;
    }

    public void setTargetPositionTolerance(int tolerance) {
        targetPositionTolerance = Math.max(0, tolerance);
    }

    public int getTargetPositionTolerance() {
        return targetPositionTolerance;
    }

    public double getCurrent(CurrentUnit unit) {
        return unit.fromAmps(0.0);
    }

    public double getCurrentAlert(CurrentUnit unit) {
        return unit.fromAmps(currentAlertAmps);
    }

    public void setCurrentAlert(double current, CurrentUnit unit) {
        currentAlertAmps = unit.toAmps(current);
    }

    public boolean isOverCurrent() {
        return false;
    }
}
