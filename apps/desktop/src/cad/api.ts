import { invoke } from "@tauri-apps/api/core";

const fallbackCadBackendBaseUrl = "http://127.0.0.1:8087";

export async function cadBackendBaseUrl() {
  try {
    return await invoke<string>("cad_backend_base_url");
  } catch {
    return fallbackCadBackendBaseUrl;
  }
}

export function apiUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path}`;
}

export function backendAssetUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return apiUrl(baseUrl, path);
}
