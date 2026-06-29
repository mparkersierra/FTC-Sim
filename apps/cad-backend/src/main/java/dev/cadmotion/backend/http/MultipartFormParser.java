package dev.cadmotion.backend.http;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MultipartFormParser {
  private static final Pattern BOUNDARY_PATTERN = Pattern.compile("boundary=\"?([^\";]+)\"?");
  private static final Pattern NAME_PATTERN = Pattern.compile("name=\"([^\"]+)\"");
  private static final Pattern FILENAME_PATTERN = Pattern.compile("filename=\"([^\"]*)\"");

  private MultipartFormParser() {}

  public static MultipartForm parse(String contentType, byte[] body) {
    String boundary = extractBoundary(contentType);
    String payload = new String(body, StandardCharsets.ISO_8859_1);
    String[] rawParts = payload.split(Pattern.quote("--" + boundary));

    Map<String, String> fields = new HashMap<>();
    Map<String, UploadedFile> files = new HashMap<>();

    for (String rawPart : rawParts) {
      if (rawPart.isBlank() || rawPart.startsWith("--")) {
        continue;
      }

      String part = stripLeadingNewline(rawPart);
      int separatorIndex = part.indexOf("\r\n\r\n");
      if (separatorIndex < 0) {
        continue;
      }

      String headers = part.substring(0, separatorIndex);
      String content = stripTrailingNewline(part.substring(separatorIndex + 4));
      String disposition = header(headers, "content-disposition");
      String name = attribute(disposition, NAME_PATTERN);

      if (name == null || name.isBlank()) {
        continue;
      }

      String filename = attribute(disposition, FILENAME_PATTERN);
      if (filename != null && !filename.isBlank()) {
        files.put(name, new UploadedFile(filename, content.getBytes(StandardCharsets.ISO_8859_1)));
      } else {
        fields.put(name, content);
      }
    }

    return new MultipartForm(fields, files);
  }

  private static String extractBoundary(String contentType) {
    if (contentType == null) {
      throw new IllegalArgumentException("Missing Content-Type header.");
    }

    Matcher matcher = BOUNDARY_PATTERN.matcher(contentType);
    if (!matcher.find()) {
      throw new IllegalArgumentException("Multipart request is missing a boundary.");
    }

    return matcher.group(1);
  }

  private static String header(String headers, String headerName) {
    for (String line : headers.split("\r\n")) {
      int colonIndex = line.indexOf(':');
      if (colonIndex <= 0) {
        continue;
      }

      String name = line.substring(0, colonIndex).trim();
      if (headerName.equalsIgnoreCase(name)) {
        return line.substring(colonIndex + 1).trim();
      }
    }

    return "";
  }

  private static String attribute(String header, Pattern pattern) {
    Matcher matcher = pattern.matcher(header);
    return matcher.find() ? matcher.group(1) : null;
  }

  private static String stripLeadingNewline(String value) {
    return value.startsWith("\r\n") ? value.substring(2) : value;
  }

  private static String stripTrailingNewline(String value) {
    if (value.endsWith("\r\n")) {
      return value.substring(0, value.length() - 2);
    }

    return value;
  }
}
