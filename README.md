
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

## Windows installer

Build on Windows x64 with PowerShell. Install these prerequisites first:

- Node.js 22.12+ and npm.
- Rust with the `x86_64-pc-windows-msvc` target.
- Visual Studio 2022 Build Tools with **Desktop development with C++**, MSVC v143, and a Windows SDK.
- CMake 3.20+ on `PATH`.
- Windows x64 JDK 17, with `JAVA_HOME` pointing to that JDK.
- A bootstrapped [vcpkg checkout](https://learn.microsoft.com/en-us/vcpkg/get_started/get-started), with `VCPKG_ROOT` pointing to it.
- WebView2 for running/testing the desktop app. The default Tauri installer downloads it if needed on the end user's machine.

From a Windows PowerShell terminal:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:VCPKG_ROOT = 'C:\path\to\vcpkg'
rustup target add x86_64-pc-windows-msvc
cd apps/desktop
npm ci
npm run build:windows:installer
```

The script builds the two Java JARs, installs `opencascade[core,rapidjson,tbb]:x64-windows` with vcpkg,
compiles the CAD converter, packages its release DLLs and the MSVC runtime, creates
a Windows Java runtime using `jlink`, and builds the Tauri NSIS setup executable.
The first OpenCascade build may take a while. Tauri downloads installer tooling as
needed; the build requires network access unless those dependencies are cached.

Output:

```text
apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe
```

To prepare just the bundled resources, run `npm run prepare:windows-bundle` from
`apps/desktop`. This replaces the generated `src-tauri/resources` directory.
The converter build and its dedicated vcpkg installation are kept under
`native/cad-step-to-glb/build/windows`; release DLLs live beside the staged converter.
The JDK's legal notices and vcpkg package metadata/copyright files are included.

`tauri.windows.conf.json` overrides the macOS build hook and selects NSIS on Windows.
The macOS DMG command continues to use the existing configuration. Windows builds
currently target x64 only and produce an unsigned installer.

## GitHub Actions releases

[Build desktop releases](.github/workflows/release.yml) builds on `macos-15`
(Apple Silicon/arm64) and `windows-2022` (x64). Each job installs Node 22,
Temurin JDK 17, Rust stable, and npm dependencies. macOS installs CMake and
OpenCascade via Homebrew. Windows bootstraps the pinned vcpkg `2025.06.13`
registry (OpenCascade 7.9.1), then the packaging script installs OpenCascade
with RapidJSON for GLB export and TBB for parallel work. The Windows runner
provides Visual Studio 2022, the Windows SDK, and CMake. Windows native
builds are cached; the first build can be substantially slower.

To publish:

1. Commit and push the workflow and packaging files.
2. Set the version in `apps/desktop/src-tauri/tauri.conf.json` and keep
   `apps/desktop/package.json` and the Cargo package version in sync.
3. Commit those version changes, then push a matching tag, for example:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

Both builds must succeed before the workflow creates a GitHub release and
attaches `FTC-Sim-macos-arm64.dmg` and `FTC-Sim-windows-x64-setup.exe`.
Tags with a prerelease suffix (for example `v0.2.0-beta.1`) create prereleases.
Rerunning a tag build replaces those assets on the existing release.
The workflow uses GitHub's automatic token with `contents: write` only in
the publishing job; no personal access token is needed.

For a build without publishing, select **Actions → Build desktop releases →
Run workflow** on a branch. Download the installers from that run's artifacts.
Manual runs on a tag also publish to its release. The tag must match the
Tauri version. Workflows must be pushed to GitHub before they can run; manual
execution requires the workflow to be present on the default branch.

The macOS DMG is ad-hoc signed, not notarized; Windows installers are unsigned.
Apple Developer signing/notarization and Windows signing are not configured.
The macOS artifact is for Apple Silicon, not Intel Macs. Before distributing,
test installation, simulator startup, TeamCode compilation, and STEP import
on machines without development tools.

Clean local project:

```sh
lsof -ti tcp:8080 | xargs kill
./gradlew :apps:runner:clean :apps:runner:build

rm -rf node_modules/.vite dist
```
