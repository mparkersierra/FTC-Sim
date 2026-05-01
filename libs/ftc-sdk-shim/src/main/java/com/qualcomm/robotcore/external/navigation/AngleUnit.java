package org.firstinspires.ftc.robotcore.external.navigation;

public enum AngleUnit {
    RADIANS,
    DEGREES;

    public double toRadians(double value) {
        if (this == RADIANS) {
            return value;
        }

        return Math.toRadians(value);
    }

    public double fromRadians(double radians) {
        if (this == RADIANS) {
            return radians;
        }

        return Math.toDegrees(radians);
    }

    public double convert(double value, AngleUnit fromUnit) {
        double radians = fromUnit.toRadians(value);
        return fromRadians(radians);
    }
}