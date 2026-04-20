import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import { Play, Upload } from "lucide-react";
import { cn, uploadChunk, isNetworkError } from "../lib/utils";
import fetchAPI from "../lib/utils";
import { ManagedWebSocket } from "../lib/websocket";
import File from "./File";
import DuplicateFileDialog from "./DuplicateFileDialog";
import { useNotification } from "../context/NotificationContext";
import { useFiles } from "../context/FileContext";

/**
 * UploadSection — drag-and-drop file upload with chunked transfers, real-time
 * WebSocket progress, and automatic reconnection via ManagedWebSocket.
 *
 * Accessibility:
 *  - The outer <section> has role="region" + aria-label.
 *  - The dropzone div has role="button" + tabIndex so keyboard users can
 *    trigger it with Enter / Space.
 *  - A visually-hidden aria-live region announces WS status changes.
 *  - The Start button has aria-disabled when nothing is pending.
 */
export default function UploadSection() {
  const { files, addFile, updateFile, removeFile, replaceFile, getFileByName, isHydrated } = useFiles();
  const [duplicateQueue, setDuplicateQueue] = useState([]);
  const [duplicateQueueTotal, setDuplicateQueueTotal] = useState(0);
  const [currentDuplicate, setCurrentDuplicate] = useState(null);
  const [liveMsg, setLiveMsg] = useState(""); // for screen-reader announcements
  const chunkSize = 5 * 1024 * 1024; // 5 MB
  const { showNotification } = useNotification();

  // Keep a map of active ManagedWebSocket instances so we can destroy them
  const activeSockets = React.useRef(new Map());

  // Helper: announce to screen reader without showing it visually
  const announce = useCallback((msg) => {
    setLiveMsg("");
    // RAF ensures the DOM sees the empty string before the new one
    requestAnimationFrame(() => setLiveMsg(msg));
  }, []);

  // ─── Resume in-progress uploads on component mount ──────────────────────
  useEffect(() => {
    if (!isHydrated) return;

    const inProgressFiles = files.filter(f =>
      (f.status === "Uploading" || f.status === "Processing") && f.id
    );

    inProgressFiles.forEach(file => {
      if (activeSockets.current.has(file.id)) return; // already connected

      const mws = new ManagedWebSocket(file.id, {
        onMessage: (data) => {
          if (data.type !== "progress" || data.job_id !== file.id) return;
          const prog = data.progress;
          updateFile(file.id, {
            progress_upload: prog.upload_pct !== undefined ? Math.round(prog.upload_pct) : undefined,
            progress_processing: prog.process_pct !== undefined ? Math.round(prog.process_pct) : undefined,
            status:
              prog.stage === "uploading" ? "Uploading"
              : prog.stage === "parsing" || prog.stage === "moving" ? "Processing"
              : prog.stage === "complete" ? "Complete"
              : undefined,
          });
          if (prog.stage === "complete") {
            mws.destroy();
            activeSockets.current.delete(file.id);
            showNotification({ message: `${file.name} processed successfully`, type: "success" });
            announce(`${file.name} has been processed successfully.`);
          }
        },
        onReconnect: (attempt) => {
          showNotification({ message: `Reconnecting to server… (attempt ${attempt})`, type: "warning" });
          announce(`Connection lost. Reconnecting, attempt ${attempt}.`);
        },
        onMaxRetriesReached: () => {
          updateFile(file.id, { error: "Connection lost. Could not reconnect.", status: "Error" });
          showNotification({ message: `Could not reconnect for ${file.name}. Please try again.`, type: "error", duration: 7000 });
          announce(`Connection permanently lost for ${file.name}.`);
        },
      });
      activeSockets.current.set(file.id, mws);
    });
  }, [isHydrated]);

  // Cleanup all sockets on unmount
  useEffect(() => {
    return () => {
      activeSockets.current.forEach(mws => mws.destroy());
      activeSockets.current.clear();
    };
  }, []);

  // ─── Duplicate queue ────────────────────────────────────────────────────
  useEffect(() => {
    if (duplicateQueue.length > 0 && !currentDuplicate) {
      setCurrentDuplicate(duplicateQueue[0]);
    }
  }, [duplicateQueue, currentDuplicate]);

  // ─── Drop handler ────────────────────────────────────────────────────────
  const onDrop = useCallback(acceptedFiles => {
    const duplicates = [];
    acceptedFiles.forEach(file => {
      const existingFile = getFileByName(file.name);
      if (existingFile && existingFile.status === "Pending") {
        duplicates.push(file);
      } else if (existingFile && existingFile.status !== "Pending") {
        const newFile = createFileObject(file);
        replaceFile(existingFile.id, newFile);
        showNotification({ message: `${file.name} re-added for processing`, type: "info" });
      } else {
        const newFile = createFileObject(file);
        addFile(newFile);
        showNotification({ message: `${file.name} added`, type: "info" });
      }
    });
    if (duplicates.length > 0) {
      setDuplicateQueue(prev => [...prev, ...duplicates]);
      setDuplicateQueueTotal(prev => prev + duplicates.length);
    }
  }, [getFileByName, addFile, replaceFile, showNotification]);

  const createFileObject = (file) => {
    const sizeMB = file.size / (1024 * 1024);
    const expectedTimeMs = Math.max(2000, sizeMB * 500);
    return {
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      size: file.size,
      status: "Pending",
      progress_upload: 0,
      progress_processing: 0,
      expectedTimeMs,
      startedAt: null,
      completedAt: null,
      uploadStartedAt: null,
      uploadCompletedAt: null,
      processStartedAt: null,
      processCompletedAt: null,
      file,
      error: null,
    };
  };

  const handleDuplicateConfirm = (confirmed) => {
    if (confirmed && currentDuplicate) {
      const existingFile = getFileByName(currentDuplicate.name);
      if (existingFile) {
        const newFile = createFileObject(currentDuplicate);
        replaceFile(existingFile.id, newFile);
        showNotification({ message: `${currentDuplicate.name} will be replaced`, type: "warning" });
      }
    }
    setDuplicateQueue(prev => prev.slice(1));
    setCurrentDuplicate(null);
  };

  // ─── Chunked upload ──────────────────────────────────────────────────────
  const uploadFile = async (fileObj) => {
    const file = fileObj.file;
    const totalChunks = Math.ceil(file.size / chunkSize);
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
        await uploadChunk({ chunk, chunkIndex: i, totalChunks, fileName: file.name, fileId: fileObj.id });
      }
    } catch (err) {
      const msg = isNetworkError(err)
        ? `Network error uploading ${file.name}. Please check your connection.`
        : `Failed to upload ${file.name}: ${err.message || "Unknown error"}`;
      updateFile(fileObj.id, { error: err.message || "Upload failed", status: "Error" });
      showNotification({ message: msg, type: "error", duration: 6000 });
      throw err;
    }
  };

  // ─── Main pipeline ───────────────────────────────────────────────────────
  const startUpload = async () => {
    let pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) return;

    const filesWithoutBlob = pendingFiles.filter(f => !f.file);
    const filesWithBlob = pendingFiles.filter(f => f.file);

    if (filesWithoutBlob.length > 0) {
      const fileNames = filesWithoutBlob.map(f => f.name).join(", ");
      showNotification({
        message: `Cannot re-upload previously saved files (${fileNames}). Please remove and re-add them.`,
        type: "warning",
        duration: 5000,
      });
      pendingFiles = filesWithBlob;
      if (pendingFiles.length === 0) return;
    }

    pendingFiles.forEach(f => {
      updateFile(f.id, { status: "Uploading", startedAt: Date.now(), uploadStartedAt: Date.now() });
    });

    const activeSessions = await Promise.all(pendingFiles.map(file =>
      new Promise((resolve) => {
        // Destroy any stale socket for this file before opening a new one
        if (activeSockets.current.has(file.id)) {
          activeSockets.current.get(file.id).destroy();
          activeSockets.current.delete(file.id);
        }

        const mws = new ManagedWebSocket(file.id, {
          onOpen: async () => {
            showNotification({ message: `Uploading ${file.name}`, type: "info" });
            announce(`Started uploading ${file.name}.`);
            try {
              await uploadFile(file);
              fetchAPI("/process", "POST", { fileName: file.name, fileId: file.id, userId: "" })
                .then(() => {
                  showNotification({ message: `Processing ${file.name}`, type: "info" });
                  announce(`${file.name} is now being processed.`);
                })
                .catch(err => {
                  updateFile(file.id, { error: err.message || "Failed to start processing", status: "Error" });
                  showNotification({ message: `Server error processing ${file.name}. Please try again.`, type: "error", duration: 6000 });
                });
              resolve({ file, mws });
            } catch (err) {
              resolve({ file, mws, error: true, errorType: "upload" });
            }
          },

          onMessage: (data) => {
            if (data.type !== "progress" || data.job_id !== file.id) return;
            const prog = data.progress;

            updateFile(file.id, {
              progress_upload: prog.upload_pct !== undefined ? Math.round(prog.upload_pct) : undefined,
              progress_processing: prog.process_pct !== undefined ? Math.round(prog.process_pct) : undefined,
              status:
                prog.stage === "uploading" ? "Uploading"
                : prog.stage === "parsing" || prog.stage === "moving" ? "Processing"
                : prog.stage === "complete" ? "Complete"
                : undefined,
              uploadCompletedAt: prog.upload_pct === 100 ? Date.now() : undefined,
              processStartedAt: (prog.stage === "parsing" || prog.stage === "moving") ? Date.now() : undefined,
              processCompletedAt: prog.stage === "complete" ? Date.now() : undefined,
              completedAt: prog.stage === "complete" ? Date.now() : undefined,
            });

            if (prog.stage === "complete") {
              mws.destroy();
              activeSockets.current.delete(file.id);
              showNotification({ message: `${file.name} processed successfully`, type: "success" });
              announce(`${file.name} has been processed successfully.`);
            }
          },

          onReconnect: (attempt) => {
            showNotification({ message: `Reconnecting for ${file.name}… (attempt ${attempt})`, type: "warning" });
            announce(`Reconnecting for ${file.name}, attempt ${attempt}.`);
          },

          onMaxRetriesReached: () => {
            updateFile(file.id, { error: "Connection lost. Could not reconnect.", status: "Error" });
            showNotification({ message: `Could not reconnect for ${file.name}. Check server status.`, type: "error", duration: 7000 });
            announce(`Connection permanently lost for ${file.name}.`);
            resolve({ file, mws, error: true, errorType: "connection" });
          },
        });

        activeSockets.current.set(file.id, mws);
      })
    ));

    const errorSessions = activeSessions.filter(s => s?.error);
    if (errorSessions.length > 0) {
      const successCount = activeSessions.length - errorSessions.length;
      if (successCount > 0) {
        showNotification({
          message: `${successCount} file(s) queued, ${errorSessions.length} failed.`,
          type: "warning",
          duration: 5000,
        });
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    noClick: true,   // we handle click/keyboard manually for accessibility
    noKeyboard: true,
  });

  const hasPendingFiles = files.some(f => f.status === "Pending");

  return (
    <section className="mb-16" role="region" aria-label="File upload area">
      {/* Visually-hidden live region for screen-reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
      >
        {liveMsg}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label={isDragActive ? "Release to drop CSV files" : "Drop CSV files here or press Enter to browse"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        onClick={open}
        className={cn(
          "relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20 border-2 border-dashed transition-all text-center mb-8 cursor-pointer group",
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_50px_rgba(79,70,229,0.2)]"
            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/50"
        )}
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-indigo-600/5 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-purple-600/5 blur-3xl" aria-hidden="true" />

        <input {...getInputProps()} aria-hidden="true" />
        <div className="relative z-10">
          <div
            className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500"
            aria-hidden="true"
          >
            <Upload size={40} />
          </div>
          <h4 className="text-2xl md:text-3xl font-black mb-4 text-white">
            {isDragActive ? (
              <span className="text-indigo-400">Release to drop files</span>
            ) : (
              <>Drop datasets or <span className="text-indigo-500">Browse</span></>
            )}
          </h4>
          <p className="text-gray-500 text-lg font-medium max-w-md mx-auto">
            High-speed ingestion for .CSV files up to 2GB. Multiple files supported.
          </p>
        </div>
      </div>

      <File files={files} onRemove={removeFile} />

      {hasPendingFiles && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={startUpload}
          aria-label="Start Processing Pipeline"
          aria-disabled={!hasPendingFiles}
          className="w-full sm:w-auto mt-8 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" aria-hidden="true" />
          Start Processing Pipeline
        </motion.button>
      )}

      <AnimatePresence>
        {currentDuplicate && (
          <DuplicateFileDialog
            fileName={currentDuplicate.name}
            currentIndex={duplicateQueueTotal - duplicateQueue.length + 1}
            total={duplicateQueueTotal}
            onConfirm={handleDuplicateConfirm}
            onCancel={() => {
              setDuplicateQueue(prev => prev.slice(1));
              setCurrentDuplicate(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
