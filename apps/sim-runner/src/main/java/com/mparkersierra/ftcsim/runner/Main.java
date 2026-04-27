package com.mparkersierra.ftcsim.runner;

import com.mparkersierra.ftcsim.runner.hardware.SimHardwareRegistry;
import com.mparkersierra.ftcsim.runner.network.SimWebSocketServer;
import com.mparkersierra.ftcsim.runner.opmode.OpModeManager;
import com.mparkersierra.ftcsim.runner.opmode.OpModeScanner;
import com.mparkersierra.ftcsim.runner.simulation.DrivetrainSimulation;
import com.mparkersierra.ftcsim.runner.simulation.RobotPose;
import com.mparkersierra.ftcsim.runner.teamcode.TeamCodeCompiler;
import com.mparkersierra.ftcsim.runner.teamcode.TeamCodeWorkspace;
import org.firstinspires.ftc.robotcore.external.Telemetry;

import java.nio.file.Path;

public class Main {
    public static void main(String[] args) throws Exception {
        TeamCodeWorkspace teamCodeWorkspace = new TeamCodeWorkspace(teamCodeRoot(args));
        System.out.println("Using TeamCode workspace: " + teamCodeWorkspace.root());

        boolean compiled = new TeamCodeCompiler(teamCodeWorkspace).compile();
        if (!compiled) {
            System.err.println("TeamCode compilation failed. Starting runner without updated op modes.");
            if (hasFlag(args, "--compile-only")) {
                System.exit(1);
            }
        }

        if (hasFlag(args, "--compile-only")) {
            return;
        }

        SimHardwareRegistry hardwareRegistry = new SimHardwareRegistry();

        hardwareRegistry.addDevice("DcMotor", "leftFront");
        hardwareRegistry.addDevice("DcMotor", "rightFront");
        hardwareRegistry.addDevice("DcMotor", "leftBack");
        hardwareRegistry.addDevice("DcMotor", "rightBack");

        OpModeManager opModeManager =
            new OpModeManager(
                hardwareRegistry.getHardwareMap(),
                new Telemetry(),
                new OpModeScanner(teamCodeWorkspace.classOutputRoot())
            );

        RobotPose robotPose = new RobotPose();

        SimWebSocketServer server =
            new SimWebSocketServer(8080, opModeManager, robotPose, hardwareRegistry);
            
        server.setReuseAddr(true); 
        server.start();

        new DrivetrainSimulation(hardwareRegistry, robotPose, server::broadcastRobotState).run();
    }

    private static Path teamCodeRoot(String[] args) {
        for (int i = 0; i < args.length - 1; i++) {
            if ("--teamcode-root".equals(args[i])) {
                return Path.of(args[i + 1]);
            }
        }

        return Path.of("TeamCode");
    }

    private static boolean hasFlag(String[] args, String flag) {
        for (String arg : args) {
            if (flag.equals(arg)) {
                return true;
            }
        }

        return false;
    }
}
