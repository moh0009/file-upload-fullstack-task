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
                    return `${(ms / 1000).toFixed(1)}s`;
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
                    <div key={file.id} className="bg-white p-5 rounded-2xl flex items-center gap-5 border border-slate-100 shadow-sm relative group">
                        {isPending && (
                            <button
                                onClick={() => onRemove(file.id)}
                                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove file"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center", isComplete ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600")}>
                            <Database size={30} />
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                            <div className="flex justify-between items-start mb-3 gap-3">
                                <div className="min-w-0 flex-1">
                                    <h5 className="font-bold text-slate-900 truncate flex items-center gap-2" title={file.name}>
                                        <FileText size={14} className="text-slate-400 shrink-0" />
                                        {file.name}
                                    </h5>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1 font-medium bg-slate-50 px-1.5 py-0.5 rounded text-slate-600">
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </span>

                                        <span className="flex items-center gap-1">
                                            <Clock size={11} className="text-indigo-400" />
                                            <span className="font-semibold text-slate-700">{metrics.total}</span>
                                            <span className="text-slate-400">{isComplete ? "Total" : "Est."}</span>
                                        </span>

                                        <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
                                            <div className="flex items-center gap-1 group/metric" title={`Expected Upload: ${metrics.upload.exp}`}>
                                                <ArrowUpCircle size={11} className={cn("text-slate-400", isUploading && "text-indigo-500 animate-pulse")} />
                                                <span className="text-slate-400 shrink-0">Up:</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={cn("font-medium", isComplete ? "text-slate-600" : "text-slate-500")}>
                                                        {metrics.upload.actual !== "N/A" ? metrics.upload.actual : metrics.upload.exp}
                                                    </span>
                                                    {isComplete && metrics.upload.actual !== "N/A" && (
                                                        <span className="text-[9px] text-slate-300 italic">est. {metrics.upload.exp}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 group/metric" title={`Expected Process: ${metrics.process.exp}`}>
                                                <Cpu size={11} className={cn("text-slate-400", isProcessing && "text-indigo-500 animate-pulse")} />
                                                <span className="text-slate-400 shrink-0">Proc:</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={cn("font-medium", isComplete ? "text-slate-600" : "text-slate-500")}>
                                                        {metrics.process.actual !== "N/A" ? metrics.process.actual : metrics.process.exp}
                                                    </span>
                                                    {isComplete && metrics.process.actual !== "N/A" && (
                                                        <span className="text-[9px] text-slate-300 italic">est. {metrics.process.exp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <span className={cn(
                                    "shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider",
                                    isPending ? "bg-slate-100 text-slate-500" :
                                        isUploading || isProcessing ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                                )}>
                                    {file.status}
                                </span>
                            </div>
                            <div className="mt-4 space-y-4">
                                {/* Upload Stage */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                                        <span className={cn("flex items-center gap-1.5", isUploading ? "text-indigo-600" : "text-slate-400")}>
                                            <ArrowUpCircle size={12} className={cn(isUploading && "animate-pulse")} />
                                            Upload {file.progress_upload >= 100 ? "Complete" : isUploading ? "Active" : "Pending"}
                                        </span>
                                        <span className={cn(isUploading ? "text-indigo-600" : "text-slate-500")}>{file.progress_upload}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${file.progress_upload}%` }}
                                            transition={{ duration: 0.7, ease: "easeOut" }}
                                            className={cn(
                                                "h-full rounded-full transition-colors duration-500",
                                                file.progress_upload >= 100 ? "bg-emerald-500" : "bg-indigo-600"
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Processing Stage */}
                                {(file.progress_processing > 0 || isProcessing || isComplete) && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                                            <span className={cn("flex items-center gap-1.5", isProcessing ? "text-indigo-600" : "text-slate-400")}>
                                                <Cpu size={12} className={cn(isProcessing && "animate-pulse")} />
                                                Processing {file.progress_processing >= 100 ? "Complete" : isProcessing ? "Active" : "Waiting"}
                                            </span>
                                            <span className={cn(
                                                "font-bold",
                                                file.progress_processing >= 100 ? "text-emerald-600" : (isProcessing ? "text-indigo-600" : "text-slate-500")
                                            )}>{file.progress_processing}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${file.progress_processing}%` }}
                                                transition={{ duration: 0.7, ease: "easeOut" }}
                                                className={cn(
                                                    "h-full rounded-full transition-colors duration-500",
                                                    file.progress_processing >= 100 ? "bg-emerald-500" : "bg-indigo-600"
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}