package dev.cadmotion.backend.http;

import java.util.Map;

public record MultipartForm(Map<String, String> fields, Map<String, UploadedFile> files) {
  public String field(String name) {
    return fields.get(name);
  }

  public UploadedFile file(String name) {
    return files.get(name);
  }
}
