package dev.cadmotion.backend;

public final class Json {
  private Json() {}

  public static String quote(String value) {
    if (value == null) {
      return "null";
    }

    StringBuilder builder = new StringBuilder(value.length() + 2);
    builder.append('"');

    for (int index = 0; index < value.length(); index++) {
      char character = value.charAt(index);

      switch (character) {
        case '"' -> builder.append("\\\"");
        case '\\' -> builder.append("\\\\");
        case '\b' -> builder.append("\\b");
        case '\f' -> builder.append("\\f");
        case '\n' -> builder.append("\\n");
        case '\r' -> builder.append("\\r");
        case '\t' -> builder.append("\\t");
        default -> {
          if (character < 0x20) {
            builder.append(String.format("\\u%04x", (int) character));
          } else {
            builder.append(character);
          }
        }
      }
    }

    builder.append('"');
    return builder.toString();
  }
}
