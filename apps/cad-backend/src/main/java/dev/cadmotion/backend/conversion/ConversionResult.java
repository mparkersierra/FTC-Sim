package dev.cadmotion.backend.conversion;

import dev.cadmotion.backend.Json;
import java.util.List;
import java.util.stream.Collectors;

public record ConversionResult(String modelUrl, List<ConversionPart> parts) {
  public String toJson() {
    String partsJson = parts.stream().map(ConversionPart::toJson).collect(Collectors.joining(","));
    return "{\"modelUrl\":" + Json.quote(modelUrl) + ",\"parts\":[" + partsJson + "]}";
  }
}
