'use client';

import React, { useEffect, useState, useRef } from "react";
import { UserSearch, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import Dropdown from "./dropdown";
import MinimalDropdown from "./MinimalDropdown";
import GradeSlider from "./GradeSlider";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";

export default function StudentsTable() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [searchNameQuery, setSearchNameQuery] = useState("");
  const [subjectSelected, setSubjectSelected] = useState("");
  const [gradeMin, setGradeMin] = useState(0);
  const [gradeMax, setGradeMax] = useState(100);
  const totalPages = Math.ceil(totalCount / pageSize);

  const subjectOptions = ['All Subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'English Literature', 'Computer Science', 'Art', 'Music', 'Geography'].map(s => ({ value: s, label: s }));
  const pageSizeOptions = [10, 25, 50, 100].map(n => ({ value: n, label: `${n} per page` }));

  const fetchStudents = async ({ 
    page, 
    cursor = null, 
    direction = 'next', 
    sort = sortConfig, 
    name = searchNameQuery || null, 
    subject = subjectSelected || null,
    minG = gradeMin || null,
    maxG = gradeMax || null,
    signal,
  }) => {
    setIsLoading(true);
    try {
      let sortQuery = "";
      if (sort.key && sort.direction) {
        sortQuery = `&sortBy=${sort.key} ${sort.direction.toUpperCase()}`;
      }

      let cursorParams = "";
      if (cursor) {
        const { id, value } = cursor;
        if (direction === 'next') {
          cursorParams = `&afterId=${id}&afterValue=${encodeURIComponent(value)}`;
        } else {
          cursorParams = `&beforeId=${id}&beforeValue=${encodeURIComponent(value)}`;
        }
      }

      let nameQuery = name ? `&name=${name}` : "";
      let subjectQuery = subject ? `&subject=${subject}` : "";
      let gradeQuery = "";
      if (minG !== null && minG !== undefined && minG !== 0) gradeQuery += `&gradeMin=${minG}`;
      if (maxG !== null && maxG !== undefined && maxG !== 100) gradeQuery += `&gradeMax=${maxG}`;

      const data = await fetchAPI(
        `/students?pageSize=${pageSize}${sortQuery}${cursorParams}${nameQuery}${subjectQuery}${gradeQuery}`,
        "GET", null, signal
      );
      if (data === null) return; // aborted or errored
      if (Array.isArray(data)) {
        setStudents(data);
        setCurrentPage(page);
      } else {
        setStudents([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCount = async (filters = {}, signal) => {
    const { name, subject, minG, maxG } = filters;
    let queryParams = "";
    if (name) queryParams += `&name=${name}`;
    if (subject) queryParams += `&subject=${subject}`;
    if (minG !== null && minG !== undefined && minG !== 0) queryParams += `&gradeMin=${minG}`;
    if (maxG !== null && maxG !== undefined && maxG !== 100) queryParams += `&gradeMax=${maxG}`;

    const data = await fetchAPI(`/students/count?${queryParams}`, "GET", null, signal);
    if (data === null) return 0; // aborted
    if (typeof data.count === "number") {
      setTotalCount(data.count);
      return data.count;
    }
    return 0;
  };

  const refreshData = async (signal) => {
    const filters = { name: searchNameQuery, subject: subjectSelected, minG: gradeMin, maxG: gradeMax };
    const count = await fetchCount(filters, signal);
    if (signal?.aborted) return;

    if (count > 0) {
      await fetchStudents({ page: 1, ...filters, signal });
    } else {
      setStudents([]);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      refreshData(controller.signal);
    }, 300);

    // Cleanup: cancel any in-flight requests AND clear pending debounce
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pageSize, searchNameQuery, subjectSelected, gradeMin, gradeMax]);

  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) {
      const lastItem = students[students.length - 1];
      const sortKey = sortConfig.key || 'id';
      fetchStudents({ 
        page: currentPage + 1, 
        direction: 'next',
        cursor: { id: lastItem.id, value: lastItem[sortKey] }
      });
    } else if (direction === 'prev' && currentPage > 1) {
      const firstItem = students[0];
      const sortKey = sortConfig.key || 'id';
      fetchStudents({ 
        page: currentPage - 1, 
        direction: 'prev',
        cursor: { id: firstItem.id, value: firstItem[sortKey] }
      });
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (key === "id") {
      direction = "desc";
    }
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }

    const newSort = { key: direction ? key : null, direction };
    setSortConfig(newSort);
    // Reset to page 1 on sort change
    fetchStudents({ page: 1, sort: newSort });
  };

  // Pagination logic: mimicing the range-based style from the photo
  const getPaginationItems = () => {
    const range = [];
    if (totalPages <= 10) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
      return range;
    }

    // Show first 4, dots, last 4 (as seen in photo)
    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    
    if (currentPage >= totalPages - 2) {
      return [1, 2, 3, 4, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    // Middle case
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const paginationItems = getPaginationItems();




  const stats = [
    { label: "Total Registry", value: totalCount, icon: <UserSearch className="text-indigo-400" size={24} />, color: "from-indigo-600/20 to-indigo-900/20", border: "border-indigo-500/30" },
    { label: "Compliance Rate", value: `${totalCount > 0 ? Math.round(students.filter(s => s.grade >= 50).length / (students.length || 1) * 100) : 0}%`, icon: <ArrowUp className="text-emerald-400" size={24} />, color: "from-emerald-600/20 to-emerald-900/20", border: "border-emerald-500/30" },
    { label: "Global Average", value: `${Math.round(students.reduce((acc, curr) => acc + curr.grade, 0) / (students.length || 1))}%`, icon: <ArrowUpDown className="text-purple-400" size={24} />, color: "from-purple-600/20 to-purple-900/20", border: "border-purple-500/30" },
  ];

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const resetFilters = () => {
    setSearchNameQuery("");
    setSubjectSelected(null);
    setGradeMin(0);
    setGradeMax(100);
    refreshData();
  };

  return (
    <section>
      {/* Analytics Command Center */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div key={i} className={cn("relative overflow-hidden p-8 rounded-[2.5rem] border bg-gradient-to-br transition-all hover:scale-[1.02] cursor-default", stat.color, stat.border)}>
            <div className="flex items-center gap-6">
              <div className="w-17 h-17 p-2 rounded-[1.25rem] bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-md">
                {stat.icon}
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1.5">{stat.label}</p>
                <p className="text-2xl font-black text-white tracking-tighter leading-none">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row xl:items-stretch gap-4 mb-12">
        <div className="bg-white/[0.03] border border-white/10 p-7 rounded-[2.5rem] flex flex-col flex-1 min-h-[160px] hover:bg-white/[0.05] transition-all group">
          <div className="flex justify-between items-center mb-auto shrink-0 px-1">
             <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Search Pipeline</label>
             </div>
             {searchNameQuery && <span className="text-[9px] font-black px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest animate-in fade-in zoom-in duration-300">Active</span>}
          </div>
          <div className="relative mt-6">
            <UserSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={22} />
            <input
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-4 py-4 text-sm text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-600 font-bold"
              placeholder="Search identifiers..."
              type="text"
              value={searchNameQuery}
              onChange={(e) => setSearchNameQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 p-7 rounded-[2.5rem] flex flex-col flex-1 min-h-[160px] hover:bg-white/[0.05] transition-all group">
          <div className="flex justify-between items-center mb-auto shrink-0 px-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Intelligence Category</label>
              {subjectSelected && <span className="text-[9px] font-black px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full uppercase tracking-widest">{subjectSelected}</span>}
          </div>
          <div className="mt-6">
            <Dropdown 
              options={subjectOptions} 
              placeholder="All Subjects" 
              value={subjectSelected ? subjectOptions.find(o => o.value === subjectSelected) : null}
              onChange={(val) => setSubjectSelected(val.value === "All Subjects" ? null : val.value)} 
              />
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 p-7 rounded-[2.5rem] flex flex-col flex-1 p-10 xl:min-w-[340px] hover:bg-white/[0.05] transition-all group">
           <div className="flex h-full flex-col justify-center">
             <GradeSlider 
                min={0} 
                max={100} 
                values={[gradeMin, gradeMax]} 
                onChange={([min, max]) => {
                  setGradeMin(min);
                  setGradeMax(max);
                }} 
             />
           </div>
        </div>

        <button 
           onClick={resetFilters}
           className="bg-indigo-600/10 border border-indigo-500/20 p-7 rounded-[2.5rem] flex flex-col items-center justify-center hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 transition-all text-indigo-400 hover:text-white min-w-[120px] group"
        >
           <ArrowUpDown className="mb-2 group-hover:rotate-180 transition-transform duration-500" size={24} />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center">Reset<br/>Core</span>
        </button>
      </div>

      <div className="relative rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
        <div className="">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white/[0.01] border-b border-white/5 ">
                <th className="px-10 py-7 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("id")}>
                  <div className="flex items-center gap-4">
                    ID {sortConfig.key === "id" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-400" /> : <ArrowDown size={14} className="text-indigo-400" />) : <ArrowUpDown size={14} className="opacity-10" />}
                  </div>
                </th>
                <th className="px-10 py-7 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-4">
                    Core Identifier {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-400" /> : <ArrowDown size={14} className="text-indigo-400" />) : <ArrowUpDown size={14} className="opacity-10" />}
                  </div>
                </th>
                <th className="px-10 py-7 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">
                  Academic Context
                </th>
                <th className="px-10 py-7 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("grade")}>
                  <div className="flex items-center gap-4">
                    Compute Score {sortConfig.key === "grade" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-400" /> : <ArrowDown size={14} className="text-indigo-400" />) : <ArrowUpDown size={14} className="opacity-10" />}
                  </div>
                </th>
                <th className="px-10 py-7 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-40 text-center pointer-events-none">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_20px_rgba(79,70,229,0.4)]"></div>
                      <p className="text-sm font-black text-indigo-400 uppercase tracking-[0.5em] animate-pulse">Processing Cluster Data</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-40 text-center">
                    <p className="text-gray-500 font-black uppercase tracking-widest text-sm">No records detected in this quadrant.</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-white/[0.04] transition-all duration-300 group cursor-default">
                    <td className="px-10 py-5">
                      <span className="font-bold text-gray-500 text-xs sm:text-sm group-hover:text-white transition-colors">#{student.id}</span>
                    </td>
                    <td className="px-10 py-5">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                            {getInitials(student.name)}
                         </div>
                         <div>
                            <p className="font-bold text-white text-base tracking-tight mb-0.5">{student.name}</p>
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Verified Academic</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-10 py-5">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                         <span className="text-gray-400 text-sm font-bold tracking-tight">{student.subject}</span>
                      </div>
                    </td>
                    <td className="px-10 py-5">
                        <span
                          className={cn(
                            "px-3 py-1.5 text-xs font-black rounded-xl border tabular-nums shadow-sm",
                            student.grade >= 50 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}
                        >
                          {student.grade}%
                        </span>
                    </td>
                    <td >
                      <MinimalDropdown student={student} onSuccess={refreshData} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-8 bg-white/[0.01] border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex flex-col">
               <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-1">Observation Window</p>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                 Showing <span className="text-white">{(currentPage - 1) * pageSize + 1}—{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-white">{totalCount}</span>
               </p>
            </div>
            <div className="w-[180px]">
              <Dropdown
                options={pageSizeOptions}
                value={pageSizeOptions.find(opt => opt.value === pageSize)}
                onChange={(opt) => setPageSize(opt.value)}
                menuPlacement="top"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
               onClick={() => handlePageChange('prev')}
               disabled={currentPage === 1}
               className="group flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/10 hover:border-indigo-500/50 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest pr-2">Prev</span>
            </button>
            
            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 shadow-inner">
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Sector</span>
               <span className="text-lg font-black text-white px-2 mb-0.5">{currentPage}</span>
               <span className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.3em]">/ {totalPages}</span>
            </div>

            <button
               onClick={() => handlePageChange('next')}
               disabled={currentPage === totalPages}
               className="group flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/10 hover:border-indigo-500/50 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <span className="text-[10px] font-black uppercase tracking-widest pl-2">Next</span>
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}