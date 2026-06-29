package dev.cadmotion.backend.conversion;

import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public record ConversionRequest(
    Path stepPath,
    String jobName,
    boolean preview,
    String qualityPreset,
    String skipPattern,
    String expandPattern,
    double minBboxMm,
    double linearDeflection,
    double angularDeflection) {
  private static final Pattern STRING_FIELD =
      Pattern.compile("\"([A-Za-z0-9_]+)\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");

  public static ConversionRequest fromJson(String json) {
    String stepPath = null;
    String jobName = null;
    String qualityPreset = "balanced";
    String skipPattern = "";
    String expandPattern = "chassis";
    boolean preview = false;
    double minBboxMm = 0;
    double linearDeflection = 0;
    double angularDeflection = 0;

    Matcher matcher = STRING_FIELD.matcher(json);
    while (matcher.find()) {
      String key = matcher.group(1);
      String value = unescape(matcher.group(2));

      if ("stepPath".equals(key)) {
        stepPath = value;
      } else if ("jobName".equals(key)) {
        jobName = value;
      } else if ("qualityPreset".equals(key)) {
        qualityPreset = value;
      } else if ("skipPattern".equals(key)) {
        skipPattern = value;
      } else if ("expandPattern".equals(key)) {
        expandPattern = value;
      }
    }

    preview = json.matches("(?s).*\"preview\"\\s*:\\s*true.*");

    Matcher numberMatcher =
        Pattern.compile("\"minBboxMm\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)").matcher(json);
    if (numberMatcher.find()) {
      minBboxMm = Double.parseDouble(numberMatcher.group(1));
    }

    Matcher linearMatcher =
        Pattern.compile("\"linearDeflection\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)").matcher(json);
    if (linearMatcher.find()) {
      linearDeflection = Double.parseDouble(linearMatcher.group(1));
    }

    Matcher angularMatcher =
        Pattern.compile("\"angularDeflection\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)").matcher(json);
    if (angularMatcher.find()) {
      angularDeflection = Double.parseDouble(angularMatcher.group(1));
    }

    if (stepPath == null || stepPath.isBlank()) {
      throw new IllegalArgumentException("Missing required JSON field: stepPath");
    }

    return new ConversionRequest(
        Path.of(stepPath),
        jobName,
        preview,
        qualityPreset,
        skipPattern,
        expandPattern,
        minBboxMm,
        linearDeflection,
        angularDeflection);
  }

  public ConversionOptions options() {
    return new ConversionOptions(
        preview,
        qualityPreset,
        skipPattern,
        expandPattern,
        minBboxMm,
        linearDeflection,
        angularDeflection);
  }

  private static String unescape(String value) {
    return value
        .replace("\\\"", "\"")
        .replace("\\\\", "\\")
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t");
  }
}
