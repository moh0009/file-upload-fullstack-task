import React from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Upload, Users, Github, Database, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { name: "Upload file", icon: Upload },
  { name: "Students", icon: Users },
];

const repoUrl = "https://github.com/moh0009/file-upload-fullstack-task";

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-10 px-2 lg:px-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-transform group-hover:scale-110">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">PACE</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400/80 font-bold -mt-0.5">Dashboard</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 lg:px-2">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => {
              setActiveTab(item.name);
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "flex items-center w-full gap-3 px-4 py-3.5 transition-all duration-300 rounded-2xl group",
              activeTab === item.name
                ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] font-bold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-transform group-hover:scale-110",
              activeTab === item.name ? "text-white" : "text-gray-500 group-hover:text-indigo-400"
            )} />
            <span className="text-sm tracking-wide">{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 space-y-4 border-t border-white/5 lg:px-2">
        <button className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white transition-all w-full text-left rounded-xl hover:bg-white/5" onClick={() => {window.open(repoUrl, "_blank")}}> 
          <Github size={20} />
          <span className="text-sm font-medium">Repository</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header (Only visible on mobile when sidebar is closed) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#030712]/80 backdrop-blur-md border-b border-white/10 z-[40] flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Database className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-black text-white">PACE</span>
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-gray-400 hover:text-white"
        >
          <Menu className="h-7 w-7" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full py-8 px-4 w-72 border-r border-white/5 bg-[#030712] z-50">
        {/* Glow behind sidebar */}
        <div className="absolute top-0 left-0 h-64 w-64 bg-indigo-600/5 blur-[100px] -z-10" />
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            {/* Mobile Sidebar Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden flex flex-col fixed left-0 top-0 h-full py-8 px-6 w-[85%] max-w-[320px] bg-[#030712] z-[70] shadow-2xl border-r border-white/10"
            >
              <div className="absolute top-6 right-6">
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500">
                  <X className="h-7 w-7" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
