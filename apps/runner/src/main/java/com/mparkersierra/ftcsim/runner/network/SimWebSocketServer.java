package com.mparkersierra.ftcsim.runner.network;

import com.mparkersierra.ftcsim.runner.hardware.SimHardwareRegistry;
import com.mparkersierra.ftcsim.runner.input.BrowserGamepadController;
import com.mparkersierra.ftcsim.runner.opmode.OpModeInfo;
import com.mparkersierra.ftcsim.runner.opmode.OpModeManager;
import com.mparkersierra.ftcsim.runner.simulation.RobotPose;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Map;

public class SimWebSocketServer extends WebSocketServer {
    private final OpModeManager opModeManager;
    private final BrowserGamepadController controller;

    private final RobotPose robotPose;

    private final SimHardwareRegistry hardwareRegistry;

    public SimWebSocketServer(
        int port,
        OpModeManager opModeManager,
        RobotPose robotPose,
        SimHardwareRegistry hardwareRegistry
    ) {
        super(new InetSocketAddress(port));
        this.opModeManager = opModeManager;
        this.robotPose = robotPose;
        this.hardwareRegistry = hardwareRegistry;
        this.controller = new BrowserGamepadController(opModeManager);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        sendOpModes(conn);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        if (message.contains("\"type\":\"getOpModes\"")) {
            sendOpModes(conn);
        } else if (message.contains("\"type\":\"init\"")) {
            String id = extract(message, "id");
            opModeManager.init(id);
        } else if (message.contains("\"type\":\"start\"")) {
            opModeManager.start();
        } else if (message.contains("\"type\":\"stop\"")) {
            opModeManager.stop();
        } else if (message.contains("\"type\":\"gamepad\"")) {
            int gamepadNumber = extractInt(message, "gamepad");
            String control = extract(message, "control");
            boolean pressed = message.contains("\"pressed\":true");
            controller.handleGamepadInput(gamepadNumber, control, pressed);
        } else if (message.contains("\"type\":\"key\"")) {
            String key = extract(message, "key");
            boolean pressed = message.contains("\"pressed\":true");
            controller.handleInput(key, pressed);
        } else if (message.contains("\"type\":\"setPose\"")) {
            robotPose.x = extractDouble(message, "x");
            robotPose.y = extractDouble(message, "y");
            robotPose.heading = extractDouble(message, "heading");
        } else if (message.contains("\"type\":\"setHardwareMap\"")) {
            updateHardwareMap(message);
        } else if (message.contains("\"type\":\"shutdown\"")) {
            shutdownRunner();
        }
    }

    private void shutdownRunner() {
        opModeManager.stop();

        Thread shutdownThread = new Thread(() -> {
            try {
                Thread.sleep(100);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }

            System.exit(0);
        });
        shutdownThread.setDaemon(false);
        shutdownThread.start();
    }

    private void sendOpModes(WebSocket conn) {
        StringBuilder json = new StringBuilder();
        json.append("{\"type\":\"opModes\",\"items\":[");

        boolean first = true;
        for (OpModeInfo info : opModeManager.getOpModes()) {
            if (!first) json.append(",");
            first = false;

            json.append("{")
                .append("\"id\":\"").append(info.id).append("\",")
                .append("\"name\":\"").append(info.name).append("\",")
                .append("\"group\":\"").append(info.group).append("\",")
                .append("\"modeType\":\"").append(info.type).append("\"")
                .append("}");
        }

        json.append("]}");
        conn.send(json.toString());
    }

    private void updateHardwareMap(String message) {
        hardwareRegistry.clear();

        String marker = "{\"type\":\"DcMotor\",\"name\":\"";
        String[] parts = message.split(java.util.regex.Pattern.quote(marker));

        for (int i = 1; i < parts.length; i++) {
            String name = parts[i].split("\"")[0];

            if (!name.isBlank()) {
                hardwareRegistry.addDevice("DcMotor", name);
            }
        }

        System.out.println("Hardware map updated.");
    }

    private String extract(String json, String field) {
        String pattern = "\"" + field + "\":\"";
        int start = json.indexOf(pattern);
        if (start == -1) return "";

        start += pattern.length();
        int end = json.indexOf("\"", start);
        if (end == -1) return "";

        return json.substring(start, end);
    }

    private double extractDouble(String json, String field) {
        String pattern = "\"" + field + "\":";
        int start = json.indexOf(pattern);
        if (start == -1) return 0.0;

        start += pattern.length();
        int end = start;

        while (end < json.length()) {
            char c = json.charAt(end);
            if (!(Character.isDigit(c) || c == '-' || c == '.')) break;
            end++;
        }

        return Double.parseDouble(json.substring(start, end));
    }

    private int extractInt(String json, String field) {
        String pattern = "\"" + field + "\":";
        int start = json.indexOf(pattern);
        if (start == -1) return 0;

        start += pattern.length();
        int end = start;

        while (end < json.length()) {
            char c = json.charAt(end);
            if (!Character.isDigit(c)) break;
            end++;
        }

        if (start == end) return 0;

        return Integer.parseInt(json.substring(start, end));
    }

    public void broadcastRobotState(double x, double y, double headingDegrees) {
        broadcast("{\"type\":\"robotState\",\"x\":" + x + ",\"y\":" + y + ",\"heading\":" + headingDegrees + "}");
    }

    public void broadcastTelemetry(Map<String, Object> data) {
        StringBuilder json = new StringBuilder();
        json.append("{\"type\":\"telemetry\",\"timestamp\":")
            .append(System.currentTimeMillis())
            .append(",\"items\":[");

        boolean first = true;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (!first) json.append(",");
            first = false;

            json.append("{\"caption\":\"")
                .append(escapeJson(entry.getKey()))
                .append("\",\"value\":\"")
                .append(escapeJson(String.valueOf(entry.getValue())))
                .append("\"}");
        }

        json.append("]}");
        broadcast(json.toString());
    }

    private void broadcastOpModeStopped() {
        broadcast("{\"type\":\"opModeStopped\"}");
    }

    private String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder();

        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);

            if (c == '"') {
                escaped.append("\\\"");
            } else if (c == '\\') {
                escaped.append("\\\\");
            } else if (c == '\b') {
                escaped.append("\\b");
            } else if (c == '\f') {
                escaped.append("\\f");
            } else if (c == '\n') {
                escaped.append("\\n");
            } else if (c == '\r') {
                escaped.append("\\r");
            } else if (c == '\t') {
                escaped.append("\\t");
            } else if (c < 0x20) {
                escaped.append(String.format("\\u%04x", (int) c));
            } else {
                escaped.append(c);
            }
        }

        return escaped.toString();
    }

    @Override public void onClose(WebSocket conn, int code, String reason, boolean remote) {}
    @Override public void onError(WebSocket conn, Exception ex) { ex.printStackTrace(); }
    @Override public void onStart() { System.out.println("WebSocket running on ws://localhost:8080"); }
}
