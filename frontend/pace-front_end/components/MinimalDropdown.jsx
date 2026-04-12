import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Trash2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";
import { useNotification } from "../context/NotificationContext";
import StudentModal from "./StudentModal";

const MinimalDropdown = ({ actions, student, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const dropdownRef = useRef(null);
  const { showNotification } = useNotification();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultActions = [
    { 
      label: "View Details", 
      icon: <Eye size={14} />, 
      onClick: () => {
        setModalMode("view");
        setIsModalOpen(true);
      }, 
      color: "text-gray-400 group-hover:text-white" 
    },
    { 
      label: "Edit Student", 
      icon: <Edit2 size={14} />, 
      onClick: () => {
        setModalMode("edit");
        setIsModalOpen(true);
      }, 
      color: "text-indigo-400 group-hover:text-indigo-300" 
    },
    { label: "Delete Student", icon: <Trash2 size={14} />, onClick: async () => {
      try {
        const data = await fetchAPI(`/students/${student.id}`, "DELETE", null);
        if (data) {
          showNotification({ message: "Student deleted successfully", type: "success" });
          onSuccess?.();
        }
      } catch (err) {
        showNotification({ message: "Failed to delete student", type: "error" });
      }
    }, color: "text-rose-500 group-hover:text-rose-400" },
  ];

  const displayActions = actions || defaultActions;

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-2 rounded-xl transition-all duration-300 flex items-center justify-center border",
            isOpen 
              ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)]" 
              : "text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"
          )}
        >
          <MoreVertical size={18} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 mt-3 w-52 bg-[#030712] rounded-[1.25rem] shadow-2xl border border-white/10 py-2.5 z-[100] overflow-hidden backdrop-blur-2xl"
            >
              <div className="px-4 py-2 mb-1 border-b border-white/5">
                 <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Student Actions</p>
              </div>
              {displayActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-xs flex items-center gap-3 transition-all text-left group",
                    "hover:bg-white/[0.04]",
                    action.color || "text-gray-400"
                  )}
                >
                  <span className="shrink-0 transition-transform group-hover:scale-110">{action.icon}</span>
                  <span className="font-bold tracking-wide">{action.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        student={student} 
        mode={modalMode}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default MinimalDropdown;
