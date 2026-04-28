package com.mparkersierra.ftcsim.runner.teamcode;

import java.nio.file.Path;

public class TeamCodeWorkspace {
    private static final Path SOURCE_PACKAGE_PATH = Path.of(
        "src",
        "main",
        "java",
        "org",
        "firstinspires",
        "ftc",
        "teamcode"
    );

    private static final Path CLASS_OUTPUT_PATH = Path.of("build", "classes", "java", "main");
    private static final Path NEXT_CLASS_OUTPUT_PATH = Path.of("build", "classes", "java", "main-next");

    private final Path root;

    public TeamCodeWorkspace(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    public Path sourceRoot() {
        return root.resolve(SOURCE_PACKAGE_PATH);
    }

    public Path classOutputRoot() {
        return root.resolve(CLASS_OUTPUT_PATH);
    }

    public Path nextClassOutputRoot() {
        return root.resolve(NEXT_CLASS_OUTPUT_PATH);
    }
}
