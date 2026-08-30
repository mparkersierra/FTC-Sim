package com.qualcomm.robotcore.hardware;

public class PIDFCoefficients extends PIDCoefficients {
    public enum MotorControlAlgorithm {
        LegacyPID,
        PIDF
    }

    public double f;
    public MotorControlAlgorithm algorithm;

    public PIDFCoefficients() {
        this(0.0, 0.0, 0.0, 0.0);
    }

    public PIDFCoefficients(double p, double i, double d, double f) {
        this(p, i, d, f, MotorControlAlgorithm.PIDF);
    }

    public PIDFCoefficients(
        double p,
        double i,
        double d,
        double f,
        MotorControlAlgorithm algorithm
    ) {
        super(p, i, d);
        this.f = f;
        this.algorithm = algorithm;
    }
}
