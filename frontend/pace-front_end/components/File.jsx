import React from "react";
import { motion } from "motion/react";
import { Database, X, Clock, ArrowUpCircle, Cpu, FileText } from "lucide-react";
import { cn } from "../lib/utils";

export default function File({ files, onRemove }) {
    if (!files || files.length === 0) return null;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {files.map((file) => {
                const isComplete = file.status === "Complete";
                const isUploading = file.status === "Uploading";
                const isProcessing = file.status === "Processing";
                const isPending = file.status === "Pending";

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

                return (
                    <div key={file.id} className="relative group bg-white/[0.03] border border-white/5 rounded-3xl p-6 backdrop-blur-md hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300">
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            {isPending && (
                                <button
                                    onClick={() => onRemove(file.id)}
                                    className="p-2 text-gray-500 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-all"
                                    title="Remove file"
                                >
                                    <X size={18} />
                                </button>
                            )}
                            <div className={cn(
                                "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 duration-500", 
                                isComplete ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            )}>
                                <Database size={32} />
                            </div>
                            
                            <div className="flex-1 min-w-0 w-full">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="min-w-0">
                                        <h5 className="font-bold text-white text-lg truncate flex items-center gap-2" title={file.name}>
                                            <FileText size={18} className="text-gray-500" />
                                            {file.name}
                                        </h5>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400 font-medium">
                                            <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 text-gray-300">
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-indigo-400" />
                                                <span className="text-white font-bold">{metrics.total}</span>
                                                <span className="opacity-60">{isComplete ? "Total" : "Est."}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-4 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-widest border shadow-lg sm:self-center self-start",
                                        isPending ? "bg-gray-800 text-gray-400 border-gray-700" :
                                            isUploading || isProcessing ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30 animate-pulse" : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                                    )}>
                                        {file.status}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    {/* Stages Summary */}
                                    <div className="flex gap-6 text-[11px] font-bold text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpCircle size={14} className={cn(isUploading ? "text-indigo-400" : "text-gray-700")} />
                                            <span className={isUploading ? "text-white" : ""}>UP: {metrics.upload.actual !== "N/A" ? metrics.upload.actual : metrics.upload.exp}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Cpu size={14} className={cn(isProcessing ? "text-indigo-400" : "text-gray-700")} />
                                            <span className={isProcessing ? "text-white" : ""}>PROC: {metrics.process.actual !== "N/A" ? metrics.process.actual : metrics.process.exp}</span>
                                        </div>
                                    </div>

                                    {/* Upload Progress */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span className={cn(isUploading ? "text-indigo-400" : "text-gray-500")}>Transmission Pipeline</span>
                                            <span className={isUploading ? "text-white" : "text-gray-600"}>{file.progress_upload}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${file.progress_upload}%` }}
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    file.progress_upload >= 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Processing Progress */}
                                    {(file.progress_processing > 0 || isProcessing || isComplete) && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className={cn(isProcessing ? "text-indigo-400" : "text-gray-500")}>Compute Engine</span>
                                                <span className={isProcessing ? "text-white" : "text-gray-600"}>{file.progress_processing}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${file.progress_processing}%` }}
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        file.progress_processing >= 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
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