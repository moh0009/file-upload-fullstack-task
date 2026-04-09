import React from "react";
import { UserSearch, ArrowUpDown, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import Dropdown from "./dropdown";
import { cn } from "../lib/utils";

const students = [
  { id: 1, name: "Adrian Alistair", subject: "System Architecture", grade: "A+", initials: "AA", color: "bg-indigo-100 text-indigo-700" }
];

export default function StudentsTable() {
  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-2">Student Data Registry</h3>
          <p className="text-slate-500 text-sm">Managing 500 active scholars across 12 disciplines.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:min-w-[280px]">
            <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="Search by Student Name"
              type="text"
            />
          </div>
          <Dropdown />
        </div>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2">
                    Name <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2">
                    Subject <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2">
                    Grade <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 sm:px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs shrink-0", student.color)}>
                        {student.initials}
                      </div>
                      <span className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-8 py-4 text-slate-500 text-xs sm:text-sm">{student.subject}</td>
                  <td className="px-4 sm:px-8 py-4">
                    <span className={cn(
                      "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg",
                      student.grade.startsWith("A") ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {student.grade}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 text-right">
                    <button className="p-2 hover:bg-slate-200 rounded-full text-slate-400 group-hover:text-indigo-600 transition-all">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <p className="text-[10px] sm:text-xs font-medium text-slate-500">Showing 1 to 5 of 500 scholars</p>
          <div className="flex items-center gap-1 sm:gap-2">
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-30" disabled>
              <ChevronLeft size={14} />
            </button>
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-[10px] sm:text-xs font-bold">1</button>
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-[10px] sm:text-xs font-bold">2</button>
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-[10px] sm:text-xs font-bold">3</button>
            <span className="text-[10px] sm:text-xs text-slate-500 px-1">...</span>
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-[10px] sm:text-xs font-bold">100</button>
            <button className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
