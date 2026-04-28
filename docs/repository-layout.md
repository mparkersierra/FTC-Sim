# Repository Layout

FTC Sim is a multi-language monorepo. Keep checked-in source, local user code, and generated artifacts separate.

## Top-level folders

- `apps/desktop` - React and Tauri desktop shell.
- `apps/runner` - Java simulator process launched by the desktop app.
- `libs/ftc-sdk-shim` - Minimal FTC SDK-compatible API surface used by TeamCode.
- `libs/sim-core` - Shared simulator domain code and hardware abstractions.
- `examples/teamcode` - Checked-in sample FTC TeamCode files.
- `workspace/TeamCode` - Local editable TeamCode workspace created and used by the app. This is ignored by git.
- `runtime` - Local or bundled Java runtime artifacts. This is ignored by git.
- `scripts` - Release and maintenance scripts.
- `docs` - Project documentation.

## Source vs generated state

Code under `apps`, `libs`, `examples`, `scripts`, and `docs` should be reviewed and committed.

Code and compiled output under `workspace`, `runtime`, `build`, `bin`, `dist`, `node_modules`, and `target` are local or generated state and should not be committed.

## Build entry points

- Java runner: `./gradlew :apps:runner:run`
- Desktop frontend: run npm commands from `apps/desktop`
- macOS DMG: `npm run build:mac:dmg` from `apps/desktop`
