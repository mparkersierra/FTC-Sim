# Run on Windows with a 64-bit JDK 17 and a bootstrapped vcpkg checkout.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE"
    }
}

if ($env:OS -ne 'Windows_NT') { throw 'Windows bundle resources must be built on Windows.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to a Windows x64 JDK 17.' }
if (-not $env:VCPKG_ROOT) { throw 'Set VCPKG_ROOT to a bootstrapped vcpkg checkout.' }

$RepoRoot = Split-Path $PSScriptRoot -Parent
$ResourceRoot = Join-Path $RepoRoot 'apps/desktop/src-tauri/resources'
$BuildDir = Join-Path $RepoRoot 'native/cad-step-to-glb/build/windows'
$NativeRoot = Join-Path $ResourceRoot 'native/windows'
$NativeBin = Join-Path $NativeRoot 'bin'
$Jlink = Join-Path $env:JAVA_HOME 'bin/jlink.exe'
$Vcpkg = Join-Path $env:VCPKG_ROOT 'vcpkg.exe'
$Toolchain = Join-Path $env:VCPKG_ROOT 'scripts/buildsystems/vcpkg.cmake'
$InstalledDir = Join-Path $BuildDir 'vcpkg_installed'

foreach ($Required in @($Jlink, $Vcpkg, $Toolchain)) {
    if (-not (Test-Path $Required)) { throw "Required tool not found: $Required" }
}
$JdkRelease = Get-Content (Join-Path $env:JAVA_HOME 'release') -Raw
if ($JdkRelease -notmatch 'JAVA_VERSION="17(?:\.|"|-)' -or $JdkRelease -notmatch 'OS_ARCH="(?:amd64|x86_64)"') {
    throw 'JAVA_HOME must point to a Windows x64 JDK 17 (matching the installer target).'
}
# javap (used by the frontend build) and Gradle must use the same JDK.
$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"

Push-Location $RepoRoot
try {
    Invoke-Checked (Join-Path $RepoRoot 'gradlew.bat') @(':apps:runner:jar', ':apps:cad-backend:jar')
    Invoke-Checked $Vcpkg @('install', 'opencascade[core,rapidjson,tbb]:x64-windows', "--x-install-root=$InstalledDir")
    Invoke-Checked 'cmake' @('-S', 'native/cad-step-to-glb', '-B', $BuildDir,
        '-G', 'Visual Studio 17 2022', '-A', 'x64', "-DCMAKE_TOOLCHAIN_FILE=$Toolchain",
        '-DVCPKG_TARGET_TRIPLET=x64-windows', "-DVCPKG_INSTALLED_DIR=$InstalledDir")
    Invoke-Checked 'cmake' @('--build', $BuildDir, '--config', 'Release', '--parallel')

    if (Test-Path $ResourceRoot) { Remove-Item $ResourceRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $NativeBin,
        (Join-Path $ResourceRoot 'java/runner'), (Join-Path $ResourceRoot 'java/cad-backend') | Out-Null
    New-Item -ItemType File -Path (Join-Path $ResourceRoot '.gitkeep') | Out-Null
    Copy-Item 'apps/runner/build/libs/runner-1.0.0.jar' (Join-Path $ResourceRoot 'java/runner')
    Copy-Item 'apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar' (Join-Path $ResourceRoot 'java/cad-backend')

    # Install the converter and app-local MSVC runtime DLLs.
    Invoke-Checked 'cmake' @('--install', $BuildDir, '--config', 'Release', '--prefix', $NativeRoot)
    # Include release DLLs from the dedicated dependency tree, including transitive dependencies.
    Copy-Item (Join-Path $InstalledDir 'x64-windows/bin/*.dll') $NativeBin
    Copy-Item (Join-Path $InstalledDir 'x64-windows/share') (Join-Path $NativeRoot 'licenses') -Recurse

    Invoke-Checked $Jlink @('--add-modules',
        'java.base,java.compiler,java.logging,java.management,java.net.http,jdk.compiler,jdk.httpserver,jdk.unsupported,jdk.zipfs',
        '--strip-debug', '--no-header-files', '--no-man-pages', '--output', (Join-Path $ResourceRoot 'runtime'))
    foreach ($Relative in @('runtime/bin/java.exe', 'runtime/bin/javac.exe', 'native/windows/bin/cad-step-to-glb.exe')) {
        if (-not (Test-Path (Join-Path $ResourceRoot $Relative))) { throw "Missing bundle resource: $Relative" }
    }
    Write-Host "Prepared Windows bundle resources in $ResourceRoot"
} finally {
    Pop-Location
}
