package dev.cadmotion.backend.conversion;

import java.io.IOException;
import java.nio.file.Path;

public interface StepToGlbConverter {
  ConversionResult convert(
      Path stepFile, Path outputDirectory, String jobName, ConversionOptions options)
      throws IOException, InterruptedException;
}
