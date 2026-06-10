/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Student, StudentStatus, Subject, Question, Exam, ExamStatus } from "../types";
import { downloadTemplate, parseQuestionsTemplate, parseWordQuestionsTemplate } from "../utils/template";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  BookOpen, 
  HelpCircle, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  ArrowRightLeft, 
  ShieldAlert, 
  Award, 
  LogOut, 
  Menu, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  FileCheck 
} from "lucide-react";

interface AdminPanelProps {
  addToast: (type: "success" | "error", text: string) => void;
}

type AdminTab = "siswa" | "jadwal" | "soal" | "hasil";

export default function AdminPanel({ addToast }: AdminPanelProps) {
  // Administrative pass authentication
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // UI state
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("siswa");

  // Collection states
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [examsList, setExamsList] = useState<Exam[]>([]);

  // Selected subject for Questions management
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [subjectQuestions, setSubjectQuestions] = useState<Question[]>([]);

  // Create Student form states
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");

  // Create Subject form states
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDate, setNewSubjectDate] = useState("");
  const [newSubjectStartTime, setNewSubjectStartTime] = useState("");
  const [newSubjectDuration, setNewSubjectDuration] = useState("");

  // Raw file content state for drag & drop templates
  const [dragActive, setDragActive] = useState(false);

  // Standalone Question Form state
  const [manualQText, setManualQText] = useState("");
  const [manualQOptA, setManualQOptA] = useState("");
  const [manualQOptB, setManualQOptB] = useState("");
  const [manualQOptC, setManualQOptC] = useState("");
  const [manualQOptD, setManualQOptD] = useState("");
  const [manualQCorrect, setManualQCorrect] = useState<number>(0);

  // Track password securely: default admin password is set to "admin_cbt"
  const DEFAULT_ADMIN_PW = "admin_cbt";

  // 1. Real-time lists synchronization
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    // Sync Students list in real-time
    const unsubscribeStudents = onSnapshot(collection(db, "students"), 
      (snapshot) => {
        const loaded: Student[] = [];
        snapshot.forEach((docRef) => {
          loaded.push({ id: docRef.id, ...docRef.data() } as Student);
        });
        setStudentsList(loaded);
      },
      (err) => {
        addToast("error", "Gagal melakukan sinkronisasi daftar siswa real-time.");
      }
    );

    // Sync Subjects list in real-time
    const unsubscribeSubjects = onSnapshot(collection(db, "subjects"), 
      (snapshot) => {
        const loaded: Subject[] = [];
        snapshot.forEach((docRef) => {
          loaded.push({ id: docRef.id, ...docRef.data() } as Subject);
        });
        setSubjectsList(loaded);
        if (loaded.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(loaded[0].id);
        }
      },
      (err) => {
        addToast("error", "Gagal sinkron jadwal ujian.");
      }
    );

    // Sync Exams list in real-time
    const unsubscribeExams = onSnapshot(collection(db, "exams"), 
      (snapshot) => {
        const loaded: Exam[] = [];
        snapshot.forEach((docRef) => {
          loaded.push({ id: docRef.id, ...docRef.data() } as Exam);
        });
        setExamsList(loaded);
      },
      (err) => {
        addToast("error", "Gagal memuat rekam hasil ujian.");
      }
    );

    return () => {
      unsubscribeStudents();
      unsubscribeSubjects();
      unsubscribeExams();
    };
  }, [isAdminLoggedIn]);

  // Sync Questions for Selected Subject
  useEffect(() => {
    if (!selectedSubjectId || !isAdminLoggedIn) return;

    const unsubscribeQuestions = onSnapshot(
      collection(db, "subjects", selectedSubjectId, "questions"),
      (snapshot) => {
        const loaded: Question[] = [];
        snapshot.forEach((docRef) => {
          loaded.push({ id: docRef.id, ...docRef.data() } as Question);
        });
        setSubjectQuestions(loaded);
      }
    );

    return () => unsubscribeQuestions();
  }, [selectedSubjectId, isAdminLoggedIn]);

  // Handle Admin Passphrase Login
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === DEFAULT_ADMIN_PW) {
      setIsAdminLoggedIn(true);
      addToast("success", "Login Admin Berhasil! Semua proktor aktif.");
    } else {
      addToast("error", "Sandi Admin Salah!");
    }
  };

  // Add individual student account
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newStudentId.trim().toLowerCase();
    const name = newStudentName.trim();
    const password = newStudentPassword.trim();

    if (!id || !name || !password) {
      addToast("error", "Seluruh data siswa harus diisi!");
      return;
    }

    try {
      const studentDocRef = doc(db, "students", id);
      const studentDoc: Student = {
        id,
        name,
        password,
        status: StudentStatus.AKTIF,
        currentActivity: "Belum Login",
        cheatingLogs: [],
        createdAt: new Date().toISOString()
      };

      await setDoc(studentDocRef, studentDoc);
      
      // Reset state form
      setNewStudentId("");
      setNewStudentName("");
      setNewStudentPassword("");
      
      addToast("success", `Siswa ${name} berhasil ditambahkan!`);
    } catch (err) {
      addToast("error", "Gagal menyimpan akun siswa.");
    }
  };

  // Kick Student out
  const handleKickStudent = async (studentId: string) => {
    try {
      const studentDocRef = doc(db, "students", studentId);
      
      // Update student profile status
      await updateDoc(studentDocRef, {
        status: StudentStatus.TIDAK_AKTIF,
        currentActivity: "Dikeluarkan oleh Admin"
      });
      
      addToast("success", `Siswa ${studentId} berhasil dinonaktifkan/dikeluarkan!`);
    } catch (err) {
      addToast("error", "Gagal memproses pengeluaran siswa.");
    }
  };

  // Restore Student back to Exam
  const handleRestoreStudent = async (studentId: string) => {
    try {
      const studentDocRef = doc(db, "students", studentId);
      
      await updateDoc(studentDocRef, {
        status: StudentStatus.AKTIF,
        currentActivity: "Belum Login"
      });

      addToast("success", `Akses masuk siswa ${studentId} berhasil dipulihkan!`);
    } catch (err) {
      addToast("error", "Gagal memulihkan akses siswa.");
    }
  };

  // Delete Student altogether
  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus siswa ini secara permanen dari sistem?")) return;
    try {
      await deleteDoc(doc(db, "students", studentId));
      addToast("success", "Siswa didepan database berhasil dihapus.");
    } catch (err) {
      addToast("error", "Gagal menghapus siswa.");
    }
  };

  // Add exam subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newSubjectId.trim().toUpperCase();
    const name = newSubjectName.trim();
    const duration = parseInt(newSubjectDuration, 10);

    if (!id || !name || !newSubjectDate || !newSubjectStartTime || isNaN(duration)) {
      addToast("error", "Seluruh isian mata ujian harus lengkap!");
      return;
    }

    try {
      const subjectDocRef = doc(db, "subjects", id);
      const subjectDoc: Subject = {
        id,
        name,
        examDate: newSubjectDate,
        startTime: newSubjectStartTime,
        duration,
        createdAt: new Date().toISOString()
      };

      await setDoc(subjectDocRef, subjectDoc);

      setNewSubjectId("");
      setNewSubjectName("");
      setNewSubjectDate("");
      setNewSubjectStartTime("");
      setNewSubjectDuration("");

      addToast("success", `Ujian mata pelajaran ${name} berhasil didaftarkan!`);
    } catch (err) {
      addToast("error", "Gagal menjadwalkan mata pelajaran baru.");
    }
  };

  // Delete subject
  const handleDeleteSubject = async (subjectId: string) => {
    if (!window.confirm("Menghapus mata pelajaran juga menghapus seluruh bank soal di dalamnya. Lanjutkan?")) return;
    try {
      // Note: Questions are subcollection, should be cleared as well or we just delete parent doc
      await deleteDoc(doc(db, "subjects", subjectId));
      addToast("success", "Mata pelajaran beserta isinya berhasil dihapus.");
    } catch (err) {
      addToast("error", "Gagal menghapus mata pelajaran.");
    }
  };

  // Save manual single question to active subject
  const handleSaveManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      addToast("error", "Pilih mata pelajaran terlebih dahulu!");
      return;
    }

    const text = manualQText.trim();
    const options = [manualQOptA.trim(), manualQOptB.trim(), manualQOptC.trim(), manualQOptD.trim()].filter(Boolean);

    if (!text || options.length < 2) {
      addToast("error", "Soal harus memiliki teks dan minimal 2 opsi jawaban!");
      return;
    }

    try {
      const qid = Math.random().toString(36).substring(2, 9);
      const questionDocRef = doc(db, "subjects", selectedSubjectId, "questions", qid);
      
      const questionObj: Question = {
        id: qid,
        text,
        options,
        correctAnswer: manualQCorrect
      };

      await setDoc(questionDocRef, questionObj);

      // Reset
      setManualQText("");
      setManualQOptA("");
      setManualQOptB("");
      setManualQOptC("");
      setManualQOptD("");
      setManualQCorrect(0);

      addToast("success", "Soal berhasil disimpan secara mandiri!");
    } catch (err) {
      addToast("error", "Gagal menyimpan soal.");
    }
  };

  // Delete individual question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedSubjectId) return;
    try {
      await deleteDoc(doc(db, "subjects", selectedSubjectId, "questions", questionId));
      addToast("success", "Soal berhasil dibuang dari bank soal.");
    } catch (err) {
      addToast("error", "Gagal membuang soal.");
    }
  };

  // Handle uploading Questions templates (CSV / JSON)
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = async (file: File) => {
    if (!selectedSubjectId) {
      addToast("error", "Pilih Mata Pelajaran sebelum mengunggah!");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "json" && extension !== "docx") {
      addToast("error", "Hanya mendukung berkas template CSV, JSON, atau Word (.docx)!");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let parsedList;
        if (extension === "docx") {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          parsedList = await parseWordQuestionsTemplate(arrayBuffer);
        } else {
          const textContent = event.target?.result as string;
          parsedList = parseQuestionsTemplate(textContent, extension);
        }

        if (parsedList.length === 0) {
          addToast("error", "Berkas kosong atau format tidak tepat.");
          return;
        }

        // Upload all parsed questions to sub-collection
        let uploadCount = 0;
        for (const item of parsedList) {
          const qid = item.id || Math.random().toString(36).substring(2, 9);
          const docRef = doc(db, "subjects", selectedSubjectId, "questions", qid);
          
          await setDoc(docRef, {
            id: qid,
            text: item.text,
            options: item.options,
            correctAnswer: item.correctAnswer
          });
          uploadCount++;
        }

        addToast("success", `Berhasil memasukkan ${uploadCount} soal kunci jawaban baru ke ${selectedSubjectId}!`);
      } catch (err: any) {
        addToast("error", err.message || "Gagal mengimpor berkas template.");
      }
    };

    if (extension === "docx") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Export results: "admin dapat export hasil ujiannya" (Converts Exams collection to nice downloadable CSV template sheet)
  const handleExportResults = () => {
    if (examsList.length === 0) {
      addToast("error", "Belum ada riwayat hasil ujian untuk diekspor!");
      return;
    }

    // Build CSV Row headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Username Siswa,Nama Lengkap,ID Mapel,Nama Mapel,Jawaban Benar,Total Soal,Skor,Waktu Mulai,Waktu Beres,Status\n";

    examsList.forEach((exam) => {
      const studentObj = studentsList.find((s) => s.id === exam.studentId);
      const subjectObj = subjectsList.find((sub) => sub.id === exam.subjectId);

      const name = studentObj?.name || "-";
      const subjectName = subjectObj?.name || "-";
      
      const row = [
        exam.studentId,
        `"${name}"`,
        exam.subjectId,
        `"${subjectName}"`,
        exam.correctCount,
        exam.totalCount,
        exam.score,
        exam.startedAt,
        exam.submittedAt || "-",
        exam.status
      ].join(",");

      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hasil_Ujian_CBT_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("success", "Rekap hasil ujian diunduh dalam format CSV Sheet.");
  };

  return (
    <div className="flex h-screen bg-transparent w-full overflow-hidden relative z-10">
      {/* 1. Admin login screen */}
      {!isAdminLoggedIn && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card p-8 rounded-3xl space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white">Dasbor Proktor CBT</h2>
              <p className="text-indigo-400 text-[10px] font-mono mt-1 uppercase tracking-wider">MASUKKAN SANDI MASTER ADMIN UNTUK MONITORING</p>
            </div>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sandi Admin</label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Gunakan: admin_cbt" 
                  className="w-full text-sm py-3 px-4 rounded-xl glass-input transition-all"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm cursor-pointer mt-2"
              >
                Otorisasi Akses
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Admin Hub (Authentic state) */}
      {isAdminLoggedIn && (
        <>
          {/* Hidable Sidebar */}
          <AnimatePresence mode="popLayout">
            {!isSidebarHidden && (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="glass-panel text-slate-200 flex flex-col justify-between shrink-0 h-full border-r border-white/5 relative z-20"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold">
                      C
                    </div>
                    <div>
                      <h1 className="font-extrabold text-white text-base leading-tight tracking-tight">CBT Admin</h1>
                      <span className="text-[10px] font-mono text-indigo-400">PROKTOR ACTIVE</span>
                    </div>
                  </div>

                  <nav className="space-y-1.5">
                    <button
                      onClick={() => setActiveTab("siswa")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition border ${
                        activeTab === "siswa" ? "bg-white/10 text-white border-white/10 font-bold" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Monitoring & Siswa
                    </button>

                    <button
                      onClick={() => setActiveTab("jadwal")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition border ${
                        activeTab === "jadwal" ? "bg-white/10 text-white border-white/10 font-bold" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      Atur Jadwal & Mapel
                    </button>

                    <button
                      onClick={() => setActiveTab("soal")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition border ${
                        activeTab === "soal" ? "bg-white/10 text-white border-white/10 font-bold" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Bank Soal & Kunci
                    </button>

                    <button
                      onClick={() => setActiveTab("hasil")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition border ${
                        activeTab === "hasil" ? "bg-white/10 text-white border-white/10 font-bold" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      Hasil & Rekap Nilai
                    </button>
                  </nav>
                </div>

                <div className="p-6 border-t border-white/5 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[11px] font-mono tracking-wider font-semibold text-slate-400 uppercase">FIRESTORE SYNCED</span>
                  </div>
                  <button 
                    onClick={() => setIsAdminLoggedIn(false)}
                    className="w-full bg-white/5 text-slate-300 hover:bg-rose-500/10 hover:text-rose-200 border border-white/5 hover:border-rose-500/20 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout Admin
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Content Body */}
          <div className="flex-1 flex flex-col overflow-hidden h-full relative z-10">
            {/* Upper Action Bar */}
            <header className="h-16 border-b border-white/5 bg-slate-950/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 shadow-lg relative z-20">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                  className="p-2 hover:bg-white/10 rounded-lg transition text-slate-300 cursor-pointer"
                  title="Toggle Sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-black text-white tracking-tight capitalize flex items-center gap-2">
                  {activeTab === "siswa" && "Manajemen & Aktivitas Siswa"}
                  {activeTab === "jadwal" && "Pengaturan Jadwal Mata Pelajaran"}
                  {activeTab === "soal" && "Ubah Bank Soal & Unggah Template"}
                  {activeTab === "hasil" && "Rekapitulasi Hasil Nilai CBT"}
                </h2>
              </div>
            </header>

            {/* Inner Content Area */}
            <main className="flex-1 p-6 overflow-y-auto bg-transparent relative z-10">
              <AnimatePresence mode="wait">
                {/* TAB 1: LIHAT SISWA & MONITORING */}
                {activeTab === "siswa" && (
                  <motion.div 
                    key="tab-siswa" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Add new student container */}
                    <div className="glass-card p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-indigo-400" />
                        Tambah Akun Siswa Baru
                      </h3>
                      
                      <form onSubmit={handleCreateStudent} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Username / NIS</label>
                          <input 
                            type="text" 
                            value={newStudentId}
                            onChange={(e) => setNewStudentId(e.target.value)}
                            placeholder="Contoh: siswa01" 
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Nama Siswa</label>
                          <input 
                            type="text" 
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="Nama Lengkap" 
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Kunci Sandi</label>
                          <input 
                            type="text" 
                            value={newStudentPassword}
                            onChange={(e) => setNewStudentPassword(e.target.value)}
                            placeholder="Kata Sandi Akun" 
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Simpan Siswa
                        </button>
                      </form>
                    </div>

                    {/* Students real-time surveillance console */}
                    <div className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-400" />
                          Aktivitas Sinkron Siswa
                        </h3>
                        <span className="text-[10px] font-mono tracking-wider bg-white/10 text-slate-300 border border-white/10 px-2.5 py-1 rounded-full">{studentsList.length} Akun Terdaftar</span>
                      </div>

                      {studentsList.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 font-medium text-sm">
                          Belum ada data siswa. Silakan buat akun siswa di atas.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/5 text-[11px] font-mono tracking-wider text-slate-300 uppercase">
                                <th className="py-3 px-6">Identitas Siswa</th>
                                <th className="py-3 px-6">Sandi Akun</th>
                                <th className="py-3 px-6">Aktivitas Terakhir</th>
                                <th className="py-3 px-6 text-center">Status</th>
                                <th className="py-3 px-6 text-center">Pelanggaran</th>
                                <th className="py-3 px-6 text-center">Tindakan Khusus</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-xs">
                              {studentsList.map((stu) => {
                                const totalCheats = stu.cheatingLogs?.length || 0;
                                return (
                                  <tr key={stu.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6">
                                      <div className="font-bold text-white">{stu.name}</div>
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">NIS: {stu.id}</div>
                                    </td>
                                    <td className="py-4 px-6 font-mono text-indigo-300">
                                      {stu.password}
                                    </td>
                                    <td className="py-2 px-6">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                          stu.currentActivity?.includes("Mengerjakan") ? "bg-amber-500 animate-pulse" :
                                          stu.currentActivity?.includes("Selesai") ? "bg-emerald-500" :
                                          stu.currentActivity?.includes("Curang") ? "bg-rose-500" : "bg-slate-350"
                                        }`} />
                                        <span className="text-slate-100 font-bold">{stu.currentActivity || "Belum Login"}</span>
                                      </div>
                                      {stu.lastActiveAt && (
                                        <div className="text-[9px] font-mono text-slate-400 mt-1">Aktif: {new Date(stu.lastActiveAt).toLocaleTimeString()}</div>
                                      )}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                        stu.status === StudentStatus.AKTIF 
                                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                          : "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                                      }`}>
                                        {stu.status}
                                      </span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      {totalCheats > 0 ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/25 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                            ⚠️ {totalCheats}x Cheat
                                          </span>
                                          {/* Mini log display */}
                                          <div className="text-[9px] font-medium text-rose-400 max-w-xs truncate" title={stu.cheatingLogs[totalCheats - 1].description}>
                                            Last: {stu.cheatingLogs[totalCheats - 1].description}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 font-mono text-[10px]">- Bersih -</span>
                                      )}
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="flex items-center justify-center gap-2">
                                        {stu.status === StudentStatus.AKTIF ? (
                                          <button
                                            onClick={() => handleKickStudent(stu.id)}
                                            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/25 px-3 py-1.5 rounded-lg text-xs leading-none transition cursor-pointer"
                                            title="Keluarkan / Blokir login siswa dari CBT"
                                          >
                                            Keluarkan Siswa
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleRestoreStudent(stu.id)}
                                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/25 px-3 py-1.5 rounded-lg text-xs leading-none transition cursor-pointer"
                                            title="Masukkan kembali siswa agar dapat ujian kembali"
                                          >
                                            Masukkan Kembali
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteStudent(stu.id)}
                                          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: ATUR JADWAL & MAPEL */}
                {activeTab === "jadwal" && (
                  <motion.div 
                    key="tab-jadwal" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="grid md:grid-cols-3 gap-6"
                  >
                    {/* Schedule Form */}
                    <div className="glass-card p-6 rounded-2xl h-fit">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        Jadwalkan Mapel Baru
                      </h3>

                      <form onSubmit={handleCreateSubject} className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Kode Mapel (Unique ID)</label>
                          <input 
                            type="text" 
                            value={newSubjectId}
                            onChange={(e) => setNewSubjectId(e.target.value)}
                            placeholder="Contoh: MAT10" 
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Nama Mata Ujian</label>
                          <input 
                            type="text" 
                            value={newSubjectName}
                            onChange={(e) => setNewSubjectName(e.target.value)}
                            placeholder="Mata Pelajaran Matematika" 
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Tanggal Mulai</label>
                          <input 
                            type="date" 
                            value={newSubjectDate}
                            onChange={(e) => setNewSubjectDate(e.target.value)}
                            className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Waktu Mulai</label>
                            <input 
                              type="time" 
                              value={newSubjectStartTime}
                              onChange={(e) => setNewSubjectStartTime(e.target.value)}
                              placeholder="08:00"
                              className="w-full text-xs py-2.5 px-3 rounded-lg glass-input font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Durasi (Menit)</label>
                            <input 
                              type="number" 
                              value={newSubjectDuration}
                              onChange={(e) => setNewSubjectDuration(e.target.value)}
                              placeholder="Contoh: 90" 
                              className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                            />
                          </div>
                        </div>

                        <button 
                          type="submit" 
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer"
                        >
                          Simpan Jadwal Ujian
                        </button>
                      </form>
                    </div>

                    {/* Schedule Lists */}
                    <div className="md:col-span-2 glass-card rounded-2xl overflow-hidden h-fit">
                      <div className="p-6 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Mata Pelajaran Aktif</h3>
                      </div>

                      {subjectsList.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 font-medium text-sm">
                          Belum ada mata pelajaran dijadwalkan.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/5 text-[11px] font-mono text-slate-300 uppercase">
                                <th className="py-3 px-6">Kode</th>
                                <th className="py-3 px-6">Nama Ujian</th>
                                <th className="py-3 px-6 text-center">Tanggal & Jam</th>
                                <th className="py-3 px-6 text-center">Sesi</th>
                                <th className="py-3 px-6 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                              {subjectsList.map((sub) => (
                                <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-4 px-6 font-mono font-bold text-indigo-300">
                                    {sub.id}
                                  </td>
                                  <td className="py-4 px-6 font-bold text-white">
                                    {sub.name}
                                  </td>
                                  <td className="py-4 px-6 text-center text-slate-200 font-semibold">
                                    <div>{sub.examDate}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sub.startTime} WIB</div>
                                  </td>
                                  <td className="py-4 px-6 text-center text-slate-200 font-mono">
                                    {sub.duration} Menit
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <button 
                                      onClick={() => handleDeleteSubject(sub.id)}
                                      className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: BANK SOAL */}
                {activeTab === "soal" && (
                  <motion.div 
                    key="tab-soal" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Subject chooser heading */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-5 rounded-2xl">
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex-1 md:flex-none">
                          <p className="text-[10px] text-indigo-300 font-mono tracking-wider">PILIH MATA PELAJARAN</p>
                          <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            className="bg-transparent font-bold text-white border-none outline-none focus:ring-0 text-sm cursor-pointer"
                          >
                            {subjectsList.length === 0 && <option value="" className="bg-slate-950 text-white">Belum ada Mapel</option>}
                            {subjectsList.map((sub) => (
                              <option key={sub.id} value={sub.id} className="bg-slate-950 text-white">{sub.name} ({sub.id})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Download original templates */}
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => downloadTemplate("docx")}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-600/25 active:scale-95"
                          title="Unduh format Microsoft Word yang telah disesuaikan"
                        >
                          <Download className="w-4 h-4" />
                          Unduh Template Word (.docx)
                        </button>
                        <button 
                          onClick={() => downloadTemplate("csv")}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-slate-400" />
                          CSV
                        </button>
                        <button 
                          onClick={() => downloadTemplate("json")}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-slate-400" />
                          JSON
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left Block: Question Import (Drag and Drop is highly structured) & manual input */}
                      <div className="space-y-6">
                        {/* Drag and drop block */}
                        <div 
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center ${
                            dragActive ? "border-indigo-400 bg-indigo-600/10" : "border-white/10 hover:border-white/20 bg-white/5"
                          }`}
                        >
                          <Upload className="w-8 h-8 text-indigo-400 mb-3" />
                          <h4 className="font-extrabold text-white text-sm">Unggah Template Soal + Kunci Jawaban</h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-5">
                            Seret dan taruh file Word (.docx), CSV, atau JSON Anda disini, atau pilih berkas lokal untuk otomatis memuat seluruh soal ujian dan kunci jawaban teracak.
                          </p>

                          <label className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                            Pilih Berkas
                            <input 
                              type="file" 
                              accept=".csv,.json,.docx"
                              onChange={handleFileChange}
                              className="hidden" 
                            />
                          </label>
                        </div>

                        {/* Manual entry form */}
                        <div className="glass-card p-6 rounded-2xl">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Input Soal Manual</h3>
                          
                          <form onSubmit={handleSaveManualQuestion} className="space-y-4">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Butir Teks Pertanyaan</label>
                              <textarea 
                                rows={3}
                                value={manualQText}
                                onChange={(e) => setManualQText(e.target.value)}
                                placeholder="Tuliskan pertanyaan ujian..." 
                                className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Opsi A</label>
                                <input 
                                  type="text" 
                                  value={manualQOptA}
                                  onChange={(e) => setManualQOptA(e.target.value)}
                                  placeholder="Pilihan A" 
                                  className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Opsi B</label>
                                <input 
                                  type="text" 
                                  value={manualQOptB}
                                  onChange={(e) => setManualQOptB(e.target.value)}
                                  placeholder="Pilihan B" 
                                  className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Opsi C</label>
                                <input 
                                  type="text" 
                                  value={manualQOptC}
                                  onChange={(e) => setManualQOptC(e.target.value)}
                                  placeholder="Pilihan C" 
                                  className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Opsi D</label>
                                <input 
                                  type="text" 
                                  value={manualQOptD}
                                  onChange={(e) => setManualQOptD(e.target.value)}
                                  placeholder="Pilihan D" 
                                  className="w-full text-xs py-2.5 px-3 rounded-lg glass-input"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-350 uppercase mb-1">Kunci Jawaban Benar</label>
                              <select
                                value={manualQCorrect}
                                onChange={(e) => setManualQCorrect(parseInt(e.target.value, 10))}
                                className="w-full text-xs py-2.5 px-3 rounded-lg glass-input select-arrow"
                              >
                                <option value={0} className="bg-slate-900 text-white">Opsi Pilihan A Benar</option>
                                <option value={1} className="bg-slate-900 text-white">Opsi Pilihan B Benar</option>
                                <option value={2} className="bg-slate-900 text-white">Opsi Pilihan C Benar</option>
                                <option value={3} className="bg-slate-900 text-white">Opsi Pilihan D Benar</option>
                              </select>
                            </div>

                            <button 
                              type="submit"
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl transition duration-150 shadow-lg shadow-indigo-600/20 active:scale-98 cursor-pointer"
                            >
                              Simpan Soal Baru
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Right Block: Live Question lists */}
                      <div className="glass-card rounded-2xl p-6 flex flex-col h-[520px]">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex justify-between items-center pr-1">
                          <span>Bank Soal Terdaftar</span>
                          <span className="text-[10px] bg-white/10 text-slate-300 border border-white/10 font-mono px-2.5 py-1 rounded-full">{subjectQuestions.length} Butir</span>
                        </h3>

                        {subjectQuestions.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm font-medium">
                            <HelpCircle className="w-8 h-8 text-indigo-400 mb-2" />
                            Belum ada soal untuk mata pelajaran ini.
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {subjectQuestions.map((q, idx) => (
                              <div key={q.id} className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3 relative">
                                <button 
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition cursor-pointer"
                                  title="Hapus Soal ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>

                                <span className="text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded">SOAL #{idx + 1}</span>
                                <p className="text-xs text-white font-semibold leading-relaxed mt-2 max-w-[90%] whitespace-pre-wrap">{q.text}</p>
                                
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
                                  {q.options.map((opt, oIdx) => (
                                    <div 
                                      key={oIdx} 
                                      className={`p-2 rounded-lg border ${
                                        oIdx === q.correctAnswer 
                                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300 font-extrabold" 
                                          : "bg-white/5 border-white/5 text-slate-300"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + oIdx)}. {opt}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: HASIL UJIAN */}
                {activeTab === "hasil" && (
                  <motion.div 
                    key="tab-hasil" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <h3 className="font-extrabold text-white text-base">Rekapitulasi Hasil Nilai</h3>
                        <p className="text-slate-400 text-xs mt-1 font-semibold">Siswa telah submit dan hasil ter-sync database otomatis</p>
                      </div>

                      <button 
                        onClick={handleExportResults}
                        className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer transition duration-150 active:scale-[0.98]"
                      >
                        <FileCheck className="w-4 h-4" />
                        Ekspor Seluruh Hasil (CSV Sheet)
                      </button>
                    </div>

                    <div className="glass-card rounded-2xl overflow-hidden">
                      {examsList.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 font-medium text-sm">
                          Belum ada data pengerjaan ujian yang tersimpan.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/5 text-[11px] font-mono text-slate-300 uppercase">
                                <th className="py-3 px-6">Siswa</th>
                                <th className="py-3 px-6">Mata Pelajaran</th>
                                <th className="py-3 px-6 text-center">Jawaban Benar</th>
                                <th className="py-3 px-6 text-center">Skor Akhir</th>
                                <th className="py-3 px-6 text-center">Tanggal Submit</th>
                                <th className="py-3 px-6 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                              {examsList.map((exam) => {
                                const stud = studentsList.find((s) => s.id === exam.studentId);
                                const subj = subjectsList.find((su) => su.id === exam.subjectId);
                                
                                return (
                                  <tr key={exam.id} className="hover:bg-white/5 transition-colors font-medium text-xs">
                                    <td className="py-4 px-6">
                                      <div className="font-bold text-white">{stud?.name || exam.studentId}</div>
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">NIS: {exam.studentId}</div>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="font-bold text-white">{subj?.name || exam.subjectId}</div>
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {exam.subjectId}</div>
                                    </td>
                                    <td className="py-4 px-6 text-center text-slate-200 font-mono">
                                      {exam.correctCount} / {exam.totalCount} Soal
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <span className={`text-md font-black tracking-tight ${
                                        exam.score >= 70 ? "text-emerald-400" : "text-amber-400"
                                      }`}>
                                        {exam.score}
                                      </span>
                                    </td>
                                    <td className="py-4 px-6 text-center text-slate-400 font-mono">
                                      {exam.submittedAt ? new Date(exam.submittedAt).toLocaleString() : "-"}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <span className={`px-2 py-1 rounded text-[9px] font-mono tracking-wider uppercase border ${
                                        exam.status === ExamStatus.SELESAI 
                                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                                          : "bg-amber-500/10 text-amber-300 border-amber-500/25"
                                      }`}>
                                        {exam.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
