use std::path::{Path, PathBuf};

/// Java's JAR launcher needs ordinary Windows paths instead of Rust/Tauri's
/// verbatim paths. Keep this conversion at the process boundary, without
/// canonicalizing again (which would restore the prefix).
pub(crate) fn java_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        use std::{
            ffi::OsString,
            os::windows::ffi::{OsStrExt, OsStringExt},
        };

        let wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        PathBuf::from(OsString::from_wide(&normalize_windows_path(&wide)))
    }
    #[cfg(not(windows))]
    {
        path.to_path_buf()
    }
}

#[cfg(any(windows, test))]
fn normalize_windows_path(path: &[u16]) -> Vec<u16> {
    let prefix: Vec<u16> = r"\\?\".encode_utf16().collect();
    if let Some(rest) = path.strip_prefix(prefix.as_slice()) {
        let unc: Vec<u16> = r"UNC\".encode_utf16().collect();
        if let Some(share) = rest.strip_prefix(unc.as_slice()) {
            return r"\\".encode_utf16().chain(share.iter().copied()).collect();
        }
        // Only translate drive paths; preserve device/volume namespaces.
        if rest.len() >= 3
            && ((b'A' as u16..=b'Z' as u16).contains(&rest[0])
                || (b'a' as u16..=b'z' as u16).contains(&rest[0]))
            && rest[1] == b':' as u16
            && rest[2] == b'\\' as u16
        {
            return rest.to_vec();
        }
    }
    path.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_windows_java_arguments() {
        for (input, expected) in [
            (
                r"\\?\C:\Users\Reece Liu\AppData\Local\FTC Sim\resources\java\cad-backend\cad-motion-backend-0.1.0.jar",
                r"C:\Users\Reece Liu\AppData\Local\FTC Sim\resources\java\cad-backend\cad-motion-backend-0.1.0.jar",
            ),
            (
                r"\\?\UNC\server\FTC Sim\runner.jar",
                r"\\server\FTC Sim\runner.jar",
            ),
            (r"\\?\C:\Users\李\TeamCode", r"C:\Users\李\TeamCode"),
            (r"C:\FTC Sim\runner.jar", r"C:\FTC Sim\runner.jar"),
            (r"\\server\share\runner.jar", r"\\server\share\runner.jar"),
            (r"\\?\Volume{abc}\runner.jar", r"\\?\Volume{abc}\runner.jar"),
            ("relative/runner.jar", "relative/runner.jar"),
        ] {
            let wide: Vec<u16> = input.encode_utf16().collect();
            assert_eq!(
                normalize_windows_path(&wide),
                expected.encode_utf16().collect::<Vec<_>>()
            );
            #[cfg(windows)]
            assert_eq!(java_path(Path::new(input)), PathBuf::from(expected));
        }
    }

    #[test]
    fn preserves_non_unicode_windows_names() {
        let mut wide: Vec<u16> = r"\\?\C:\".encode_utf16().collect();
        wide.push(0xD800);
        assert_eq!(normalize_windows_path(&wide), wide[4..]);
    }

    #[cfg(not(windows))]
    #[test]
    fn leaves_native_paths_unchanged() {
        let path = Path::new("/Applications/FTC Sim.app/Contents/Resources/runner.jar");
        assert_eq!(java_path(path), path);
    }
}
