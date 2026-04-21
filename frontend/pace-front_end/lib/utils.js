import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const BASE_URL = "/api";
const WS_BASE_URL = "ws://localhost:8080";

// ─── Error classification helpers ────────────────────────────────────────────

/**
 * Returns true when the error is a network-level failure (no response received).
 * @param {Error} err
 */
export function isNetworkError(err) {
  return (
    err instanceof TypeError && // fetch/XHR network failures are TypeErrors
    (err.message.toLowerCase().includes("network") ||
      err.message.toLowerCase().includes("failed to fetch") ||
      err.message.toLowerCase().includes("load failed"))
  );
}

/**
 * Returns true when the server responded with a 5xx status code.
 * The status code is embedded in the error message as "[5xx]".
 * @param {Error} err
 */
export function isServerError(err) {
  return /\[5\d{2}\]/.test(err?.message || "");
}

/**
 * Returns true when the server responded with a 4xx status code.
 * @param {Error} err
 */
export function isClientError(err) {
  return /\[4\d{2}\]/.test(err?.message || "");
}

// ─── JSON REST helper ─────────────────────────────────────────────────────────

/**
 * Thin wrapper around fetch for JSON REST calls.
 * Rejects with a descriptive error that includes the HTTP status code so
 * callers can branch using isNetworkError / isServerError / isClientError.
 *
 * @param {string}  path    - path appended to BASE_URL
 * @param {string}  method  - HTTP method
 * @param {object|null} body - JSON body (omit for GET)
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
async function fetchAPI(path, method, body, signal) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    signal,
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(BASE_URL + path, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error || res.statusText || "Unknown server error";
      throw new Error(`[${res.status}] ${msg}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") return null; // intentionally cancelled
    else if (isServerError(err) || isClientError(err)) console.log("server is down or unreachable !!"); // re-throw with status code info for server/client errors
  }
}

export default fetchAPI;

// ─── Chunked file upload ──────────────────────────────────────────────────────

/**
 * Uploads a single chunk via XMLHttpRequest so we get granular upload progress.
 * Rejects with an error message that includes the HTTP status code.
 *
 * @param {Object} params
 * @param {Blob}   params.chunk
 * @param {number} params.chunkIndex
 * @param {number} params.totalChunks
 * @param {string} params.fileName
 * @param {string} params.fileId
 * @param {function(number): void} [params.onProgress]
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
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        // Try to extract the server's error message from the response body
        let serverMsg = "";
        try {
          const body = JSON.parse(xhr.responseText);
          serverMsg = body.error || "";
        } catch (_) {}
        reject(
          new Error(
            `[${xhr.status}] ${serverMsg || `chunk ${chunkIndex} upload failed`}`
          )
        );
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error: could not reach the server during chunk upload"));

    xhr.send(formData);
  });
}

// ─── WebSocket progress connection ────────────────────────────────────────────

/**
 * Opens a raw WebSocket connection for a specific file's progress stream.
 * Prefer using ManagedWebSocket from lib/websocket.js for production use
 * (automatic reconnection, exponential back-off).
 *
 * @param {string} fileId
 * @returns {WebSocket}
 */
export function connectWS(fileId) {
  const wsUrl = new URL(`${WS_BASE_URL}/ws/progress`);
  wsUrl.searchParams.append("fileId", fileId);
  return new WebSocket(wsUrl.toString());
}
