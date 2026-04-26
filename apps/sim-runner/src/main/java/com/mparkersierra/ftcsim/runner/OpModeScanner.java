package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class OpModeScanner {
    private static final String BASE_PACKAGE = "org.firstinspires.ftc.teamcode";
    private static final String BASE_PATH = "vendor/TeamCode/build/classes/java/main/org/firstinspires/ftc/teamcode";

    public static List<OpModeInfo> scan() {
        List<OpModeInfo> results = new ArrayList<>();

        File root = new File(BASE_PATH);

        if (!root.exists()) {
            System.out.println("TeamCode classes folder not found: " + root.getAbsolutePath());
            return results;
        }

        scanDirectory(root, BASE_PACKAGE, results);
        return results;
    }

    private static void scanDirectory(File dir, String packageName, List<OpModeInfo> results) {
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

    private static void inspectClass(String className, List<OpModeInfo> results) {
        try {
            Class<?> clazz = Class.forName(className);

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