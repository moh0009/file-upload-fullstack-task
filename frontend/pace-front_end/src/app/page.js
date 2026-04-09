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
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#191c1d]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full overflow-hidden">
        <main className="p-4 sm:p-8 lg:p-12">
          {/* Page Header */}
          <section className="mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2"
            >
              Systems Overview
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-500 max-w-2xl leading-relaxed"
            >
              The curation engine is currently processing academic records. Review the active pipelines and student metrics below.
            </motion.p>
          </section>

          {/* Active Pipelines */}
          {activeTab === "Upload file" && <UploadSection />}

          {/* Student Registry */}
          {activeTab === "Students" && <StudentsTable />}
        </main>
      </div>
    </div>
  );
}
