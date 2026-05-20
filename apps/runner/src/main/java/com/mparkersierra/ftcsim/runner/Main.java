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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class Main {
    private static final String TEAMCODE_COMPILE_ERROR_PREFIX = "TEAMCODE_COMPILE_ERROR: ";
    private static final long TELEMETRY_BROADCAST_INTERVAL_MILLIS = 50;
    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws Exception {
        TeamCodeWorkspace teamCodeWorkspace = new TeamCodeWorkspace(teamCodeRoot(args));
        System.out.println("Using TeamCode workspace: " + teamCodeWorkspace.root());

        boolean compiled = new TeamCodeCompiler(teamCodeWorkspace).compile();
        if (!compiled) {
            System.err.println(
                TEAMCODE_COMPILE_ERROR_PREFIX + "TeamCode compilation failed. Starting runner without updated op modes."
            );
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

        Telemetry telemetry = new Telemetry();
        OpModeManager opModeManager =
            new OpModeManager(
                hardwareRegistry,
                telemetry,
                new OpModeScanner(teamCodeWorkspace.classOutputRoot())
            );

        RobotPose robotPose = new RobotPose();

        SimWebSocketServer server =
            new SimWebSocketServer(port(args), opModeManager, robotPose, hardwareRegistry);
        telemetry.setSink(server::broadcastTelemetry);
        ScheduledExecutorService telemetryBroadcaster = startTelemetryBroadcaster(telemetry);
            
        server.setReuseAddr(true); 
        server.start();

        try {
            new DrivetrainSimulation(hardwareRegistry, robotPose, server::broadcastRobotState).run();
        } finally {
            telemetryBroadcaster.shutdownNow();
        }
    }

    private static ScheduledExecutorService startTelemetryBroadcaster(Telemetry telemetry) {
        ScheduledExecutorService executor =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "TelemetryBroadcaster");
                thread.setDaemon(true);
                return thread;
            });

        executor.scheduleAtFixedRate(
            () -> flushTelemetry(telemetry),
            0,
            TELEMETRY_BROADCAST_INTERVAL_MILLIS,
            TimeUnit.MILLISECONDS
        );

        return executor;
    }

    private static void flushTelemetry(Telemetry telemetry) {
        try {
            telemetry.flush();
        } catch (RuntimeException e) {
            e.printStackTrace();
        }
    }

    private static Path teamCodeRoot(String[] args) {
        String value = optionValue(args, "--teamcode-root");
        if (!value.isBlank()) {
            return Path.of(value);
        }

        return Path.of("TeamCode");
    }

    private static int port(String[] args) {
        String value = optionValue(args, "--port");
        if (value.isBlank()) {
            return DEFAULT_PORT;
        }

        try {
            int port = Integer.parseInt(value);
            if (port < 1 || port > 65535) {
                throw new IllegalArgumentException("Port out of range: " + value);
            }
            return port;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("Invalid --port value: " + value, error);
        }
    }

    private static String optionValue(String[] args, String option) {
        for (int i = 0; i < args.length - 1; i++) {
            if (option.equals(args[i])) {
                return args[i + 1];
            }
        }

        return "";
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
