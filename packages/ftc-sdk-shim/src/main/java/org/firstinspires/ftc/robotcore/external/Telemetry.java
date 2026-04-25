package org.firstinspires.ftc.robotcore.external;

import java.util.LinkedHashMap;
import java.util.Map;

public class Telemetry {
    private final Map<String, Object> data = new LinkedHashMap<>();

    public void addData(String caption, Object value) {
        data.put(caption, value);
    }

    public void update() {
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            System.out.println(entry.getKey() + ": " + entry.getValue());
        }
        data.clear();
    }
}