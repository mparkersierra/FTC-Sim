package org.firstinspires.ftc.robotcore.external;

import java.util.LinkedHashMap;
import java.util.Map;

public class Telemetry {
    public interface Sink {
        void accept(Map<String, Object> data);
    }

    private final Map<String, Object> data = new LinkedHashMap<>();
    private Sink sink;

    public synchronized void setSink(Sink sink) {
        this.sink = sink;
    }

    public synchronized void addData(String caption, Object value) {
        data.put(caption, value);
    }

    public synchronized void update() {
        Map<String, Object> snapshot = new LinkedHashMap<>(data);

        try {
            if (sink != null) {
                sink.accept(snapshot);
            }
        } finally {
            data.clear();
        }
    }
}
