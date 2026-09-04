#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESOURCE_ROOT="${REPO_ROOT}/apps/desktop/src-tauri/resources"
NATIVE_ROOT="${RESOURCE_ROOT}/native/macos"
NATIVE_BIN_DIR="${NATIVE_ROOT}/bin"
NATIVE_LIB_DIR="${NATIVE_ROOT}/lib"
RUNTIME_DIR="${RESOURCE_ROOT}/runtime"
RUNNER_JAR="${REPO_ROOT}/apps/runner/build/libs/runner-1.0.0.jar"
CAD_BACKEND_JAR="${REPO_ROOT}/apps/cad-backend/build/libs/cad-motion-backend-0.1.0.jar"
CONVERTER_BUILD_DIR="${REPO_ROOT}/native/cad-step-to-glb/build"
CONVERTER="${CONVERTER_BUILD_DIR}/cad-step-to-glb"
STAGED_CONVERTER="${NATIVE_BIN_DIR}/cad-step-to-glb"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS bundle resources can only be prepared on macOS." >&2
  exit 1
fi

cd "${REPO_ROOT}"

./gradlew :apps:runner:jar :apps:cad-backend:jar
cmake -S native/cad-step-to-glb -B "${CONVERTER_BUILD_DIR}"
cmake --build "${CONVERTER_BUILD_DIR}" --config Release

if [[ ! -f "${RUNNER_JAR}" ]]; then
  echo "Expected runner jar not found: ${RUNNER_JAR}" >&2
  exit 1
fi

if [[ ! -f "${CAD_BACKEND_JAR}" ]]; then
  echo "Expected CAD backend jar not found: ${CAD_BACKEND_JAR}" >&2
  exit 1
fi

if [[ ! -x "${CONVERTER}" ]]; then
  echo "Expected native converter not found: ${CONVERTER}" >&2
  exit 1
fi

rm -rf "${RESOURCE_ROOT}"
mkdir -p \
  "${RESOURCE_ROOT}/java/runner" \
  "${RESOURCE_ROOT}/java/cad-backend" \
  "${NATIVE_BIN_DIR}" \
  "${NATIVE_LIB_DIR}"
touch "${RESOURCE_ROOT}/.gitkeep"

cp "${RUNNER_JAR}" "${RESOURCE_ROOT}/java/runner/"
cp "${CAD_BACKEND_JAR}" "${RESOURCE_ROOT}/java/cad-backend/"
cp "${CONVERTER}" "${STAGED_CONVERTER}"
chmod 755 "${STAGED_CONVERTER}"

deps_for() {
  otool -L "$1" \
    | awk 'NR > 1 { print $1 }' \
    | grep '^/' \
    | grep -Ev '^/(usr/lib|System/Library)/' \
    || true
}

copy_dylib_closure() {
  local queue=("$@")
  local current dep basename target

  while ((${#queue[@]} > 0)); do
    current="${queue[0]}"
    queue=("${queue[@]:1}")

    while IFS= read -r dep; do
      [[ -n "${dep}" ]] || continue
      basename="$(basename "${dep}")"
      target="${NATIVE_LIB_DIR}/${basename}"

      if [[ ! -f "${target}" ]]; then
        cp "${dep}" "${target}"
        chmod u+w "${target}"
        queue+=("${target}")
      fi
    done < <(deps_for "${current}")
  done
}

ensure_rpath() {
  local file="$1"
  local rpath="$2"

  if ! otool -l "${file}" | grep -A2 LC_RPATH | grep -q "${rpath}"; then
    install_name_tool -add_rpath "${rpath}" "${file}"
  fi
}

rewrite_dylib_paths() {
  local file="$1"
  local dep basename

  while IFS= read -r dep; do
    [[ -n "${dep}" ]] || continue
    basename="$(basename "${dep}")"
    install_name_tool -change "${dep}" "@rpath/${basename}" "${file}" || true
  done < <(deps_for "${file}")
}

copy_dylib_closure "${STAGED_CONVERTER}"

ensure_rpath "${STAGED_CONVERTER}" "@loader_path/../lib"
rewrite_dylib_paths "${STAGED_CONVERTER}"

while IFS= read -r dylib; do
  chmod u+w "${dylib}"
  install_name_tool -id "@rpath/$(basename "${dylib}")" "${dylib}" || true
  ensure_rpath "${dylib}" "@loader_path"
  rewrite_dylib_paths "${dylib}"
done < <(find "${NATIVE_LIB_DIR}" -type f -name '*.dylib' | sort)

JAVA_HOME_FOR_JLINK="${JAVA_HOME:-}"
if [[ -z "${JAVA_HOME_FOR_JLINK}" ]]; then
  JAVA_HOME_FOR_JLINK="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null)"
fi

if [[ -z "${JAVA_HOME_FOR_JLINK}" || ! -x "${JAVA_HOME_FOR_JLINK}/bin/jlink" ]]; then
  echo "A JDK with jlink is required to create the bundled runtime." >&2
  exit 1
fi

"${JAVA_HOME_FOR_JLINK}/bin/jlink" \
  --add-modules java.base,java.compiler,java.logging,java.management,java.net.http,jdk.compiler,jdk.httpserver,jdk.unsupported,jdk.zipfs \
  --strip-debug \
  --no-header-files \
  --no-man-pages \
  --output "${RUNTIME_DIR}"

while IFS= read -r link; do
  target="$(readlink "${link}")"
  if [[ "${target}" != /* ]]; then
    target="$(cd "$(dirname "${link}")" && cd "$(dirname "${target}")" && pwd)/$(basename "${target}")"
  fi

  rm "${link}"
  cp "${target}" "${link}"
done < <(find "${RUNTIME_DIR}" -type l | sort)

rm -rf "${RUNTIME_DIR}/legal"
chmod -R u+rwX,go+rX "${RESOURCE_ROOT}"
chmod 755 "${STAGED_CONVERTER}" "${RUNTIME_DIR}/bin/java" "${RUNTIME_DIR}/bin/javac"
xattr -cr "${RESOURCE_ROOT}"

echo "Prepared macOS bundle resources in ${RESOURCE_ROOT}"
