
# FTC Sim

FTC Sim is split into a desktop shell, a Java simulator runner, reusable Java libraries, and a local TeamCode workspace.

## Repository Layout

- `apps/desktop` - React and Tauri desktop app.
- `apps/runner` - Java simulator runner process.
- `apps/cad-backend` - Java CAD conversion backend used by the CAD Visualizer tab.
- `libs/ftc-sdk-shim` - FTC SDK-compatible shim classes.
- `native/cad-step-to-glb` - OpenCascade STEP-to-GLB converter used by the CAD backend.
- `examples/teamcode` - Checked-in sample TeamCode.
- `workspace/TeamCode` - Local editable TeamCode used by the app. Ignored by git.
- `runtime` - Local or bundled Java runtime. Ignored by git.
- `scripts` - Build and release scripts.
- `docs` - Project documentation.

See `docs/repository-layout.md` for more detail.

## Common Commands

Run the Java simulator runner:

```sh
./gradlew :apps:runner:build
```

Build the CAD backend:

```sh
./gradlew :apps:cad-backend:build
```

Build the native STEP converter:

```sh
cmake -S native/cad-step-to-glb -B native/cad-step-to-glb/build
cmake --build native/cad-step-to-glb/build
```

Work on the desktop app:

```sh
cd apps/desktop
npm run tauri:dev
```

Build the macOS DMG:

```sh
cd apps/desktop
npm run build:mac:dmg
```

Clean local project:

```sh
lsof -ti tcp:8080 | xargs kill
./gradlew :apps:runner:clean :apps:runner:build

rm -rf node_modules/.vite dist
```
