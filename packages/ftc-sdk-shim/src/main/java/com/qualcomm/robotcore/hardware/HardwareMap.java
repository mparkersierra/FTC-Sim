package com.qualcomm.robotcore.hardware;

import java.util.HashMap;
import java.util.Map;

public class HardwareMap {
    private final Map<String, Object> devices = new HashMap<>();

    public void put(String name, Object device) {
        devices.put(name, device);
    }

    public void clear() {
        devices.clear();
    }

    public <T> T get(Class<T> type, String name) {
        Object device = devices.get(name);

        if (device == null) {
            throw new RuntimeException("No hardware device named: " + name);
        }

        if (!type.isInstance(device)) {
            throw new RuntimeException(
                "Device '" + name + "' is not a " + type.getSimpleName()
            );
        }

        return type.cast(device);
    }
}