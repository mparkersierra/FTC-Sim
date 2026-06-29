package dev.cadmotion.backend;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.cadmotion.backend.conversion.CadConversionService;
import dev.cadmotion.backend.conversion.ConversionOptions;
import dev.cadmotion.backend.conversion.ConversionRequest;
import dev.cadmotion.backend.conversion.ConversionResult;
import dev.cadmotion.backend.conversion.InspectResult;
import dev.cadmotion.backend.conversion.OcctStepToGlbConverter;
import dev.cadmotion.backend.http.MultipartForm;
import dev.cadmotion.backend.http.MultipartFormParser;
import dev.cadmotion.backend.http.UploadedFile;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Comparator;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.concurrent.Executors;

public final class CadMotionBackend {
  private static final int DEFAULT_PORT = 8087;

  private final CadConversionService conversionService;
  private final Path generatedModelsRoot;

  public CadMotionBackend(CadConversionService conversionService, Path generatedModelsRoot) {
    this.conversionService = conversionService;
    this.generatedModelsRoot = generatedModelsRoot;
  }

  public static void main(String[] args) throws IOException {
    CliOptions cliOptions = CliOptions.parse(args);
    Path projectRoot = resolveProjectRoot();
    Path dataRoot = cliOptions.dataRoot() == null ? resolveDataRoot(projectRoot) : cliOptions.dataRoot();
    Path generatedModelsRoot = dataRoot.resolve("models/generated").normalize();
    Path uploadedStepsRoot = dataRoot.resolve("uploads").normalize();
    Path occtConverter =
        cliOptions.converter() == null ? resolveOcctConverter(projectRoot) : cliOptions.converter();

    CadConversionService conversionService =
        new CadConversionService(
            new OcctStepToGlbConverter(occtConverter),
            generatedModelsRoot,
            uploadedStepsRoot);

    new CadMotionBackend(conversionService, generatedModelsRoot).start(cliOptions.port());
  }

  private void start(int port) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
    server.setExecutor(Executors.newCachedThreadPool());

    server.createContext("/api/health", this::handleHealth);
    server.createContext("/api/convert-step", this::handleConvertStep);
    server.createContext("/api/convert-step-upload", this::handleConvertStepUpload);
    server.createContext("/api/generated-models", this::handleGeneratedModels);
    server.createContext("/api/inspect-step-upload", this::handleInspectStepUpload);
    server.createContext("/models/generated", this::handleGeneratedModelFile);
    server.start();

    System.out.printf("CAD Motion backend listening on http://127.0.0.1:%d%n", port);
    System.out.printf("CAD Motion data root: %s%n", generatedModelsRoot.getParent().getParent());
  }

  private void handleHealth(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"GET".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    sendJson(exchange, 200, "{\"ok\":true}");
  }

  private void handleConvertStep(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"POST".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    try {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      ConversionRequest request = ConversionRequest.fromJson(body);
      ConversionResult result = conversionService.convertStep(request);
      sendJson(exchange, 200, result.toJson());
    } catch (IllegalArgumentException exception) {
      sendJson(exchange, 400, "{\"error\":\"bad_request\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    } catch (Exception exception) {
      sendJson(exchange, 500, "{\"error\":\"conversion_failed\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    }
  }

  private void handleConvertStepUpload(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"POST".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    try {
      String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
      byte[] body = exchange.getRequestBody().readAllBytes();
      MultipartForm form = MultipartFormParser.parse(contentType, body);
      UploadedFile stepFile = form.file("stepFile");

      if (stepFile == null) {
        throw new IllegalArgumentException("Missing multipart file field: stepFile");
      }

      ConversionOptions options =
          new ConversionOptions(
              Boolean.parseBoolean(form.field("preview")),
              form.field("qualityPreset") == null ? "balanced" : form.field("qualityPreset"),
              form.field("skipPattern") == null ? "" : form.field("skipPattern"),
              form.field("expandPattern") == null ? "chassis" : form.field("expandPattern"),
              parseDouble(form.field("minBboxMm"), 0),
              parseDouble(form.field("linearDeflection"), 0),
              parseDouble(form.field("angularDeflection"), 0));

      ConversionResult result =
          conversionService.convertUploadedStep(
              stepFile.fileName(), stepFile.bytes(), form.field("jobName"), options);
      sendJson(exchange, 200, result.toJson());
    } catch (IllegalArgumentException exception) {
      sendJson(exchange, 400, "{\"error\":\"bad_request\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    } catch (Exception exception) {
      sendJson(exchange, 500, "{\"error\":\"conversion_failed\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    }
  }

  private void handleInspectStepUpload(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"POST".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    try {
      String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
      byte[] body = exchange.getRequestBody().readAllBytes();
      MultipartForm form = MultipartFormParser.parse(contentType, body);
      UploadedFile stepFile = form.file("stepFile");

      if (stepFile == null) {
        throw new IllegalArgumentException("Missing multipart file field: stepFile");
      }

      InspectResult result =
          conversionService.inspectUploadedStep(stepFile.fileName(), stepFile.bytes(), form.field("jobName"));
      sendJson(exchange, 200, result.toJson());
    } catch (IllegalArgumentException exception) {
      sendJson(exchange, 400, "{\"error\":\"bad_request\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    } catch (Exception exception) {
      sendJson(exchange, 500, "{\"error\":\"inspection_failed\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    }
  }

  private void handleGeneratedModels(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"GET".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    try {
      sendJson(exchange, 200, "{\"models\":[" + generatedModelsJson() + "]}");
    } catch (Exception exception) {
      sendJson(exchange, 500, "{\"error\":\"list_failed\",\"message\":" + Json.quote(exception.getMessage()) + "}");
    }
  }

  private String generatedModelsJson() throws IOException {
    if (!Files.isDirectory(generatedModelsRoot)) {
      return "";
    }

    try (Stream<Path> paths = Files.walk(generatedModelsRoot, 3)) {
      return paths
          .filter((path) -> Files.isRegularFile(path) && path.getFileName().toString().endsWith(".glb"))
          .sorted(Comparator.comparingLong(this::lastModifiedMillis).reversed())
          .map(this::generatedModelJson)
          .collect(Collectors.joining(","));
    }
  }

  private String generatedModelJson(Path glbPath) {
    Path relativePath = generatedModelsRoot.relativize(glbPath);
    Path jobPath = relativePath.getNameCount() > 1 ? relativePath.getName(0) : glbPath.getParent().getFileName();
    String jobName = jobPath == null ? stripExtension(glbPath.getFileName().toString()) : jobPath.toString();
    String modelUrl = "/models/generated/" + relativePath.toString().replace('\\', '/');

    return "{\"name\":"
        + Json.quote(jobName)
        + ",\"modelUrl\":"
        + Json.quote(modelUrl)
        + ",\"sizeBytes\":"
        + fileSize(glbPath)
        + ",\"modifiedAt\":"
        + lastModifiedMillis(glbPath)
        + "}";
  }

  private void handleGeneratedModelFile(HttpExchange exchange) throws IOException {
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 204, "");
      return;
    }

    if (!"GET".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    Path requestedPath = resolveGeneratedModelRequestPath(exchange);
    if (requestedPath == null || !Files.isRegularFile(requestedPath)) {
      sendJson(exchange, 404, "{\"error\":\"not_found\"}");
      return;
    }

    byte[] bytes = Files.readAllBytes(requestedPath);
    exchange.getResponseHeaders().set("Content-Type", contentType(requestedPath));
    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
    exchange.sendResponseHeaders(200, bytes.length);

    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private Path resolveGeneratedModelRequestPath(HttpExchange exchange) {
    String prefix = "/models/generated";
    String path = exchange.getRequestURI().getPath();
    if (!path.equals(prefix) && !path.startsWith(prefix + "/")) {
      return null;
    }

    String relative = URLDecoder.decode(path.substring(prefix.length()), StandardCharsets.UTF_8);
    while (relative.startsWith("/")) {
      relative = relative.substring(1);
    }

    Path requestedPath = generatedModelsRoot.resolve(relative).normalize();
    Path root = generatedModelsRoot.toAbsolutePath().normalize();
    Path absoluteRequestedPath = requestedPath.toAbsolutePath().normalize();

    return absoluteRequestedPath.startsWith(root) ? absoluteRequestedPath : null;
  }

  private static String contentType(Path path) {
    String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
    if (fileName.endsWith(".glb")) {
      return "model/gltf-binary";
    }
    if (fileName.endsWith(".gltf")) {
      return "model/gltf+json";
    }
    if (fileName.endsWith(".txt") || fileName.endsWith(".tsv")) {
      return "text/plain; charset=utf-8";
    }

    return "application/octet-stream";
  }

  private long fileSize(Path path) {
    try {
      return Files.size(path);
    } catch (IOException exception) {
      return 0;
    }
  }

  private long lastModifiedMillis(Path path) {
    try {
      return Files.getLastModifiedTime(path).toMillis();
    } catch (IOException exception) {
      return 0;
    }
  }

  private static void sendJson(HttpExchange exchange, int statusCode, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
    exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    exchange.sendResponseHeaders(statusCode, bytes.length);

    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private static double parseDouble(String value, double fallback) {
    if (value == null || value.isBlank()) {
      return fallback;
    }

    try {
      return Double.parseDouble(value);
    } catch (NumberFormatException exception) {
      return fallback;
    }
  }

  private static Path resolveProjectRoot() {
    String override = System.getenv("CAD_MOTION_PROJECT_ROOT");
    if (override != null && !override.isBlank()) {
      return Path.of(override).toAbsolutePath().normalize();
    }

    Path current = Path.of("").toAbsolutePath().normalize();
    if (current.getFileName() != null && "backend".equals(current.getFileName().toString())) {
      return current.getParent();
    }

    return current;
  }

  private static Path resolveDataRoot(Path projectRoot) {
    String override = System.getenv("CAD_MOTION_DATA_ROOT");
    if (override != null && !override.isBlank()) {
      return Path.of(override).toAbsolutePath().normalize();
    }

    return projectRoot.resolve("apps/cad-backend/work").toAbsolutePath().normalize();
  }

  private static String stripExtension(String fileName) {
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex <= 0 ? fileName : fileName.substring(0, dotIndex);
  }

  private static Path resolveOcctConverter(Path projectRoot) {
    String override = System.getenv("OCCT_CONVERTER");
    if (override != null && !override.isBlank()) {
      return Path.of(override).toAbsolutePath().normalize();
    }

    String executableName =
        System.getProperty("os.name").toLowerCase().contains("win")
            ? "cad-step-to-glb.exe"
            : "cad-step-to-glb";

    return projectRoot
        .resolve("native/cad-step-to-glb/build")
        .resolve(executableName)
        .toAbsolutePath()
        .normalize();
  }

  private record CliOptions(int port, Path dataRoot, Path converter) {
    private static CliOptions parse(String[] args) {
      int port = DEFAULT_PORT;
      Path dataRoot = null;
      Path converter = null;

      for (int index = 0; index < args.length; index++) {
        String arg = args[index];
        if ("--port".equals(arg) && index + 1 < args.length) {
          port = Integer.parseInt(args[++index]);
        } else if ("--data-root".equals(arg) && index + 1 < args.length) {
          dataRoot = Path.of(args[++index]).toAbsolutePath().normalize();
        } else if ("--converter".equals(arg) && index + 1 < args.length) {
          converter = Path.of(args[++index]).toAbsolutePath().normalize();
        }
      }

      return new CliOptions(port, dataRoot, converter);
    }
  }
}
