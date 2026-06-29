package dev.cadmotion.backend.conversion;

public record ConversionOptions(
    boolean preview,
    String qualityPreset,
    String skipPattern,
    String expandPattern,
    double minBboxMm,
    double linearDeflection,
    double angularDeflection) {
  public static ConversionOptions defaults() {
    return new ConversionOptions(false, "balanced", "", "chassis", 0, 0, 0);
  }
}
