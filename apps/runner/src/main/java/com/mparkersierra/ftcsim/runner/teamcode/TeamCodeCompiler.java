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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public class TeamCodeCompiler {
    private final TeamCodeWorkspace workspace;

    public TeamCodeCompiler(TeamCodeWorkspace workspace) {
        this.workspace = workspace;
    }

    public boolean compile() {
        try {
            Files.createDirectories(workspace.sourceRoot());

            List<Path> sourceFiles = findSourceFiles();
            if (sourceFiles.isEmpty()) {
                deleteTree(workspace.classOutputRoot());
                deleteTree(workspace.nextClassOutputRoot());
                System.out.println("TeamCode workspace has no Java files: " + workspace.sourceRoot());
                return true;
            }

            deleteTree(workspace.nextClassOutputRoot());
            Files.createDirectories(workspace.nextClassOutputRoot());

            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            if (compiler == null) {
                System.err.println(
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
                }

                return ok;
            }
        } catch (IOException error) {
            error.printStackTrace();
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
            System.err.println(diagnostic);
        }
    }
}
