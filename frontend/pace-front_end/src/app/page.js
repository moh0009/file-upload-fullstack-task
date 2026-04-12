"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import Sidebar from "../../components/Sidebar";
import UploadSection from "../../components/UploadSection";
import StudentsTable from "../../components/StudentsTable";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Upload file");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#030712] text-white selection:bg-indigo-500/30 overflow-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[20%] left-[-5%] h-[400px] w-[400px] rounded-full bg-purple-600/5 blur-[100px]" />
      </div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen w-full relative">
        <header className="h-16 lg:h-20 flex items-center justify-between px-6 sm:px-12 border-b border-white/5 bg-[#030712]/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold tracking-tight text-white">{activeTab}</h2>
             <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-black bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">Page</span>
          </div>
        </header>

        <main className="p-6 sm:p-12 max-w-7xl mx-auto w-full">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >            
              <div className="space-y-8">
                <div className="flex flex-col gap-2">
                  <h3 className="text-3xl font-black text-white">{activeTab === "Upload file" ? "Data Ingestion" : "Student Registry"}</h3>
                  <p className="text-gray-500">{activeTab === "Upload file" ? "Upload your student records to start processing." : "Manage and analyze your processed student data."}</p>
                </div>
                {activeTab === "Upload file" && <UploadSection />}
                {activeTab === "Students" && <StudentsTable />}
              </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
