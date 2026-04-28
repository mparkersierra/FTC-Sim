
# FTC Sim

FTC Sim is split into a desktop shell, a Java simulator runner, reusable Java libraries, and a local TeamCode workspace.

## Repository Layout

- `apps/desktop` - React and Tauri desktop app.
- `apps/runner` - Java simulator runner process.
- `libs/ftc-sdk-shim` - FTC SDK-compatible shim classes.
- `libs/sim-core` - Shared simulator core code.
- `examples/teamcode` - Checked-in sample TeamCode.
- `workspace/TeamCode` - Local editable TeamCode used by the app. Ignored by git.
- `runtime` - Local or bundled Java runtime. Ignored by git.
- `scripts` - Build and release scripts.
- `docs` - Project documentation.

See `docs/repository-layout.md` for more detail.

## Common Commands

Run the Java simulator runner:

```sh
./gradlew :apps:runner:run
```

Work on the desktop app:

```sh
cd apps/desktop
npm run dev
```

Build the macOS DMG:

```sh
cd apps/desktop
npm run build:mac:dmg
```
