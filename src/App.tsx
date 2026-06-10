/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import StudentExam from "./components/StudentExam";
import AdminPanel from "./components/AdminPanel";
import Notification, { ToastMessage } from "./components/Notification";
import { motion } from "motion/react";
import { GraduationCap, ShieldAlert, BookOpen, ArrowLeft } from "lucide-react";

export default function App() {
  const [role, setRole] = useState<"selection" | "student" | "admin">("selection");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Globally synchronized popup notifications helper
  const addToast = (type: "success" | "error", text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, text }]);
    
    // Auto remove toast in 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4550);
  };

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* Animated fluid mesh background */}
      <div className="mesh-bg"></div>

      {/* 1. Global Toast Notifications Container for CBT state successes and errors */}
      <Notification toasts={toasts} onClose={closeToast} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col z-10 relative">
        {/* Selection Screen Layout */}
        {role === "selection" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl w-full text-center space-y-8"
            >
              <div>
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30"
                >
                  <BookOpen className="w-8 h-8" />
                </motion.div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">Ujian Online Portal</h1>
                <p className="text-xs font-semibold text-indigo-400 font-mono mt-2 tracking-widest uppercase">
                  SISTEM UJIAN ONLINE COMPUTER BASED TEST
                </p>
              </div>

              {/* Selection Grids */}
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                {/* Siswa Card */}
                <button
                  id="select-siswa-portal"
                  onClick={() => setRole("student")}
                  className="glass-card hover:bg-white/[0.08] hover:border-indigo-500/40 p-8 rounded-3xl transition-all duration-300 text-left flex flex-col justify-between h-56 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 border border-indigo-500/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Portal Siswa</h3>
                    <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                      Masuk untuk mengerjakan mata pelajaran ujian CBT terjadwal. Dilengkapi dengan proteksi proctoring anti-curang.
                    </p>
                  </div>
                </button>

                {/* Admin Card */}
                <button
                  id="select-admin-portal"
                  onClick={() => setRole("admin")}
                  className="glass-card hover:bg-white/[0.08] hover:border-purple-500/40 p-8 rounded-3xl transition-all duration-300 text-left flex flex-col justify-between h-56 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300 border border-purple-500/20">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Proktor Admin</h3>
                    <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                      Kelola bank soal, atur jadwal ujian, ekspor laporan hasil nilai, dan monitoring aktivitas kecurangan siswa real-time.
                    </p>
                  </div>
                </button>
              </div>

              <div className="pt-4 text-[10px] text-indigo-400 font-mono tracking-wider uppercase">
                &copy; Gian Aditya
              </div>
            </motion.div>
          </div>
        )}

        {/* Portals Active View Screens */}
        {role !== "selection" && (
          <div className="flex-1 flex flex-col relative h-full">
            {/* Float Return Portal button which is useful to jump between roles easily in dev */}
            <button
              onClick={() => setRole("selection")}
              className="absolute left-6 top-6 z-40 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-semibold px-4 py-2 text-xs rounded-xl shadow-md flex items-center gap-2 backdrop-blur-md transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Ganti Portal
            </button>

            {/* Active view component renders */}
            {role === "student" && <StudentExam addToast={addToast} />}
            {role === "admin" && <AdminPanel addToast={addToast} />}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-5 text-center text-[10px] text-slate-500 font-mono tracking-widest uppercase z-10 border-t border-white/5 bg-[#020617]/45 backdrop-blur-sm shrink-0">
        &copy; Gian Aditya
      </footer>
    </div>
  );
}

