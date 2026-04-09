import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Play, Upload, Database } from "lucide-react";
import { cn } from "../lib/utils";
import File from "./File";

/**
 * UploadSection Component
 * Handles the drag-and-drop file upload interface, chunking logic,
 * and progress simulation for file uploads and processing.
 */
export default function UploadSection() {
  const [files, setFiles] = useState([]);
  const chunkSize = 5 * 1024 * 1024; // 5MB chunk size for multipart uploads
  const url = new URL("http://localhost:8080/api/");

  /**
   * Handles files dropped into the dropzone.
   * Calculates expected time based on file size and ensures unique IDs.
   * If a file with the same name exists, it replaces it.
   */
  const onDrop = React.useCallback(acceptedFiles => {
    setFiles(prev => {
      const updatedFiles = [...prev];
      acceptedFiles.forEach(file => {
        const sizeMB = file.size / (1024 * 1024);
        const expectedTimeMs = Math.max(1500, sizeMB * 10);
        
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

  /**
   * Removes a pending file from the list by ID.
   */
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  /**
   * Uploads a file to the backend in chunks.
   * Slices the file into `chunkSize` parts and sends them sequentially.
   * The backend automatically merges them when the last chunk is received.
   */
  const uploadFile = async (fileObj) => {
    const file = fileObj.file;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);

      const formData = new FormData();
      formData.append("file", chunk);
      formData.append("chunkIndex", i);
      formData.append("totalChunks", totalChunks);
      formData.append("fileName", file.name);
      formData.append("fileId", fileObj.id);

      await fetch(url.toString() + "upload", {
        method: "POST",
        body: formData
      }).catch(err => {
        console.error("Upload failed", err);
        resolve();
      });
    }
  };

  /**
   * Triggers the upload and processing workflow for all "Pending" files.
   * Connects to a WebSocket for real-time progress updates.
   */
  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) return;

    // Phase 1: Parallel Uploads
    setFiles(prev => prev.map(f => {
      if (f.status === "Pending") {
        return { ...f, status: "Uploading", startedAt: Date.now(), uploadStartedAt: Date.now() };
      }
      return f;
    }));

    const activeSessions = await Promise.all(pendingFiles.map(file => {
      return new Promise((resolve) => {
        const wsUrl = new URL("ws://localhost:8080/api/ws/progress");
        wsUrl.searchParams.append("fileId", file.id);
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          setFiles(currentFiles => currentFiles.map(f => {
            if (f.id === file.id) {
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
            }
            return f;
          }));
        };

        ws.onopen = async () => {
          await uploadFile(file);
          resolve({ file, ws });
        };

        ws.onerror = (err) => {
          console.error("WS error for", file.name, err);
          resolve({ file, ws, error: true }); 
        };
      });
    }));

    // Phase 2: Parallel Processing (Only once ALL files are uploaded)
    setFiles(prev => prev.map(f => {
      if (f.status === "Uploading") {
        return { ...f, status: "Processing", uploadCompletedAt: Date.now(), processStartedAt: Date.now() };
      }
      return f;
    }));

    await Promise.all(activeSessions.map(({ file, ws, error }) => {
      if (error) return Promise.resolve();

      return new Promise((resolve) => {
        const handleMsg = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "complete") {
            ws.removeEventListener("message", handleMsg);
            setTimeout(() => {
              ws.close();
              resolve();
            }, 100);
          }
        };
        ws.addEventListener("message", handleMsg);

        fetch(url.toString() + "process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileId: file.id,
          }),
        }).catch(err => {
          console.error("Failed to start processing for", file.name, err);
          resolve();
        });
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-bold tracking-tight">Active Pipelines</h3>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "bg-white rounded-3xl p-6 sm:p-8 border-2 border-dashed transition-colors text-center mb-8 cursor-pointer group",
          isDragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-400"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={cn(
            "mx-auto mb-4 transition-colors",
            isDragActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-400"
          )}
          size={44}
        />
        <h4 className="text-base sm:text-lg font-bold mb-2">
          {isDragActive ? (
            <span className="text-indigo-600">Drop the files here ...</span>
          ) : (
            <>
              Drop files or
              <button className="bg-slate-100 text-slate-900 px-2 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors ml-2 relative z-10">
                Browse Files
              </button>
            </>
          )}
        </h4>
        <p className="text-slate-500 text-xs sm:text-sm mb-6 max-w-sm mx-auto">
          Supported formats: .CSV
        </p>
      </div>
      <File files={files} onRemove={removeFile} />
      {files.some(f => f.status === "Pending") && (
        <button
          onClick={startUpload}
          className="w-full cursor-pointer  sm:w-auto mt-5 primary-gradient text-white px-6 sm:px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:scale-98 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Play size={16} fill="currentColor" />
          Start Import
        </button>
      )}
    </section>
  );
}
