package com.mparkersierra.ftcsim.runner.simulation;

@FunctionalInterface
public interface RobotStateBroadcaster {
    void broadcast(double x, double y, double heading);
}
