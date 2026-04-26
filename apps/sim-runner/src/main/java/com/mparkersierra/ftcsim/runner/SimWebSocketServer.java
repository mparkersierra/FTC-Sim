package com.mparkersierra.ftcsim.runner;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;

public class SimWebSocketServer extends WebSocketServer {
    private final OpModeManager opModeManager;
    private final BrowserGamepadController controller;

    private final RobotPose robotPose;

    public SimWebSocketServer(int port, OpModeManager opModeManager, RobotPose robotPose) {
        super(new InetSocketAddress(port));
        this.opModeManager = opModeManager;
        this.robotPose = robotPose;
        this.controller = new BrowserGamepadController(opModeManager);
        this.opModeManager.setStopListener(this::broadcastOpModeStopped);
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
        } else if (message.contains("\"type\":\"key\"")) {
            String key = extract(message, "key");
            boolean pressed = message.contains("\"pressed\":true");
            controller.handleInput(key, pressed);
        } else if (message.contains("\"type\":\"setPose\"")) {
            robotPose.x = extractDouble(message, "x");
            robotPose.y = extractDouble(message, "y");
            robotPose.heading = extractDouble(message, "heading");
        }
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

    public void broadcastRobotState(double x, double y, double headingDegrees) {
        broadcast("{\"type\":\"robotState\",\"x\":" + x + ",\"y\":" + y + ",\"heading\":" + headingDegrees + "}");
    }

    private void broadcastOpModeStopped() {
        broadcast("{\"type\":\"opModeStopped\"}");
    }

    @Override public void onClose(WebSocket conn, int code, String reason, boolean remote) {}
    @Override public void onError(WebSocket conn, Exception ex) { ex.printStackTrace(); }
    @Override public void onStart() { System.out.println("WebSocket running on ws://localhost:8080"); }
}
