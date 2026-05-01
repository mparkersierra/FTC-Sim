package org.firstinspires.ftc.robotcore.external.navigation;

public class Pose2D {
    private final double xMm;
    private final double yMm;
    private final double headingRadians;

    public Pose2D(
            DistanceUnit distanceUnit,
            double x,
            double y,
            AngleUnit angleUnit,
            double heading
    ) {
        this.xMm = distanceUnit.toMm(x);
        this.yMm = distanceUnit.toMm(y);
        this.headingRadians = angleUnit.toRadians(heading);
    }

    public double getX(DistanceUnit unit) {
        return unit.fromMm(xMm);
    }

    public double getY(DistanceUnit unit) {
        return unit.fromMm(yMm);
    }

    public double getHeading(AngleUnit unit) {
        return unit.fromRadians(headingRadians);
    }
}