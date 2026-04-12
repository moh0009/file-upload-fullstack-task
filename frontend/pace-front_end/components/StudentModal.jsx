'use client';

import React, { useState, useEffect } from "react";
import { X, User, BookOpen, GraduationCap, Save, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";
import { useNotification } from "../context/NotificationContext";

import Dropdown from "./dropdown";

const StudentModal = ({ isOpen, onClose, student, mode = "view", onSuccess }) => {
  const [currentMode, setCurrentMode] = useState(mode);
  const [formData, setFormData] = useState({
    name: student?.name || "",
    subject: student?.subject || "",
    grade: student?.grade || 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'English Literature', 'Computer Science', 'Art', 'Music', 'Geography'].map(s => ({ value: s, label: s }));

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        subject: student.subject,
        grade: student.grade
      });
    }
  }, [student]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await fetchAPI(`/students/${student.id}`, "PUT", formData);
      if (data) {
        showNotification({ message: "Student updated successfully", type: "success" });
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      showNotification({ message: "Failed to update student", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] rounded-[2.5rem]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[151] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#030712] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden pointer-events-auto relative"
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-indigo-600/10 blur-[100px] -z-10" />
              
              {/* Header */}
              <div className="relative h-40 bg-gradient-to-br from-indigo-600 to-purple-700 p-8 flex items-end">
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                >
                  <X size={22} />
                </button>
                <div className="flex items-center gap-6 w-full">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl flex items-center justify-center text-white shrink-0">
                    <User size={40} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight truncate">
                      {currentMode === "edit" ? "Edit Record" : "Student profile"}
                    </h2>
                    <p className="text-white/60 text-sm font-bold uppercase tracking-widest">#{student.id} ClusterID</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {currentMode === "view" ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                          <User size={14} className="group-hover:text-indigo-400 transition-colors" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Full Name</span>
                        </div>
                        <p className="font-bold text-white text-lg tracking-tight">{student.name}</p>
                      </div>
                      <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                          <BookOpen size={14} className="group-hover:text-indigo-400 transition-colors" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subject</span>
                        </div>
                        <p className="font-bold text-white text-lg  tracking-tight">{student.subject}</p>
                      </div>
                    </div>

                    <div className="p-8 bg-indigo-600/5 rounded-[2rem] border border-indigo-500/20 flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                          <GraduationCap size={28} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em] mb-1">Compute Score</p>
                          <p className="text-4xl font-black text-white">{student.grade}%</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-5 py-2 rounded-xl text-xs font-black shadow-lg uppercase tracking-widest",
                        student.grade >= 50 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        {student.grade >= 50 ? "PASSING" : "FAILING"}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        onClick={() => setCurrentMode("edit")}
                        className="flex-1 bg-white/[0.03] border border-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/10 hover:border-indigo-500/40 transition-all flex items-center justify-center gap-3"
                      >
                        <Edit3 size={18} />
                        Edit Profile
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-500 hover:scale-[1.02] shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-1">Student Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input
                          required
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 font-bold text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-700"
                          type="text"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-1">Academic Subject</label>
                      <div className="relative group">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <Dropdown 
                          options={subjects}
                          value={subjects.find(s => s.value === formData.subject)}
                          onChange={(val) => setFormData({ ...formData, subject: val.value })}
                          className="w-full"
                          placeholder="Select Subject"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center ml-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Grade Score</label>
                          <span className="text-xl font-black text-white">{formData.grade}%</span>
                      </div>
                      <div className="px-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          value={formData.grade}
                          onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                        />
                        <div className="flex justify-between mt-3 px-1">
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">FAIL</span>
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Threshold: 50%</span>
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">EXCEL</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button
                        type="button"
                        onClick={() => setCurrentMode("view")}
                        className="flex-1 bg-white/[0.03] border border-white/5 text-gray-400 font-bold py-4 rounded-2xl hover:bg-white/10 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] bg-indigo-600 text-white font-black py-4 px-8 rounded-2xl hover:bg-indigo-500 hover:scale-[1.02] shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save size={20} />
                            Commit Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StudentModal;
