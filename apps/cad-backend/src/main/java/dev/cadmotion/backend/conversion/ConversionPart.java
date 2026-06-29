package dev.cadmotion.backend.conversion;

import dev.cadmotion.backend.Json;

public record ConversionPart(String name, String nodeName) {
  public String toJson() {
    return "{\"name\":"
        + Json.quote(name)
        + ",\"nodeName\":"
        + Json.quote(nodeName)
        + "}";
  }
}
