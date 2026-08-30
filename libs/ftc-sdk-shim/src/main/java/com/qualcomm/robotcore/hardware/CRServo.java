package com.qualcomm.robotcore.hardware;

public class CRServo extends DcMotorSimple {
    private final ServoController controller = new ServoController();
    private final int portNumber;

    public CRServo() {
        this(0);
    }

    public CRServo(int portNumber) {
        this.portNumber = portNumber;
    }

    public ServoController getController() {
        return controller;
    }

    public int getPortNumber() {
        return portNumber;
    }
}
