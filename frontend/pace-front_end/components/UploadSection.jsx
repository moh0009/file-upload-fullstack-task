import React, { useState } from "react";
import { motion } from "motion/react";
import { useDropzone } from "react-dropzone";
import { Play, Upload } from "lucide-react";
import { cn, uploadChunk, connectWS } from "../lib/utils";
import fetchAPI from "../lib/utils";
import File from "./File";
import { useNotification } from "../context/NotificationContext";

/**
 * UploadSection Component
 * Handles drag-and-drop file upload, chunked transfers with real progress,
 * and WebSocket-driven processing progress updates.
 */
export default function UploadSection() {
  const [files, setFiles] = useState([]);
  const chunkSize = 5 * 1024 * 1024; // 5 MB
  const { showNotification } = useNotification();

  // ─── Drop handler ──────────────────────────────────────────────────────────
  const onDrop = React.useCallback(acceptedFiles => {
    setFiles(prev => {
      const updatedFiles = [...prev];
      acceptedFiles.forEach(file => {
        const sizeMB = file.size / (1024 * 1024);
        const expectedTimeMs = Math.max(2000, sizeMB * 500);

        const newFile = {
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
        };

        const existingIndex = updatedFiles.findIndex(f => f.name === file.name);
        if (existingIndex !== -1) {
          updatedFiles[existingIndex] = newFile;
        } else {
          updatedFiles.push(newFile);
        }
      });
      return updatedFiles;
    });
  }, []);

  // ─── Remove pending file ───────────────────────────────────────────────────
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // ─── Chunked upload with real progress ────────────────────────────────────
  /**
   * Uploads `fileObj.file` in chunks, updating `progress_upload` in state
   * after every chunk using a weighted average across total bytes.
   */
  const uploadFile = async (fileObj) => {
    const file = fileObj.file;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);

      await uploadChunk({
        chunk,
        chunkIndex: i,
        totalChunks,
        fileName: file.name,
        fileId: fileObj.id,
        onProgress: (chunkPct) => {
          // Overall progress = completed chunks + current chunk fraction
          const overall = Math.round(((i + chunkPct / 100) / totalChunks) * 100);
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, progress_upload: overall } : f
          ));
        },
      });
    }

    // Mark upload at 100% when all chunks are done
    setFiles(prev => prev.map(f =>
      f.id === fileObj.id ? { ...f, progress_upload: 100 } : f
    ));
  };

  // ─── Start pipeline ────────────────────────────────────────────────────────
  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) return;

    // Phase 1: mark all pending as Uploading and open WebSockets
    setFiles(prev => prev.map(f =>
      f.status === "Pending"
        ? { ...f, status: "Uploading", startedAt: Date.now(), uploadStartedAt: Date.now() }
        : f
    ));

    const activeSessions = await Promise.all(pendingFiles.map(file =>
      new Promise((resolve) => {
        const ws = connectWS(file.id);

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          setFiles(currentFiles => currentFiles.map(f => {
            if (f.id !== file.id) return f;
            const update = { ...f };

            if (data.type === "upload") {
              update.progress_upload = data.progress;
            } else if (data.type === "processing") {
              update.progress_processing = data.progress;
              if (update.status !== "Processing") {
                update.status = "Processing";
                if (!update.processStartedAt) update.processStartedAt = Date.now();
              }
            } else if (data.type === "complete") {
              update.status = "Complete";
              update.progress_processing = 100;
              if (!update.processCompletedAt) {
                update.processCompletedAt = Date.now();
                update.completedAt = Date.now();
              }
            }
            return update;
          }));
        };

        ws.onopen = async () => {
          showNotification({ message: `Uploading ${file.name}`, type: "info" });
          await uploadFile(file);
          resolve({ file, ws });
        };

        ws.onerror = (err) => {
          console.error("WS error for", file.name, err);
          showNotification({ message: `Error uploading ${file.name}`, type: "error" });
          resolve({ file, ws, error: true });
        };
      })
    ));

    // Phase 2: trigger processing for each uploaded file
    setFiles(prev => prev.map(f =>
      f.status === "Uploading"
        ? { ...f, status: "Processing", uploadCompletedAt: Date.now(), processStartedAt: Date.now() }
        : f
    ));

    await Promise.all(activeSessions.map(({ file, ws, error }) => {
      if (error) return Promise.resolve();

      return new Promise((resolve) => {
        const handleMsg = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "complete") {
            ws.removeEventListener("message", handleMsg);
            setTimeout(() => { ws.close(); resolve(); }, 100);
            showNotification({ message: `${file.name} processed successfully`, type: "success" });
          }
        };
        ws.addEventListener("message", handleMsg);

        showNotification({ message: `${file.name} uploaded — starting processing`, type: "success" });

        fetchAPI("/process", "POST", { fileName: file.name, fileId: file.id })
          .catch(err => {
            console.error("Failed to start processing for", file.name, err);
            resolve();
          });

        showNotification({ message: `Processing ${file.name}`, type: "info" });
      });
    }));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    }
  });

  return (
    <section className="mb-16">
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20 border-2 border-dashed transition-all text-center mb-8 cursor-pointer group",
          isDragActive 
            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_50px_rgba(79,70,229,0.2)]" 
            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/50"
        )}
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-purple-600/5 blur-3xl" />

        <input {...getInputProps()} />
        <div className="relative z-10">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
            <Upload size={40} />
          </div>
          <h4 className="text-2xl md:text-3xl font-black mb-4 text-white">
            {isDragActive ? (
              <span className="text-indigo-400">Release to drop files</span>
            ) : (
              <>
                Drop datasets or <span className="text-indigo-500">Browse</span>
              </>
            )}
          </h4>
          <p className="text-gray-500 text-lg font-medium max-w-md mx-auto">
            High-speed ingestion for .CSV files up to 2GB. Multiple files supported.
          </p>
        </div>
      </div>

      <File files={files} onRemove={removeFile} />
      
      {files.some(f => f.status === "Pending") && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={startUpload}
          className="w-full sm:w-auto mt-8 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" />
          Start Processing Pipeline
        </motion.button>
      )}
    </section>
  );
}
