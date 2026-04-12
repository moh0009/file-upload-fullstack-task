import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const BASE_URL = "http://localhost:8080/api";
const WS_BASE_URL = "ws://localhost:8080/api";

// ─── JSON REST helper ───────────────────────────────────────────────────────
async function fetchAPI(path, method, body, signal) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    signal,
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(BASE_URL + path, options);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") return null; // request was intentionally cancelled
    console.error("Fetch error:", err);
    return null;
  }
}

export default fetchAPI;

// ─── Chunked file upload ─────────────────────────────────────────────────────
/**
 * Uploads a single chunk as multipart FormData.
 * Uses XMLHttpRequest so we can track real upload progress.
 *
 * @param {Object} params
 * @param {Blob}   params.chunk        - Sliced file blob
 * @param {number} params.chunkIndex   - Zero-based chunk index
 * @param {number} params.totalChunks  - Total number of chunks
 * @param {string} params.fileName     - Original file name
 * @param {string} params.fileId       - Unique file session ID
 * @param {function(number): void} [params.onProgress] - bytes uploaded / total → 0-100
 * @returns {Promise<void>}
 */
export function uploadChunk({ chunk, chunkIndex, totalChunks, fileName, fileId, onProgress }) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", chunk);
    formData.append("chunkIndex", chunkIndex);
    formData.append("totalChunks", totalChunks);
    formData.append("fileName", fileName);
    formData.append("fileId", fileId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload chunk failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during chunk upload"));
    xhr.send(formData);
  });
}

// ─── WebSocket progress connection ───────────────────────────────────────────
/**
 * Opens a WebSocket connection for a specific file's progress stream.
 *
 * @param {string} fileId - The file session ID to subscribe to
 * @returns {WebSocket}
 */
export function connectWS(fileId) {
  const wsUrl = new URL(`${WS_BASE_URL}/ws/progress`);
  wsUrl.searchParams.append("fileId", fileId);
  return new WebSocket(wsUrl.toString());
}

