package dev.cadmotion.backend.conversion;

import dev.cadmotion.backend.Json;

public record InspectResult(String treeUrl, String treeText) {
  public String toJson() {
    return "{\"treeUrl\":"
        + Json.quote(treeUrl)
        + ",\"treeText\":"
        + Json.quote(treeText)
        + "}";
  }
}
