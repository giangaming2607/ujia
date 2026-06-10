/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, XCircle } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error";
  text: string;
}

interface NotificationProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function Notification({ toasts, onClose }: NotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-2xl border backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-emerald-950/35 border-emerald-500/30 text-emerald-200 shadow-emerald-950/50"
                : "bg-rose-950/35 border-rose-500/30 text-rose-200 shadow-rose-950/50"
            }`}
            layout
          >
            <div className="flex items-center gap-3">
              {toast.type === "success" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 font-bold" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0 font-bold" />
              )}
              <p className="text-sm font-medium tracking-wide">{toast.text}</p>
            </div>
            <button
              onClick={() => onClose(toast.id)}
              className="ml-4 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close notification"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
