package dev.cadmotion.backend.conversion;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;

public final class CadConversionService {
  private final StepToGlbConverter converter;
  private final Path generatedModelsRoot;
  private final Path uploadedStepsRoot;

  public CadConversionService(
      StepToGlbConverter converter, Path generatedModelsRoot, Path uploadedStepsRoot) {
    this.converter = converter;
    this.generatedModelsRoot = generatedModelsRoot;
    this.uploadedStepsRoot = uploadedStepsRoot;
  }

  public ConversionResult convertStep(ConversionRequest request)
      throws IOException, InterruptedException {
    Instant startedAt = Instant.now();
    Path stepFile = request.stepPath().toAbsolutePath().normalize();

    if (!Files.isRegularFile(stepFile)) {
      throw new IllegalArgumentException("STEP file does not exist: " + stepFile);
    }

    String jobName = sanitizeJobName(request.jobName(), stepFile);
    Path outputDirectory = generatedModelsRoot.resolve(jobName).normalize();
    Files.createDirectories(outputDirectory);

    log(
        "Starting STEP conversion job="
            + jobName
            + " input="
            + stepFile
            + " size="
            + readableBytes(Files.size(stepFile))
            + " outputDir="
            + outputDirectory);

    ConversionResult result = converter.convert(stepFile, outputDirectory, jobName, request.options());

    if (result.parts().isEmpty()) {
      throw new IllegalStateException("Conversion completed but produced no selectable parts.");
    }

    log(
        "Finished STEP conversion job="
            + jobName
            + " parts="
            + result.parts().size()
            + " modelUrl="
            + result.modelUrl()
            + " elapsed="
            + elapsed(startedAt));

    return result;
  }

  public ConversionResult convertUploadedStep(
      String originalFileName,
      byte[] bytes,
      String requestedJobName,
      ConversionOptions options)
      throws IOException, InterruptedException {
    Instant startedAt = Instant.now();
    if (bytes == null || bytes.length == 0) {
      throw new IllegalArgumentException("Uploaded STEP file is empty.");
    }

    String safeFileName = sanitizeFileName(originalFileName);
    String jobName = sanitizeJobName(requestedJobName, Path.of(safeFileName));
    Path uploadDirectory = uploadedStepsRoot.resolve(jobName).normalize();
    Files.createDirectories(uploadDirectory);

    Path uploadedStepFile = uploadDirectory.resolve(safeFileName).normalize();
    Files.write(
        uploadedStepFile,
        bytes,
        StandardOpenOption.CREATE,
        StandardOpenOption.TRUNCATE_EXISTING,
        StandardOpenOption.WRITE);

    log(
        "Saved uploaded STEP file originalName="
            + originalFileName
            + " savedAs="
            + uploadedStepFile
            + " size="
            + readableBytes(bytes.length)
            + " elapsed="
            + elapsed(startedAt));

    return convertStep(
        new ConversionRequest(
            uploadedStepFile,
            jobName,
            options.preview(),
            options.qualityPreset(),
            options.skipPattern(),
            options.expandPattern(),
            options.minBboxMm(),
            options.linearDeflection(),
            options.angularDeflection()));
  }

  public InspectResult inspectUploadedStep(String originalFileName, byte[] bytes, String requestedJobName)
      throws IOException, InterruptedException {
    if (!(converter instanceof OcctStepToGlbConverter occtConverter)) {
      throw new IllegalStateException("STEP inspection requires the OCCT converter.");
    }

    String safeFileName = sanitizeFileName(originalFileName);
    String jobName = sanitizeJobName(requestedJobName, Path.of(safeFileName));
    Path uploadDirectory = uploadedStepsRoot.resolve(jobName).normalize();
    Files.createDirectories(uploadDirectory);

    Path uploadedStepFile = uploadDirectory.resolve(safeFileName).normalize();
    Files.write(
        uploadedStepFile,
        bytes,
        StandardOpenOption.CREATE,
        StandardOpenOption.TRUNCATE_EXISTING,
        StandardOpenOption.WRITE);

    Path outputDirectory = generatedModelsRoot.resolve(jobName).normalize();
    Files.createDirectories(outputDirectory);

    log(
        "Inspecting uploaded STEP originalName="
            + originalFileName
            + " savedAs="
            + uploadedStepFile
            + " size="
            + readableBytes(bytes.length));

    return occtConverter.inspect(uploadedStepFile, outputDirectory, jobName);
  }

  private static String sanitizeJobName(String requestedJobName, Path stepFile) {
    String fallback = stripExtension(stepFile.getFileName().toString());
    String source = requestedJobName == null || requestedJobName.isBlank() ? fallback : requestedJobName;
    String sanitized = source.replaceAll("[^A-Za-z0-9._-]", "_");

    return sanitized.isBlank() ? "converted-step" : sanitized;
  }

  private static String stripExtension(String fileName) {
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex <= 0 ? fileName : fileName.substring(0, dotIndex);
  }

  private static String sanitizeFileName(String fileName) {
    String fallback = "uploaded.step";
    String source = fileName == null || fileName.isBlank() ? fallback : fileName;
    String baseName = Path.of(source).getFileName().toString();
    String sanitized = baseName.replaceAll("[^A-Za-z0-9._-]", "_");

    return sanitized.isBlank() ? fallback : sanitized;
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
