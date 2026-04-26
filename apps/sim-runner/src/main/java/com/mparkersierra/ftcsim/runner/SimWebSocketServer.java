package com.mparkersierra.ftcsim.runner;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;

public class SimWebSocketServer extends WebSocketServer {

    public SimWebSocketServer(int port) {
        super(new InetSocketAddress(port));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("Viewer connected");
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println("Viewer disconnected");
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
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
}