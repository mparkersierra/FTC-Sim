package com.mparkersierra.ftcsim.runner.hardware;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

import java.util.HashMap;
import java.util.Map;

public class SimHardwareRegistry {
    private final HardwareMap hardwareMap = new HardwareMap();
    private final Map<String, DcMotor> motors = new HashMap<>();

    public void clear() {
        motors.clear();
        hardwareMap.clear();
    }

    public void addDevice(String type, String name) {
        if (type.equals("DcMotor")) {
            DcMotor motor = new DcMotor();
            motors.put(name, motor);
            hardwareMap.put(name, motor);
            System.out.println("Added DcMotor: " + name);
        }
    }

    public HardwareMap getHardwareMap() {
        return hardwareMap;
    }

    public Map<String, DcMotor> getMotors() {
        return motors;
    }

    public DcMotor getMotor(String name) {
        return motors.get(name);
    }
}
