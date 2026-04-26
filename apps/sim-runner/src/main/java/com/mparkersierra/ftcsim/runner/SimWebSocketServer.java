package com.mparkersierra.ftcsim.runner;

import org.java_websocket.server.WebSocketServer;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;

import java.net.InetSocketAddress;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SimWebSocketServer extends WebSocketServer {
    private static final Pattern KEY_PATTERN = Pattern.compile("\"key\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
    private static final Pattern PRESSED_PATTERN = Pattern.compile("\"pressed\"\\s*:\\s*(true|false)");

    private BrowserGamepadController controller;

    public SimWebSocketServer(int port) {
        super(new InetSocketAddress(port));
    }

    public void setController(BrowserGamepadController controller) {
        this.controller = controller;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("Viewer connected");
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println("Viewer disconnected code=" + code + " reason=" + reason);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        System.out.println("Received browser message: " + message);

        if (controller == null) {
            System.out.println("No browser gamepad controller is attached yet");
            return;
        }

        String key = extractKey(message);
        Boolean pressed = extractPressed(message);

        if (key == null || pressed == null) {
            System.out.println("Ignoring browser message: " + message);
            return;
        }

        System.out.println("Browser key " + key + " pressed=" + pressed);
        controller.handleInput(key, pressed);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.out.println("WebSocket error");
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server running on ws://localhost:8080");
    }

    public void broadcastRobotState(double x, double y, double headingDegrees) {
        String json = "{"
            + "\"x\":" + x + ","
            + "\"y\":" + y + ","
            + "\"heading\":" + headingDegrees
            + "}";

        broadcast(json);
    }

    private String extractKey(String message) {
        Matcher matcher = KEY_PATTERN.matcher(message);
        if (!matcher.find()) {
            return null;
        }

        String key = matcher.group(1);
        return "\\s".equals(key) ? " " : key;
    }

    private Boolean extractPressed(String message) {
        Matcher matcher = PRESSED_PATTERN.matcher(message);
        if (!matcher.find()) {
            return null;
        }

        return Boolean.parseBoolean(matcher.group(1));
    }
}
