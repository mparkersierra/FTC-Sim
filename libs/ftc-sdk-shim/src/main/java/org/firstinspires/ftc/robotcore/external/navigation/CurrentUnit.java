package org.firstinspires.ftc.robotcore.external.navigation;

public enum CurrentUnit {
    AMPS,
    MILLIAMPS;

    public double toAmps(double value) {
        if (this == AMPS) {
            return value;
        }

        return value / 1000.0;
    }

    public double fromAmps(double amps) {
        if (this == AMPS) {
            return amps;
        }

        return amps * 1000.0;
    }
}
