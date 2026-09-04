#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${REPO_ROOT}/apps/desktop"
MACOS_BUNDLE_DIR="${APP_DIR}/src-tauri/target/release/bundle/macos"
APP_BUNDLE="${MACOS_BUNDLE_DIR}/FTC Sim.app"
STAGING_DIR="${REPO_ROOT}/dmg-staging"
DMG_PATH="${MACOS_BUNDLE_DIR}/FTC-Sim.dmg"

cd "${APP_DIR}"
npm run tauri build -- --bundles app

if [[ ! -d "${APP_BUNDLE}" ]]; then
  echo "Expected app bundle not found: ${APP_BUNDLE}" >&2
  exit 1
fi

codesign --force --deep --sign - "${APP_BUNDLE}"

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"

cp -R "${APP_BUNDLE}" "${STAGING_DIR}/"
ln -s /Applications "${STAGING_DIR}/Applications"

hdiutil create \
  -volname "FTC Sim" \
  -srcfolder "${STAGING_DIR}" \
  -ov \
  -format UDZO \
  "${DMG_PATH}"

rm -rf "${STAGING_DIR}"

echo "Created: ${DMG_PATH}"
