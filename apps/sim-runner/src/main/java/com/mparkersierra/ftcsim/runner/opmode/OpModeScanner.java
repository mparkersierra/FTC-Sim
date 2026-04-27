package com.mparkersierra.ftcsim.runner.opmode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class OpModeScanner {
    private static final String BASE_PACKAGE = "org.firstinspires.ftc.teamcode";

    private final Path classOutputRoot;
    private URLClassLoader classLoader;

    public OpModeScanner(Path classOutputRoot) {
        this.classOutputRoot = classOutputRoot.toAbsolutePath().normalize();
    }

    public List<OpModeInfo> scan() {
        List<OpModeInfo> results = new ArrayList<>();

        File root = classOutputRoot
            .resolve("org")
            .resolve("firstinspires")
            .resolve("ftc")
            .resolve("teamcode")
            .toFile();

        if (!root.exists()) {
            System.out.println("TeamCode classes folder not found: " + root.getAbsolutePath());
            return results;
        }

        try {
            refreshClassLoader();
            scanDirectory(root, BASE_PACKAGE, results);
        } catch (Exception error) {
            error.printStackTrace();
        }

        return results;
    }

    private void refreshClassLoader() throws Exception {
        if (classLoader != null) {
            classLoader.close();
        }

        classLoader = new URLClassLoader(
            new URL[] { classOutputRoot.toUri().toURL() },
            OpModeScanner.class.getClassLoader()
        );
    }

    private void scanDirectory(File dir, String packageName, List<OpModeInfo> results) {
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (file.isDirectory()) {
                scanDirectory(file, packageName + "." + file.getName(), results);
            } else if (file.getName().endsWith(".class")) {
                String className = packageName + "." + file.getName().replace(".class", "");
                inspectClass(className, results);
            }
        }
    }

    private void inspectClass(String className, List<OpModeInfo> results) {
        try {
            Class<?> clazz = Class.forName(className, true, classLoader);

            TeleOp teleOp = clazz.getAnnotation(TeleOp.class);
            Autonomous autonomous = clazz.getAnnotation(Autonomous.class);

            if (teleOp != null) {
                results.add(new OpModeInfo(
                    className,
                    teleOp.name().isEmpty() ? clazz.getSimpleName() : teleOp.name(),
                    teleOp.group(),
                    "TeleOp",
                    clazz
                ));
            }

            if (autonomous != null) {
                results.add(new OpModeInfo(
                    className,
                    autonomous.name().isEmpty() ? clazz.getSimpleName() : autonomous.name(),
                    autonomous.group(),
                    "Autonomous",
                    clazz
                ));
            }

        } catch (Throwable ignored) {
        }
    }
}
