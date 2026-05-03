package org.firstinspires.ftc.robotcore.external;

import java.util.LinkedHashMap;
import java.util.Map;

public class Telemetry {
    public interface Sink {
        void accept(Map<String, Object> data);
    }

    private final Map<String, Object> data = new LinkedHashMap<>();
    private Map<String, Object> pendingSnapshot;
    private Sink sink;

    public synchronized void setSink(Sink sink) {
        this.sink = sink;
    }

    public synchronized void addData(String caption, Object value) {
        data.put(caption, value);
    }

    public synchronized void update() {
        pendingSnapshot = new LinkedHashMap<>(data);
        data.clear();
    }

    public void flush() {
        Map<String, Object> snapshot;
        Sink currentSink;

        synchronized (this) {
            if (pendingSnapshot == null) {
                return;
            }

            snapshot = pendingSnapshot;
            pendingSnapshot = null;
            currentSink = sink;
        }

        if (currentSink != null) {
            currentSink.accept(snapshot);
        }
    }
}
