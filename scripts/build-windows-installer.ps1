[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Build the Windows installer on Windows.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to a Windows x64 JDK 17.' }
$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"
$AppDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps/desktop'
Push-Location $AppDir
try {
    & npm.cmd run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "Windows installer build failed with exit code $LASTEXITCODE" }
    Write-Host "Installer output: $AppDir/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/"
} finally {
    Pop-Location
}
