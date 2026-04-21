/**
 * ManagedWebSocket — a resilient WebSocket wrapper with exponential back-off
 * reconnection logic.
 *
 * Design decision: We chose a class-based approach over a plain function so
 * that callers hold a single reference they can `destroy()` when the
 * connection is no longer needed (e.g. file processing complete). This avoids
 * leaked timers and dangling event listeners.
 *
 * Usage:
 *   const ws = new ManagedWebSocket(fileId, {
 *     onMessage: (data) => { ... },
 *     onOpen:    ()     => { ... },
 *     onError:   (attempt) => { ... },
 *   });
 *   // later:
 *   ws.destroy();
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL;

export class ManagedWebSocket {
  /**
   * @param {string} fileId - the file session ID to subscribe to
   * @param {Object} opts
   * @param {(data: object) => void} opts.onMessage - called with parsed JSON payload
   * @param {() => void}            [opts.onOpen]   - called when connection opens
   * @param {(attempt: number) => void} [opts.onReconnect] - called on each reconnect attempt
   * @param {(attempt: number) => void} [opts.onMaxRetriesReached] - called when giving up
   * @param {number} [opts.maxRetries=5]  - max reconnect attempts before giving up
   * @param {number} [opts.baseDelay=1000] - initial back-off delay in ms
   */
  constructor(fileId, opts = {}) {
    this.fileId = fileId;
    this.onMessage = opts.onMessage || (() => {});
    this.onOpen = opts.onOpen || (() => {});
    this.onReconnect = opts.onReconnect || (() => {});
    this.onMaxRetriesReached = opts.onMaxRetriesReached || (() => {});
    this.maxRetries = opts.maxRetries ?? 5;
    this.baseDelay = opts.baseDelay ?? 1000;

    this._destroyed = false;
    this._attempt = 0;
    this._retryTimer = null;
    this._socket = null;

    this._connect();
  }

  /** Build the WebSocket URL for this file ID. */
  _buildUrl() {
    const url = new URL(`${WS_BASE_URL}/ws/progress`);
    url.searchParams.set("fileId", this.fileId);
    return url.toString();
  }

  /** Open a new WebSocket and wire all event handlers. */
  _connect() {
    if (this._destroyed) return;

    this._socket = new WebSocket(this._buildUrl());

    this._socket.onopen = () => {
      if (this._destroyed) {
        this._socket.close();
        return;
      }
      this._attempt = 0; // reset counter on successful connect
      this.onOpen();
    };

    this._socket.onmessage = (event) => {
      if (this._destroyed) return;
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (err) {
        console.error("[ManagedWebSocket] Failed to parse message:", err);
      }
    };

    this._socket.onerror = (err) => {
      // onerror is always followed by onclose, so we handle reconnect there.
      console.warn(`[ManagedWebSocket] Socket error for fileId=${this.fileId}:`, err);
    };

    this._socket.onclose = (event) => {
      if (this._destroyed) return;

      // 1000 = normal closure (e.g. server sent "complete" and we called destroy)
      if (event.code === 1000) return;

      this._scheduleReconnect();
    };
  }

  /** Schedule a reconnect attempt using exponential back-off with jitter. */
  _scheduleReconnect() {
    if (this._destroyed) return;

    this._attempt++;

    if (this._attempt > this.maxRetries) {
      console.error(`[ManagedWebSocket] Max retries (${this.maxRetries}) reached for fileId=${this.fileId}`);
      this.onMaxRetriesReached(this._attempt);
      return;
    }

    // Exponential back-off: delay = min(baseDelay * 2^(attempt-1), 30000) + jitter
    const expDelay = this.baseDelay * Math.pow(2, this._attempt - 1);
    const jitter = Math.random() * 500; // up to 500 ms jitter
    const delay = Math.min(expDelay + jitter, 30_000);

    console.info(
      `[ManagedWebSocket] Reconnecting fileId=${this.fileId} in ${Math.round(delay)}ms (attempt ${this._attempt}/${this.maxRetries})`
    );

    this.onReconnect(this._attempt);

    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this._connect();
    }, delay);
  }

  /**
   * Permanently destroy this connection. Cancels any pending reconnect timer
   * and closes the socket with a normal closure code (1000).
   */
  destroy() {
    this._destroyed = true;
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._socket) {
      this._socket.close(1000, "Client destroyed");
      this._socket = null;
    }
  }
}
