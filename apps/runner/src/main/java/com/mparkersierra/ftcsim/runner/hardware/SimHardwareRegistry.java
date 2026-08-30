package com.mparkersierra.ftcsim.runner.hardware;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.qualcomm.robotcore.hardware.DcMotorSimple;
import com.qualcomm.robotcore.hardware.HardwareMap;

import java.util.HashMap;
import java.util.Map;

public class SimHardwareRegistry {
    private final HardwareMap hardwareMap = new HardwareMap();
    private final Map<String, DcMotorSimple> motors = new HashMap<>();
    private boolean opModeActive = false;

    public void clear() {
        motors.clear();
        hardwareMap.clear();
        opModeActive = false;
    }

    public void addDevice(String type, String name) {
        if (type.equals("DcMotorSimple") || type.equals("DcMotor") || type.equals("DcMotorEx")) {
            DcMotorSimple motor = createMotor(type);
            motors.put(name, motor);
            hardwareMap.put(name, motor);
            System.out.println("Added " + type + ": " + name);
        }
    }

    public HardwareMap getHardwareMap() {
        return hardwareMap;
    }

    public Map<String, DcMotorSimple> getMotors() {
        return motors;
    }

    public void setOpModeActive(boolean opModeActive) {
        this.opModeActive = opModeActive;
    }

    public void update(double seconds) {
        if (!opModeActive) {
            return;
        }

        for (DcMotorSimple motor : motors.values()) {
            if (motor instanceof DcMotor) {
                ((DcMotor) motor).updateSimulatedPosition(seconds);
            }
        }
    }

    public double motorPower(String name) {
        if (!opModeActive) {
            return 0.0;
        }

        DcMotorSimple motor = motors.get(name);
        if (motor instanceof DcMotor) {
            return ((DcMotor) motor).getSimulatedAppliedPower();
        }

        return motor == null ? 0.0 : motor.getAppliedPower();
    }

    public void stopAllMotors() {
        for (DcMotorSimple motor : motors.values()) {
            motor.setPower(0.0);
        }
    }

    public DcMotor getMotor(String name) {
        DcMotorSimple motor = motors.get(name);
        return motor instanceof DcMotor ? (DcMotor) motor : null;
    }

    public Map<String, Double> motorPowers() {
        Map<String, Double> powers = new HashMap<>();

        for (Map.Entry<String, DcMotorSimple> entry : motors.entrySet()) {
            powers.put(entry.getKey(), motorPower(entry.getKey()));
        }

        return powers;
    }

    private DcMotorSimple createMotor(String type) {
        if (type.equals("DcMotor") || type.equals("DcMotorEx")) {
            return new DcMotorEx();
        }

        return new DcMotorSimple();
    }
}
