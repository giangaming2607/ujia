/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum StudentStatus {
  AKTIF = "aktif",
  TIDAK_AKTIF = "tidak_aktif"
}

export enum ExamStatus {
  MENGERJAKAN = "mengerjakan",
  SELESAI = "selesai"
}

export interface CheatingLog {
  timestamp: string; // ISO string
  description: string;
}

export interface Student {
  id: string; // Used as username / unique identifier
  name: string;
  password?: string; // Stored securely
  status: StudentStatus;
  currentActivity: string; // E.g., "Belum Login", "Memilih Mata Pelajaran", "Mengerjakan Matematika", "Curang - Pindah Tab", "Selesai"
  lastActiveAt?: string; // ISO string
  cheatingLogs: CheatingLog[];
  createdAt: string; // ISO string
}

export interface Subject {
  id: string; // Unique path id e.g., "BIO-101", "MAT-12"
  name: string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  duration: number; // in minutes
  createdAt: string; // ISO string
}

export interface Question {
  id: string;
  text: string;
  options: string[]; // Options array (A, B, C, D, E etc.)
  correctAnswer: number; // 0-indexed correct option index
}

export interface Exam {
  id: string; // Format: username_subjectId (unique per student-subject pair)
  studentId: string;
  subjectId: string;
  status: ExamStatus;
  questionOrder: string[]; // Shuffled question IDs
  answers: Record<string, number>; // questionId -> chosen options index (or -1 if unanswered)
  startedAt: string; // ISO string
  submittedAt?: string; // ISO string
  score: number; // 0 - 100
  correctCount: number;
  totalCount: number;
}
