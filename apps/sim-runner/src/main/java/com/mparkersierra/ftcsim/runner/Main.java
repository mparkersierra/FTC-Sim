package com.mparkersierra.ftcsim.runner;

import com.mparkersierra.ftcsim.runner.hardware.SimHardwareRegistry;
import com.mparkersierra.ftcsim.runner.network.SimWebSocketServer;
import com.mparkersierra.ftcsim.runner.opmode.OpModeManager;
import com.mparkersierra.ftcsim.runner.simulation.DrivetrainSimulation;
import com.mparkersierra.ftcsim.runner.simulation.RobotPose;
import org.firstinspires.ftc.robotcore.external.Telemetry;

public class Main {
    public static void main(String[] args) throws Exception {
        SimHardwareRegistry hardwareRegistry = new SimHardwareRegistry();

        hardwareRegistry.addDevice("DcMotor", "leftFront");
        hardwareRegistry.addDevice("DcMotor", "rightFront");
        hardwareRegistry.addDevice("DcMotor", "leftBack");
        hardwareRegistry.addDevice("DcMotor", "rightBack");

        OpModeManager opModeManager =
            new OpModeManager(hardwareRegistry.getHardwareMap(), new Telemetry());

        RobotPose robotPose = new RobotPose();

        SimWebSocketServer server =
            new SimWebSocketServer(8080, opModeManager, robotPose, hardwareRegistry);
            
        server.setReuseAddr(true); 
        server.start();

        new DrivetrainSimulation(hardwareRegistry, robotPose, server::broadcastRobotState).run();
    }
}
