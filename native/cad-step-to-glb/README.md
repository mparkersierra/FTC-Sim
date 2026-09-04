# Native OCCT STEP Converter

This executable replaces the FreeCAD/Blender prototype pipeline.

It uses OpenCascade libraries directly:

- `STEPCAFControl_Reader` imports STEP assemblies into an XDE document.
- `BRepMesh_IncrementalMesh` tessellates shapes.
- `RWGltf_CafWriter` writes binary glTF/GLB.

## Build

Install OpenCascade development libraries first.

macOS with Homebrew:

```bash
brew install opencascade
cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build
cmake --build native/cad-step-to-glb/build
```

If CMake cannot find OCCT, pass its CMake config directory:

```bash
cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build \
  -DOpenCASCADE_DIR=/opt/homebrew/lib/cmake/opencascade
cmake --build native/cad-step-to-glb/build
```

## Run

```bash
native/cad-step-to-glb/build/cad-step-to-glb \
  --input /absolute/path/robot.step \
  --output apps/cad-backend/work/models/generated/robot/robot.glb \
  --manifest apps/cad-backend/work/models/generated/robot/manifest.tsv \
  --preview \
  --skip-pattern screw,bolt,nut,washer \
  --expand-pattern chassis,5103 \
  --min-bbox 5 \
  --cpu-threads 8
```

`--preview` enables coarser meshing and default hardware filtering. `--skip-pattern` and `--expand-pattern` are comma-separated. `--expand-pattern` matching ignores case, spaces, and punctuation. `--min-bbox` skips parts whose largest bounding-box dimension is smaller than the given millimeter value.
`--cpu-threads` controls the OpenCascade worker pool size. Omit it to use all detected logical CPU cores.

The Java backend looks for this executable by default:

```text
native/cad-step-to-glb/build/cad-step-to-glb
```

Override it with:

```bash
OCCT_CONVERTER=/absolute/path/cad-step-to-glb \
java -jar apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar
```
