package dev.cadmotion.backend.conversion;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class OcctStepToGlbConverter implements StepToGlbConverter {
  private final Path converterExecutable;

  public OcctStepToGlbConverter(Path converterExecutable) {
    this.converterExecutable = converterExecutable;
  }

  public InspectResult inspect(Path stepFile, Path outputDirectory, String jobName)
      throws IOException, InterruptedException {
    Files.createDirectories(outputDirectory);

    Path treePath = outputDirectory.resolve("step-tree.txt");
    List<String> command = new ArrayList<>();
    command.add(converterExecutable.toString());
    command.add("--input");
    command.add(stepFile.toString());
    command.add("--inspect-tree");
    command.add(treePath.toString());

    log("Launching OCCT inspect executable=" + converterExecutable);
    run(command);

    if (!Files.isRegularFile(treePath)) {
      throw new IOException("OCCT inspector did not create tree output: " + treePath);
    }

    String treeText = Files.readString(treePath, StandardCharsets.UTF_8);
    return new InspectResult("/models/generated/" + jobName + "/step-tree.txt", treeText);
  }

  @Override
  public ConversionResult convert(
      Path stepFile, Path outputDirectory, String jobName, ConversionOptions options)
      throws IOException, InterruptedException {
    Instant startedAt = Instant.now();
    Files.createDirectories(outputDirectory);

    Path glbPath = outputDirectory.resolve(jobName + ".glb");
    Path manifestPath = outputDirectory.resolve("manifest.tsv");

    List<String> command = new ArrayList<>();
    command.add(converterExecutable.toString());
    command.add("--input");
    command.add(stepFile.toString());
    command.add("--output");
    command.add(glbPath.toString());
    command.add("--manifest");
    command.add(manifestPath.toString());
    command.add("--selection-depth");
    command.add("1");

    if (options.preview()) {
      command.add("--preview");
    }

    if (options.linearDeflection() > 0) {
      command.add("--linear-deflection");
      command.add(Double.toString(options.linearDeflection()));
    }

    if (options.angularDeflection() > 0) {
      command.add("--angular-deflection");
      command.add(Double.toString(options.angularDeflection()));
    }

    if (options.skipPattern() != null && !options.skipPattern().isBlank()) {
      command.add("--skip-pattern");
      command.add(options.skipPattern());
    }

    if (options.expandPattern() != null && !options.expandPattern().isBlank()) {
      command.add("--expand-pattern");
      command.add(options.expandPattern());
    }

    if (options.minBboxMm() > 0) {
      command.add("--min-bbox");
      command.add(Double.toString(options.minBboxMm()));
    }

    log(
        "Launching OCCT converter executable="
            + converterExecutable
            + " preview="
            + options.preview()
            + " qualityPreset="
            + options.qualityPreset()
            + " skipPattern="
            + options.skipPattern()
            + " expandPattern="
            + options.expandPattern()
            + " minBboxMm="
            + options.minBboxMm()
            + " linearDeflection="
            + options.linearDeflection()
            + " angularDeflection="
            + options.angularDeflection());
    run(command);
    log("OCCT converter process completed elapsed=" + elapsed(startedAt));

    if (!Files.isRegularFile(glbPath)) {
      throw new IOException("OCCT converter did not create GLB output: " + glbPath);
    }

    optimizeGlbIfAvailable(glbPath, outputDirectory, options);

    if (!Files.isRegularFile(manifestPath)) {
      throw new IOException("OCCT converter did not create part manifest: " + manifestPath);
    }

    List<ConversionPart> parts = readManifest(manifestPath);
    log(
        "Read manifest parts="
            + parts.size()
            + " glbSize="
            + readableBytes(Files.size(glbPath))
            + " manifest="
            + manifestPath);
    String modelUrl = "/models/generated/" + jobName + "/" + glbPath.getFileName();
    return new ConversionResult(modelUrl, parts);
  }

  private static void run(List<String> command) throws IOException, InterruptedException {
    ProcessBuilder processBuilder = new ProcessBuilder(command);
    processBuilder.redirectErrorStream(true);

    Process process;
    try {
      process = processBuilder.start();
    } catch (IOException exception) {
      throw new IOException(
          "Unable to start OCCT converter. Build it first with `cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build && cmake --build native/cad-step-to-glb/build`. Tried: "
              + command.get(0),
          exception);
    }

    StringBuilder output = new StringBuilder();
    Thread outputThread = streamProcessOutput(process.getInputStream(), output);
    int exitCode = process.waitFor();
    outputThread.join();

    if (exitCode != 0) {
      throw new IOException(
          "OCCT converter failed with exit code "
              + exitCode
              + ": "
              + String.join(" ", command)
              + "\n"
              + output);
    }
  }

  private static Thread streamProcessOutput(InputStream inputStream, StringBuilder capturedOutput) {
    Thread thread =
        new Thread(
            () -> {
              try (inputStream) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = inputStream.read(buffer)) != -1) {
                  String text = new String(buffer, 0, read);
                  synchronized (capturedOutput) {
                    capturedOutput.append(text);
                  }
                  System.out.print(text);
                }
              } catch (IOException exception) {
                System.out.println("[cad-backend] Failed reading converter output: " + exception.getMessage());
              }
            },
            "occt-converter-output");
    thread.setDaemon(true);
    thread.start();
    return thread;
  }

  private static List<ConversionPart> readManifest(Path manifest) throws IOException {
    List<ConversionPart> parts = new ArrayList<>();

    for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
      if (line.isBlank()) {
        continue;
      }

      String[] columns = line.split("\t", -1);
      if (columns.length >= 2) {
        parts.add(new ConversionPart(columns[0], columns[1]));
      }
    }

    return parts;
  }

  private static void optimizeGlbIfAvailable(
      Path glbPath, Path outputDirectory, ConversionOptions options) {
    Path optimizer = findGltfTransform(outputDirectory);
    if (optimizer == null) {
      log("Skipping GLB optimization because gltf-transform was not found under apps/desktop/node_modules/.bin");
      return;
    }

    Path optimizedPath = glbPath.resolveSibling(stripExtension(glbPath.getFileName().toString()) + ".optimized.glb");
    List<String> command = new ArrayList<>();
    command.add(optimizer.toString());
    command.add("optimize");
    command.add(glbPath.toString());
    command.add(optimizedPath.toString());
    command.add("--compress");
    command.add("meshopt");
    command.add("--flatten");
    command.add("false");
    command.add("--join");
    command.add("false");
    command.add("--instance");
    command.add("false");
    command.add("--texture-compress");
    command.add("false");
    command.add("--simplify");
    command.add("true");
    command.add("--simplify-ratio");
    command.add(simplifyRatio(options.qualityPreset()));
    command.add("--simplify-error");
    command.add(simplifyError(options.qualityPreset()));

    try {
      long originalSize = Files.size(glbPath);
      log("Starting GLB optimization qualityPreset=" + options.qualityPreset());
      run(command);
      Files.move(optimizedPath, glbPath, StandardCopyOption.REPLACE_EXISTING);
      log(
          "Finished GLB optimization originalSize="
              + readableBytes(originalSize)
              + " optimizedSize="
              + readableBytes(Files.size(glbPath)));
    } catch (Exception exception) {
      try {
        Files.deleteIfExists(optimizedPath);
      } catch (IOException deleteException) {
        log("Failed cleaning optimized GLB: " + deleteException.getMessage());
      }
      log("GLB optimization failed; using unoptimized OCCT output: " + exception.getMessage());
    }
  }

  private static Path findGltfTransform(Path outputDirectory) {
    Path current = outputDirectory.toAbsolutePath().normalize();

    while (current != null) {
      Path candidate = current.resolve("apps/desktop/node_modules/.bin/gltf-transform");
      if (Files.isExecutable(candidate)) {
        return candidate;
      }

      current = current.getParent();
    }

    return null;
  }

  private static String simplifyRatio(String qualityPreset) {
    return switch (qualityPreset == null ? "" : qualityPreset.toLowerCase()) {
      case "detailed" -> "0.9";
      case "balanced" -> "0.55";
      default -> "0.35";
    };
  }

  private static String simplifyError(String qualityPreset) {
    return switch (qualityPreset == null ? "" : qualityPreset.toLowerCase()) {
      case "detailed" -> "0.0002";
      case "balanced" -> "0.0008";
      default -> "0.002";
    };
  }

  private static String stripExtension(String fileName) {
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex <= 0 ? fileName : fileName.substring(0, dotIndex);
  }

  private static void log(String message) {
    System.out.println("[cad-backend] " + message);
  }

  private static String elapsed(Instant startedAt) {
    Duration duration = Duration.between(startedAt, Instant.now());
    long seconds = duration.toSeconds();
    long millis = duration.toMillisPart();
    return seconds + "." + String.format("%03d", millis) + "s";
  }

  private static String readableBytes(long bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }

    double kib = bytes / 1024.0;
    if (kib < 1024) {
      return String.format("%.1f KiB", kib);
    }

    double mib = kib / 1024.0;
    if (mib < 1024) {
      return String.format("%.1f MiB", mib);
    }

    return String.format("%.1f GiB", mib / 1024.0);
  }
}
