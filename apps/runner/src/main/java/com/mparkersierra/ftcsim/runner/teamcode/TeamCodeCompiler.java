package com.mparkersierra.ftcsim.runner.teamcode;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

public class TeamCodeCompiler {
    private static final String DIAGNOSTIC_PREFIX = "TEAMCODE_COMPILE_ERROR: ";
    private static final String STATUS_PREFIX = "TEAMCODE_COMPILE_STATUS: ";
    private static final DateTimeFormatter TIMESTAMP_FORMAT =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final TeamCodeWorkspace workspace;

    public TeamCodeCompiler(TeamCodeWorkspace workspace) {
        this.workspace = workspace;
    }

    public boolean compile() {
        long startedAt = System.nanoTime();

        try {
            Files.createDirectories(workspace.sourceRoot());

            List<Path> sourceFiles = findSourceFiles();
            if (sourceFiles.isEmpty()) {
                deleteTree(workspace.classOutputRoot());
                deleteTree(workspace.nextClassOutputRoot());
                System.out.println("TeamCode workspace has no Java files: " + workspace.sourceRoot());
                printCompileSuccess(startedAt, "No Java files found.");
                return true;
            }

            deleteTree(workspace.nextClassOutputRoot());
            Files.createDirectories(workspace.nextClassOutputRoot());

            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            if (compiler == null) {
                printCompileError(
                    "No Java compiler is available. Bundle a runtime that includes the jdk.compiler module."
                );
                return false;
            }

            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            try (StandardJavaFileManager fileManager =
                     compiler.getStandardFileManager(diagnostics, null, null)) {
                Iterable<? extends JavaFileObject> units =
                    fileManager.getJavaFileObjectsFromPaths(sourceFiles);

                List<String> options = List.of(
                    "-classpath",
                    System.getProperty("java.class.path"),
                    "-d",
                    workspace.nextClassOutputRoot().toString()
                );

                boolean ok = compiler.getTask(null, fileManager, diagnostics, options, null, units).call();
                printDiagnostics(diagnostics);

                if (ok) {
                    replaceClassOutput();
                    printCompileSuccess(startedAt, "Compiled " + sourceFiles.size() + " Java file(s).");
                }

                return ok;
            }
        } catch (IOException error) {
            printCompileError(error.getMessage());
            return false;
        }
    }

    private List<Path> findSourceFiles() throws IOException {
        if (!Files.exists(workspace.sourceRoot())) {
            return List.of();
        }

        try (Stream<Path> stream = Files.walk(workspace.sourceRoot())) {
            return stream
                .filter(path -> path.toString().endsWith(".java"))
                .sorted()
                .toList();
        }
    }

    private void replaceClassOutput() throws IOException {
        deleteTree(workspace.classOutputRoot());
        Files.createDirectories(workspace.classOutputRoot().getParent());
        Files.move(workspace.nextClassOutputRoot(), workspace.classOutputRoot());
    }

    private void deleteTree(Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }

        List<Path> paths = new ArrayList<>();
        try (Stream<Path> stream = Files.walk(root)) {
            stream.sorted(Comparator.reverseOrder()).forEach(paths::add);
        }

        for (Path path : paths) {
            Files.deleteIfExists(path);
        }
    }

    private void printDiagnostics(DiagnosticCollector<JavaFileObject> diagnostics) {
        for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
            if (diagnostic.getKind() == Diagnostic.Kind.ERROR) {
                printCompileError(formatDiagnostic(diagnostic));
            }
        }
    }

    private String formatDiagnostic(Diagnostic<? extends JavaFileObject> diagnostic) {
        String location = "TeamCode";

        if (diagnostic.getSource() != null) {
            try {
                Path sourcePath = Path.of(diagnostic.getSource().toUri()).toAbsolutePath().normalize();
                Path relativePath = workspace.sourceRoot().relativize(sourcePath);
                location = relativePath.toString();
            } catch (IllegalArgumentException error) {
                location = diagnostic.getSource().getName();
            }
        }

        if (diagnostic.getLineNumber() > 0) {
            location += ":" + diagnostic.getLineNumber();
            if (diagnostic.getColumnNumber() > 0) {
                location += ":" + diagnostic.getColumnNumber();
            }
        }

        String message = diagnostic.getMessage(Locale.getDefault()).replaceAll("\\s+", " ").trim();
        return location + ": error: " + message;
    }

    private void printCompileError(String message) {
        System.err.println(DIAGNOSTIC_PREFIX + message);
    }

    private void printCompileSuccess(long startedAt, String detail) {
        long elapsedMillis = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        System.out.println(
            STATUS_PREFIX
                + "Build successful at "
                + LocalDateTime.now().format(TIMESTAMP_FORMAT)
                + " ("
                + elapsedMillis
                + " ms). "
                + detail
        );
    }
}
