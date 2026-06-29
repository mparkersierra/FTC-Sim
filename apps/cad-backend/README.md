# CAD Motion Java Backend

This backend is intentionally small and dependency-free for the prototype. Java owns the HTTP API and conversion workflow, while the local OpenCascade converter handles STEP tessellation and GLB export.

## Requirements

- Java 17+
- Gradle wrapper from the repository root
- OpenCascade development libraries
- Built native converter at `native/cad-step-to-glb/build/cad-step-to-glb`

Build the backend jar from the repository root:

```bash
./gradlew :apps:cad-backend:build
```

Run the backend jar manually:

```bash
java -jar apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar
```

Build the OpenCascade converter first:

```bash
brew install opencascade
cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build
cmake --build native/cad-step-to-glb/build
```

If CMake cannot find OpenCascade:

```bash
cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build \
  -DOpenCASCADE_DIR=/opt/homebrew/lib/cmake/opencascade
cmake --build native/cad-step-to-glb/build
```

The backend uses `native/cad-step-to-glb/build/cad-step-to-glb` by default. Override it with:

```bash
OCCT_CONVERTER=/absolute/path/cad-step-to-glb \
java -jar apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar
```

## Conversion Debugging

Large STEP files can take a while. Watch the backend terminal for messages like:

```text
[cad-backend] Saved uploaded STEP file ...
[cad-backend] Starting STEP conversion ...
[cad-backend] Launching OCCT converter ...
[occt] start read STEP file
[occt] finish read STEP file elapsed=...
[occt] start transfer STEP to XDE document
[occt] still transfer STEP to XDE document elapsed=10s
[occt] start mesh shapes
[occt] meshing root 1/...
[occt] start write GLB
[occt] done
[cad-backend] Finished STEP conversion ...
```

If it stops progressing for a long time, the line it stopped on tells you which stage is expensive: STEP parsing, XDE transfer, tessellation, or GLB writing.

The OpenCascade converter defaults to a faster import mode:

- names: enabled
- colors: disabled
- layers: disabled
- properties: disabled

This keeps selectable part names while avoiding extra metadata work for large files. If you need those later, add flags to the native converter command path in Java:

```text
--colors --layers --properties
```

The Tauri STEP panel also sends simplification options:

- `Fast import`: uses coarser meshing and defaults to filtering small hardware.
- `Skip names containing`: comma-separated name fragments such as `screw,bolt,nut,washer`.
- `Expand names containing`: comma-separated fragments such as `chassis,5103`. Matching ignores case, spaces, and punctuation.
- `Minimum part size mm`: skips components whose largest bounding-box dimension is below this value.

These filters run before meshing/export, so they reduce conversion time and GLB size. They are best-effort: they depend on the STEP assembly having useful component names and separable component labels.

## API

Start the server:

```bash
java -jar apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar
```

Convert a local STEP file:

```bash
curl -X POST http://127.0.0.1:8087/api/convert-step \
  -H 'Content-Type: application/json' \
  -d '{"stepPath":"/absolute/path/robot.step","jobName":"robot"}'
```

Upload and convert a STEP file:

```bash
curl -X POST http://127.0.0.1:8087/api/convert-step-upload \
  -F 'stepFile=@/absolute/path/robot.step' \
  -F 'jobName=robot' \
  -F 'preview=true' \
  -F 'skipPattern=screw,bolt,nut,washer,spacer,standoff,bearing,thread,fastener,pin' \
  -F 'expandPattern=chassis,5103' \
  -F 'minBboxMm=5'
```

Response:

```json
{
  "modelUrl": "/models/generated/robot/robot.glb",
  "parts": [
    { "name": "left_arm", "nodeName": "left_arm" }
  ]
}
```

The generated GLB is written under `apps/cad-backend/work/models/generated/<jobName>/` and served by the CAD backend.

Uploaded STEP files are staged under `apps/cad-backend/work/uploads/<jobName>/`.
