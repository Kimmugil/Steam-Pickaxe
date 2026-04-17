"use client";
import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: "border-accent-green/50 bg-accent-green/10 text-accent-green",
  error: "border-accent-red/50 bg-accent-red/10 text-accent-red",
  info: "border-accent-blue/50 bg-accent-blue/10 text-accent-blue",
  warning: "border-accent-orange/50 bg-accent-orange/10 text-accent-orange",
};

export default function Toast({ message, type = "info", duration = 3500, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl text-sm font-medium animate-in slide-in-from-bottom-2 ${typeStyles[type]}`}>
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 text-current">✕</button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const show = (message: string, type: ToastType = "info") => setToast({ message, type });
  const clear = () => setToast(null);
  return { toast, show, clear };
}
