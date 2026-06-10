/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  getDoc, 
  setDoc, 
  updateDoc, 
  doc, 
  collection, 
  getDocs, 
  onSnapshot
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Student, StudentStatus, Subject, Question, Exam, ExamStatus, CheatingLog } from "../types";
import { motion } from "motion/react";
import { BookOpen, KeyRound, AlertTriangle, CheckSquare, Clock, ArrowRight, ArrowLeft } from "lucide-react";

interface StudentExamProps {
  addToast: (type: "success" | "error", text: string) => void;
}

export default function StudentExam({ addToast }: StudentExamProps) {
  // Authentication states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  // Subject selection & exam states
  const [subjects, setSubjects] = useState<Subject[]>();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<Exam | null>(null);
  const [studentExams, setStudentExams] = useState<Exam[]>([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0); // in seconds
  const [cheatDetected, setCheatDetected] = useState(false);

  // Real-time option randomization seed for the questions
  const [randomizedOptionMapping, setRandomizedOptionMapping] = useState<Record<string, number[]>>({});

  // Active student snapshot listener reference
  const studentUnsubscribe = useRef<(() => void) | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Load available subjects on mount
  useEffect(() => {
    async function loadSubjects() {
      try {
        const querySnapshot = await getDocs(collection(db, "subjects"));
        const loaded: Subject[] = [];
        querySnapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as Subject);
        });
        setSubjects(loaded);
      } catch (err) {
        console.error("Gagal memuat mata pelajaran:", err);
        handleFirestoreError(err, OperationType.LIST, "subjects");
      }
    }
    loadSubjects();
  }, [isLoggedIn]);

  // Clean snapshot on log out
  useEffect(() => {
    return () => {
      if (studentUnsubscribe.current) studentUnsubscribe.current();
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // Real-time listener for current student's exams to disable completed exam subjects
  useEffect(() => {
    if (!isLoggedIn || !currentStudent) {
      setStudentExams([]);
      return;
    }

    const examsColRef = collection(db, "exams");
    const unsubscribeExams = onSnapshot(examsColRef, (snapshot) => {
      const examsList: Exam[] = [];
      snapshot.forEach((docSnap) => {
        const examData = docSnap.data() as Exam;
        if (examData.studentId === currentStudent.id) {
          examsList.push(examData);
        }
      });
      setStudentExams(examsList);
    }, (err) => {
      console.error("Gagal memuat daftar hasil ujian siswa:", err);
    });

    return () => {
      unsubscribeExams();
    };
  }, [isLoggedIn, currentStudent]);

  // Sync Timer for active exams
  useEffect(() => {
    if (examState && examState.status === ExamStatus.MENGERJAKAN && remainingTime > 0) {
      timerInterval.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval.current!);
            autoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [examState, remainingTime]);

  // Real-time student profile listener (detects if Admin suspends/kicks/inserts student)
  const subscribeToStudent = (studentId: string) => {
    if (studentUnsubscribe.current) {
      studentUnsubscribe.current();
    }

    const docRef = doc(db, "students", studentId);
    studentUnsubscribe.current = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Student;
      setCurrentStudent(data);

      // If suspended either by exam proctoring or admin, force logout immediately
      if (data.status === StudentStatus.TIDAK_AKTIF) {
        handleForcedLogOut();
      }
    });
  };

  const handleForcedLogOut = () => {
    // If caught cheating
    setCheatDetected(true);
    setIsLoggedIn(false);
    setSelectedSubject(null);
    setExamState(null);
    if (studentUnsubscribe.current) {
      studentUnsubscribe.current();
      studentUnsubscribe.current = null;
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
  };

  // Student Custom Log In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast("error", "Username dan Password harus diisi!");
      return;
    }

    try {
      const studentDocRef = doc(db, "students", username.trim().toLowerCase());
      const studentSnap = await getDoc(studentDocRef);

      if (!studentSnap.exists()) {
        addToast("error", "Akun siswa tidak terdaftar!");
        return;
      }

      const account = studentSnap.data() as Student;

      if (account.password !== password) {
        addToast("error", "Password yang Anda masukkan salah!");
        return;
      }

      // Check if administrative block is active
      if (account.status === StudentStatus.TIDAK_AKTIF) {
        addToast("error", "Akun Anda tidak aktif! Silakan melapor ke Admin.");
        return;
      }

      // Successful login
      setCheatDetected(false);
      setIsLoggedIn(true);
      setCurrentStudent(account);
      subscribeToStudent(account.id);

      // Update activity logs in Firestore
      await updateDoc(studentDocRef, {
        currentActivity: "Memilih Mata Pelajaran",
        lastActiveAt: new Date().toISOString()
      });

      addToast("success", `Selamat datang, ${account.name}!`);
    } catch (err) {
      addToast("error", "Gagal mendaftar masuk: Batasan otorisasi");
    }
  };

  // Log Out manually
  const handleLogOut = async () => {
    if (currentStudent) {
      try {
        const studentDocRef = doc(db, "students", currentStudent.id);
        await updateDoc(studentDocRef, {
          currentActivity: "Belum Login",
          lastActiveAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
      }
    }
    setIsLoggedIn(false);
    setCurrentStudent(null);
    setSelectedSubject(null);
    setExamState(null);
    setQuestions([]);
    if (studentUnsubscribe.current) {
      studentUnsubscribe.current();
      studentUnsubscribe.current = null;
    }
  };

  // Start exam matching subject
  const startExam = async (subject: Subject) => {
    if (!currentStudent) return;

    // Check if exam of this subject has already been submitted/completed
    const isCompleted = studentExams.some(
      (ex) => ex.subjectId === subject.id && ex.status === ExamStatus.SELESAI
    );
    if (isCompleted) {
      addToast("error", "Anda sudah menjawab/menyelesaikan ujian untuk mata pelajaran ini!");
      return;
    }
    
    // Check timing constraint: "ujian terbuka jam [JAM] dan mata ujian yg belum jamnya gak bisa dipilih"
    const now = new Date();
    const [startHour, startMin] = subject.startTime.split(":").map(Number);
    const scheduledTime = new Date(subject.examDate);
    scheduledTime.setHours(startHour, startMin, 0, 0);

    // Formatted current time string to compare dates safely
    const currentFormattedDate = now.toISOString().split("T")[0];
    const isReadyDate = currentFormattedDate >= subject.examDate;

    if (!isReadyDate || now < scheduledTime) {
      addToast("error", `Mata pelajaran belum dibuka! Ujian terbuka tanggal ${subject.examDate} pukul ${subject.startTime}`);
      return;
    }

    try {
      setSelectedSubject(subject);

      // Fetch subject questions from Firestore
      const questionsSnap = await getDocs(collection(db, "subjects", subject.id, "questions"));
      const loadedQuestions: Question[] = [];
      questionsSnap.forEach((docRef) => {
        loadedQuestions.push({ id: docRef.id, ...docRef.data() } as Question);
      });

      if (loadedQuestions.length === 0) {
        addToast("error", "Belum ada soal untuk mata pelajaran ini.");
        setSelectedSubject(null);
        return;
      }

      // Check for already existing exam attempt
      const examDocId = `${currentStudent.id}_${subject.id}`;
      const examDocRef = doc(db, "exams", examDocId);
      const examSnap = await getDoc(examDocRef);

      let activeExam: Exam;

      if (examSnap.exists()) {
        const examData = examSnap.data() as Exam;
        if (examData.status === ExamStatus.SELESAI) {
          addToast("error", "Anda sudah menyelesaikan ujian ini!");
          setSelectedSubject(null);
          return;
        }
        activeExam = examData;
        addToast("success", "Melanjutkan ujian Anda.");
      } else {
        // Prepare randomization for Questions and Answers per user: "soalny dan jawaban teracak setiap user"
        // 1. Shuffling Questions order
        const shuffledQuestionIds = loadedQuestions
          .map((q) => q.id)
          .sort(() => Math.random() - 0.5);

        // Define a randomized mapping for each question's option choices
        const optMapping: Record<string, number[]> = {};
        loadedQuestions.forEach((q) => {
          // Generate 0-indexed options map array in random order, e.g., options with length 4: [2, 0, 3, 1]
          const mappings = Array.from({ length: q.options.length }, (_, k) => k);
          mappings.sort(() => Math.random() - 0.5);
          optMapping[q.id] = mappings;
        });
        setRandomizedOptionMapping(optMapping);

        activeExam = {
          id: examDocId,
          studentId: currentStudent.id,
          subjectId: subject.id,
          status: ExamStatus.MENGERJAKAN,
          questionOrder: shuffledQuestionIds,
          answers: {},
          startedAt: new Date().toISOString(),
          score: 0,
          correctCount: 0,
          totalCount: loadedQuestions.length
        };

        await setDoc(examDocRef, activeExam);
        addToast("success", "Kertas ujian dibuat, selamat mengerjakannya!");
      }

      // Set state questions synced with randomized question order
      const questionsSorted = activeExam.questionOrder
        .map((qid) => loadedQuestions.find((q) => q.id === qid))
        .filter(Boolean) as Question[];

      setQuestions(questionsSorted);
      setExamState(activeExam);
      setCurrentQuestionIndex(0);

      // Set countdown countdown timer
      const secondsPassed = Math.floor((new Date().getTime() - new Date(activeExam.startedAt).getTime()) / 1000);
      const durationSeconds = subject.duration * 60;
      setRemainingTime(Math.max(0, durationSeconds - secondsPassed));

      // Update student profile with currently taking exam
      await updateDoc(doc(db, "students", currentStudent.id), {
        currentActivity: `Mengerjakan ${subject.name} (Nomor 1)`
      });

    } catch (err) {
      console.error(err);
      addToast("error", "Gagal menginisiasi lembar ujian ke database!");
    }
  };

  // Anti-Cheat Invisible Proctoring Engine
  useEffect(() => {
    if (!examState || examState.status !== ExamStatus.MENGERJAKAN || !currentStudent || !selectedSubject) return;

    // Triggered on unfocuse / blur / visibility loss
    const reportCheating = async () => {
      try {
        const studentDocRef = doc(db, "students", currentStudent.id);
        const logEntry: CheatingLog = {
          timestamp: new Date().toISOString(),
          description: `Terdeteksi curang pindah tab / keluar fokus layar saat ujian ${selectedSubject.name}`
        };

        // Query the existing student doc to update logs array
        const snap = await getDoc(studentDocRef);
        if (snap.exists()) {
          const currentData = snap.data() as Student;
          const updatedLogs = [...(currentData.cheatingLogs || []), logEntry];

          // Ban student: "langsung kembali ke halaman login dan siswa gak dapat login dan ada info akun anda tdk aktif"
          await updateDoc(studentDocRef, {
            status: StudentStatus.TIDAK_AKTIF,
            currentActivity: `Curang saat ujian ${selectedSubject.name}`,
            cheatingLogs: updatedLogs,
            lastActiveAt: new Date().toISOString()
          });

          addToast("error", "Pelanggaran terdeteksi! Anda keluar fokus ujian.");
        }
      } catch (err) {
        console.error("Gagal mengirim laporan pelanggaran:", err);
      }
    };

    const handleBlur = () => {
      reportCheating();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportCheating();
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [examState, currentStudent, selectedSubject]);

  // Answer synchronizer in Firestore
  const saveAnswer = async (questionId: string, originalOptionIndex: number) => {
    if (!examState || !currentStudent) return;

    try {
      const examDocRef = doc(db, "exams", examState.id);
      const updatedAnswers = { ...examState.answers, [questionId]: originalOptionIndex };

      // Optimistic state sync
      const nextExamState = { ...examState, answers: updatedAnswers };
      setExamState(nextExamState);

      // Save to Firebase database for device security
      await updateDoc(examDocRef, {
        answers: updatedAnswers
      });

      // Update active activity
      await updateDoc(doc(db, "students", currentStudent.id), {
        currentActivity: `Mengerjakan ${selectedSubject?.name} (Nomor ${currentQuestionIndex + 1})`
      });

    } catch (err) {
      addToast("error", "Gagal menyimpan jawaban.");
    }
  };

  // Submit Exam manually with button press
  const handleManualSubmit = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menyelesaikan dan mengumpulkan ujian?")) return;
    await submitExam();
  };

  // Auto-submit when time is up
  const autoSubmitExam = async () => {
    addToast("error", "Waktu ujian telah habis! Mengumpulkan otomatis.");
    await submitExam();
  };

  const submitExam = async () => {
    if (!examState || !currentStudent || !selectedSubject) return;

    try {
      // Calculate scores
      let correctAnswersCount = 0;
      questions.forEach((q) => {
        const studentAnswer = examState.answers[q.id];
        if (studentAnswer !== undefined && studentAnswer === q.correctAnswer) {
          correctAnswersCount++;
        }
      });

      const totalQuestionsCount = questions.length;
      const computedScore = totalQuestionsCount > 0 
        ? Math.round((correctAnswersCount / totalQuestionsCount) * 100) 
        : 0;

      const examDocRef = doc(db, "exams", examState.id);
      const submittedExam: Exam = {
        ...examState,
        status: ExamStatus.SELESAI,
        submittedAt: new Date().toISOString(),
        score: computedScore,
        correctCount: correctAnswersCount,
        totalCount: totalQuestionsCount
      };

      await updateDoc(examDocRef, {
        status: ExamStatus.SELESAI,
        submittedAt: submittedExam.submittedAt,
        score: computedScore,
        correctCount: correctAnswersCount,
        totalCount: totalQuestionsCount
      });

      setExamState(submittedExam);

      // Update student activity
      await updateDoc(doc(db, "students", currentStudent.id), {
        currentActivity: `Selesai ${selectedSubject.name}`,
        lastActiveAt: new Date().toISOString()
      });

      addToast("success", `Ujian berhasil diselesaikan! Skor Anda: ${computedScore}`);

      // Immediately return back to the subject selector list
      setExamState(null);
      setSelectedSubject(null);
      setQuestions([]);
      setCurrentQuestionIndex(0);
    } catch (err) {
      addToast("error", "Gagal mengumpulkan lembar jawaban ke server.");
    }
  };

  // Format Timer strings for clock representation
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto h-full flex flex-col justify-center relative">
      {/* 1. Kicked out / Unfocus Cheat Modal alert state */}
      {cheatDetected && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div id="cbt-cheat-warning" className="glass-card p-8 rounded-3xl max-w-md w-full shadow-2xl border border-rose-500/30 text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Anda Tidak Fokus Ujian!</h1>
            <p className="text-slate-300 mb-6 text-sm">
              Sistem mendeteksi bahwa Anda telah berpindah tab, meminimalkan browser, atau keluar dari jendela ujian saat pengerjaan berlangsung. 
              <br />
              <strong className="text-rose-400">Akun Anda dinonaktifkan otomatis.</strong> Silakan hubungi proktor/kembali melaporkan ke Admin untuk mengaktifkan kembali akun.
            </p>
            <button 
              onClick={() => setCheatDetected(false)} 
              className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl border border-white/10 transition cursor-pointer"
            >
              Kembali ke Login
            </button>
          </div>
        </motion.div>
      )}

      {/* 2. Login Page state */}
      {!isLoggedIn && !cheatDetected && (
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-md glass-card p-8 rounded-3xl shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Portal CBT Siswa</h2>
              <p className="text-indigo-300 text-[10px] mt-1 font-mono tracking-wider">SILAKAN LOGIN MENGGUNAKAN AKUN DARI ADMIN</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Username / NIS</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan NIS / Username" 
                    className="w-full text-sm py-3 px-4 rounded-xl glass-input transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Kata Sandi / Password</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full text-sm py-3 px-4 rounded-xl glass-input transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <KeyRound className="w-4 h-4" />
                Masuk Ujian
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Subject Selector state */}
      {isLoggedIn && !selectedSubject && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-between items-center glass-card p-6 rounded-2xl shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Terautentikasi</p>
              <h2 className="text-2xl font-black text-white">{currentStudent?.name}</h2>
              <p className="text-xs text-slate-400">NIS: {currentStudent?.id}</p>
            </div>
            <button 
              onClick={handleLogOut} 
              className="text-xs text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Keluar Portal
            </button>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-400" />
              Daftar Ujian Tersedia
            </h3>
            
            {(!subjects || subjects.length === 0) ? (
              <div className="text-center p-8 glass-card rounded-2xl">
                <p className="text-slate-400 text-sm font-medium">Belum ada mata pelajaran ujian yang dibuat oleh Admin.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {subjects.map((sub) => {
                  const now = new Date();
                  const [startHour, startMin] = sub.startTime.split(":").map(Number);
                  const scheduledTime = new Date(sub.examDate);
                  scheduledTime.setHours(startHour, startMin, 0, 0);

                  const curDateString = now.toISOString().split("T")[0];
                  // If scheduling matches
                  const isFuture = curDateString < sub.examDate || (curDateString === sub.examDate && now < scheduledTime);

                  // Check if this student has finished this subject's exam
                  const hasFinished = studentExams.some(
                    (ex) => ex.subjectId === sub.id && ex.status === ExamStatus.SELESAI
                  );

                  return (
                    <div 
                      key={sub.id} 
                      className={`p-6 rounded-2xl glass-card flex flex-col justify-between transition-all duration-300 ${
                        hasFinished 
                          ? "border border-emerald-500/20 bg-emerald-500/5 opacity-90 shadow-lg shadow-emerald-500/5" 
                          : isFuture 
                          ? "opacity-50" 
                          : "hover:scale-[1.01] hover:border-indigo-500/30"
                      }`}
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-300 uppercase">{sub.id}</span>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{sub.name}</h4>
                          {hasFinished && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                              SELESAI
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-1 text-xs text-slate-300 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Tanggal: {sub.examDate}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Jam Mulai: {sub.startTime} WIB
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Durasi: {sub.duration} Menit
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5">
                        {hasFinished ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 text-center">
                              Anda sudah menjawab soalnya
                            </span>
                            <button 
                              disabled 
                              className="w-full mt-2 bg-white/5 border border-white/5 text-slate-500 font-bold text-xs py-2.5 px-4 rounded-xl cursor-not-allowed uppercase tracking-wider"
                            >
                              Selesai Pengerjaan
                            </button>
                          </div>
                        ) : isFuture ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 text-center">
                              Ujian terbuka jam {sub.startTime}, {sub.examDate}
                            </span>
                            <button 
                              disabled 
                              className="w-full mt-2 bg-white/5 border border-white/5 text-slate-400 font-semibold text-sm py-2 px-4 rounded-xl cursor-not-allowed"
                            >
                              Belum Dibuka
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => startExam(sub)}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition cursor-pointer"
                          >
                            Mulai Ujian
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 4. Taking Active Exam System (proctoring active) */}
      {isLoggedIn && selectedSubject && examState && questions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header Bar */}
          <div className="glass-card bg-slate-950/40 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-[10px] bg-white/10 border border-white/10 text-indigo-300 px-2 py-0.5 rounded font-mono uppercase tracking-widest">{selectedSubject.id}</span>
              <h2 className="text-lg font-black text-white">{selectedSubject.name}</h2>
              <p className="text-xs text-slate-300">Siswa: {currentStudent?.name}</p>
            </div>

            {examState.status === ExamStatus.MENGERJAKAN ? (
              <div className="flex items-center gap-4 bg-white/5 py-2.5 px-5 rounded-xl border border-white/10">
                <Clock className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div className="font-mono text-center">
                  <p className="text-[10px] text-slate-400 tracking-wider">SISA WAKTU</p>
                  <p className="text-lg font-bold tracking-widest text-white">{formatTime(remainingTime)}</p>
                </div>
              </div>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-4 py-2 rounded-xl border border-emerald-500/30 uppercase tracking-wider">
                Ujian Selesai
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Active Question Panel */}
            <div className="md:col-span-2 space-y-6">
              <div className="glass-card p-6 rounded-2xl relative">
                <span className="absolute top-4 right-4 text-[10px] font-mono font-bold bg-white/10 px-2.5 py-1 rounded-lg text-indigo-300 border border-white/10">
                  SOAL {currentQuestionIndex + 1} DARI {questions.length}
                </span>

                <div className="mt-4">
                  <p className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap text-base">
                    {questions[currentQuestionIndex].text}
                  </p>
                </div>

                {/* Option Choice buttons showing choice randomizations */}
                <div className="mt-8 space-y-3">
                  {(() => {
                    const currentQ = questions[currentQuestionIndex];
                    // Dynamic seed to make option mappings sync or generate random positions
                    const mapping = randomizedOptionMapping[currentQ.id] || Array.from({ length: currentQ.options.length }, (_, x) => x);
                    
                    return mapping.map((optionIdx, listIndex) => {
                      const optionLabel = String.fromCharCode(65 + listIndex); // A, B, C, D
                      const optionText = currentQ.options[optionIdx];
                      const isSelected = examState.answers[currentQ.id] === optionIdx;

                      return (
                        <button
                          key={optionIdx}
                          disabled={examState.status === ExamStatus.SELESAI}
                          onClick={() => saveAnswer(currentQ.id, optionIdx)}
                          className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition duration-150 flex items-center gap-4 ${
                            isSelected
                              ? "bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/10 font-semibold"
                              : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 cursor-pointer"
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold leading-none select-none transition ${
                            isSelected ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"
                          }`}>
                            {optionLabel}
                          </span>
                          <span>{optionText}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex justify-between items-center">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                  className="bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sebelumnya
                </button>

                {examState.status === ExamStatus.MENGERJAKAN && (
                  <button
                    onClick={handleManualSubmit}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    Kumpulkan Ujian
                  </button>
                )}

                <button
                  disabled={currentQuestionIndex === questions.length - 1}
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition"
                >
                  Selanjutnya
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Questions Jump Grid Panel (Right Sidebar) */}
            <div className="glass-card p-5 rounded-2xl flex flex-col h-fit">
              <h3 className="text-[10px] font-bold font-mono text-indigo-300 tracking-wider mb-4">NAVIGASI NOMOR SOAL</h3>
              <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isAnswered = examState.answers[q.id] !== undefined;
                  const isCurrent = idx === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`aspect-square w-full rounded-xl flex items-center justify-center text-xs font-bold cursor-pointer transition border duration-150 ${
                        isCurrent
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/35 scale-[1.05]"
                          : isAnswered
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {examState.status === ExamStatus.SELESAI && (
                <div className="mt-8 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-emerald-100 font-medium text-sm space-y-3">
                  <p className="font-bold text-center tracking-wider text-emerald-400">SKOR HASIL UJIAN</p>
                  <div className="text-center">
                    <p className="text-4xl font-black tracking-tight text-emerald-400">{examState.score}</p>
                    <p className="text-xs text-emerald-300 mt-1">
                      Menjawab Benar: {examState.correctCount} / {examState.totalCount} Soal
                    </p>
                  </div>
                  <button 
                    onClick={handleLogOut}
                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-bold text-xs cursor-pointer transition-colors shadow-md shadow-indigo-600/20"
                  >
                    Kembali ke Beranda
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
