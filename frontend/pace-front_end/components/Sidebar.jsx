import React from "react";
import { motion } from "motion/react";
import { Upload, Users, LineChart, HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { name: "Upload file", icon: Upload },
  { name: "Students", icon: Users },
  { name: "Analytics", icon: LineChart },
];

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const SidebarContent = () => (
    <>
      <div className="mb-10 px-2">
        <h1 className="text-xl font-bold tracking-tighter text-slate-900">Pace dashboard</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1">Speed Tier</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => {
              setActiveTab(item.name);
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "flex items-center w-full gap-3 px-3 py-2.5 transition-all duration-200 rounded-lg",
              activeTab === item.name
                ? "text-indigo-600 font-bold border-r-2 border-indigo-600 bg-slate-200/50"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <item.icon size={20} />
            <span className="text-sm">{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 space-y-1">
        <button className="flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-slate-900 transition-colors w-full text-left">
          <HelpCircle size={20} />
          <span className="text-sm">Support</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full py-8 px-4 w-64 border-r-0 bg-[#f3f4f5] z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <motion.aside
        initial={{ x: "-100%" }}
        animate={{ x: isMobileMenuOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="lg:hidden flex flex-col fixed left-0 top-0 h-full py-8 px-4 w-64 bg-[#f3f4f5] z-[70] shadow-2xl"
      >
        <SidebarContent />
      </motion.aside>
    </>
  );
}
