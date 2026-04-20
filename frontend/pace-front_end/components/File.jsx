import React from "react";
import { motion } from "motion/react";
import { Database, X, Clock, ArrowUpCircle, Cpu, FileText, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";

export default function File({ files, onRemove, onRetry }) {
    if (!files || files.length === 0) return null;

    return (
        <div
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
            role="list"
            aria-label="Uploaded files"
        >
            {files.map((file) => {
                const isComplete = file.status === "Complete";
                const isUploading = file.status === "Uploading";
                const isProcessing = file.status === "Processing";
                const isPending = file.status === "Pending";
                const isError = file.status === "Error";
                const isSessionExpired = isPending && !file.file;

                const formatTime = (ms) => {
                    if (ms < 1000) return `${Math.round(ms)}ms`;
                    const totalSeconds = ms / 1000;
                    if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = Math.floor(totalSeconds % 60);
                    return `${minutes}m ${seconds}s`;
                };

                const expPhaseTime = formatTime(file.expectedTimeMs);
                const metrics = {
                    total: formatTime(0),
                    upload: { exp: expPhaseTime, actual: "N/A" },
                    process: { exp: expPhaseTime, actual: "N/A" }
                };

                if (isPending || isUploading || isProcessing) {
                    metrics.total = formatTime(file.expectedTimeMs * 2);
                } else if (isComplete && file.startedAt && file.completedAt) {
                    metrics.total = formatTime(file.completedAt - file.startedAt);
                    if (file.uploadStartedAt && file.uploadCompletedAt) {
                        metrics.upload.actual = formatTime(file.uploadCompletedAt - file.uploadStartedAt);
                    }
                    if (file.processStartedAt && file.processCompletedAt) {
                        metrics.process.actual = formatTime(file.processCompletedAt - file.processStartedAt);
                    }
                }

                // Determine accessible status label
                const statusLabel = isSessionExpired ? "Session Expired" : file.status;

                return (
                    <div
                        key={file.id}
                        role="listitem"
                        className="relative group bg-white/[0.03] border border-white/5 rounded-3xl p-6 backdrop-blur-md hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
                        aria-label={`File: ${file.name}, Status: ${statusLabel}`}
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            {(isPending || isError || isSessionExpired) && (
                                <div className="flex gap-2">
                                    {isError && onRetry && (
                                        <button
                                            onClick={() => onRetry(file.id)}
                                            className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-xl transition-all"
                                            aria-label={`Retry upload for ${file.name}`}
                                            title="Retry upload/processing"
                                        >
                                            <RotateCcw size={18} aria-hidden="true" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onRemove(file.id)}
                                        className="p-2 text-gray-500 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-all"
                                        aria-label={`Remove file ${file.name}`}
                                        title="Remove file"
                                    >
                                        <X size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            )}

                            <div className={cn(
                                "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 duration-500",
                                isComplete ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                isError ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                                isSessionExpired ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            )} aria-hidden="true">
                                <Database size={32} />
                            </div>

                            <div className="flex-1 min-w-0 w-full">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="min-w-0">
                                        <h5
                                            className="font-bold text-white text-lg truncate flex items-center gap-2"
                                            title={file.name}
                                        >
                                            <FileText size={18} className="text-gray-500" aria-hidden="true" />
                                            {file.name}
                                        </h5>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400 font-medium">
                                            <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 text-gray-300">
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-indigo-400" aria-hidden="true" />
                                                <span className="text-white font-bold">{metrics.total}</span>
                                                <span className="opacity-60">{isComplete ? "Total" : "Est."}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status badge — aria-live so transitions are announced */}
                                    <span
                                        aria-live="polite"
                                        aria-atomic="true"
                                        className={cn(
                                            "px-4 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-widest border shadow-lg sm:self-center self-start",
                                            isSessionExpired ? "bg-amber-600/20 text-amber-400 border-amber-500/30" :
                                            isPending ? "bg-gray-800 text-gray-400 border-gray-700" :
                                            isError ? "bg-rose-600/20 text-rose-400 border-rose-500/30" :
                                            isUploading || isProcessing ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30 animate-pulse" :
                                            "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                                        )}
                                    >
                                        {statusLabel}
                                    </span>
                                </div>

                                {isSessionExpired && (
                                    <div
                                        role="alert"
                                        className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2"
                                    >
                                        <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                                        <p className="text-xs text-amber-300 font-medium">
                                            Page was reloaded. Please remove and re-add this file to upload it.
                                        </p>
                                    </div>
                                )}

                                {isError && file.error && (
                                    <div
                                        role="alert"
                                        className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl"
                                    >
                                        <p className="text-xs text-rose-300 font-medium mb-2">{file.error}</p>
                                        {onRetry && (
                                            <button
                                                onClick={() => onRetry(file.id)}
                                                className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 bg-amber-400/10 hover:bg-amber-400/20 rounded-lg border border-amber-400/30 transition-all inline-flex items-center gap-1.5"
                                                aria-label={`Retry ${file.name}`}
                                            >
                                                <RotateCcw size={14} aria-hidden="true" />
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {/* Stage summary */}
                                    <div className="flex gap-6 text-[11px] font-bold text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpCircle
                                                size={14}
                                                className={cn(isUploading ? "text-indigo-400" : "text-gray-700")}
                                                aria-hidden="true"
                                            />
                                            <span className={isUploading ? "text-white" : ""}>
                                                UP: {metrics.upload.actual !== "N/A" ? metrics.upload.actual : metrics.upload.exp}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Cpu
                                                size={14}
                                                className={cn(isProcessing ? "text-indigo-400" : "text-gray-700")}
                                                aria-hidden="true"
                                            />
                                            <span className={isProcessing ? "text-white" : ""}>
                                                PROC: {metrics.process.actual !== "N/A" ? metrics.process.actual : metrics.process.exp}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Upload progress bar */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span
                                                id={`upload-label-${file.id}`}
                                                className={cn(isUploading ? "text-indigo-400" : "text-gray-500")}
                                            >
                                                Transmission Pipeline
                                            </span>
                                            <span className={isUploading ? "text-white" : "text-gray-600"}>
                                                {file.progress_upload}%
                                            </span>
                                        </div>
                                        <div
                                            role="progressbar"
                                            aria-valuenow={file.progress_upload}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-labelledby={`upload-label-${file.id}`}
                                            aria-label={`Upload progress for ${file.name}`}
                                            className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5"
                                        >
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${file.progress_upload}%` }}
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    file.progress_upload >= 100
                                                        ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                        : "bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Processing progress bar */}
                                    {(file.progress_processing > 0 || isProcessing || isComplete) && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span
                                                    id={`proc-label-${file.id}`}
                                                    className={cn(isProcessing ? "text-indigo-400" : "text-gray-500")}
                                                >
                                                    Compute Engine
                                                </span>
                                                <span className={isProcessing ? "text-white" : "text-gray-600"}>
                                                    {file.progress_processing}%
                                                </span>
                                            </div>
                                            <div
                                                role="progressbar"
                                                aria-valuenow={file.progress_processing}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-labelledby={`proc-label-${file.id}`}
                                                aria-label={`Processing progress for ${file.name}`}
                                                className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5"
                                            >
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${file.progress_processing}%` }}
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        file.progress_processing >= 100
                                                            ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                            : "bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}