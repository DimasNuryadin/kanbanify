"use client";

import React, { useEffect } from "react";
import { Bot, CheckCircle2, Sparkles, X, Zap } from "lucide-react";
import { ButlerExecutionToast } from "@/lib/automation-engine";

interface ButlerToastProps {
  toasts: ButlerExecutionToast[];
  onDismiss: (id: string) => void;
}

export function ButlerToastContainer({ toasts, onDismiss }: ButlerToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <ButlerToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ButlerToastItem({
  toast,
  onDismiss,
}: {
  toast: ButlerExecutionToast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-3 dark:border-indigo-400/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 shadow-inner">
        <Zap className="h-4 w-4 animate-pulse fill-indigo-400 text-indigo-400" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-300 uppercase">
            <Bot className="h-2.5 w-2.5" />
            Butler Executed
          </span>
          <span className="font-mono text-[10px] text-zinc-500">
            {toast.timestamp}
          </span>
        </div>

        <p className="mt-1 truncate text-xs font-semibold text-zinc-100">
          ⚡ {toast.ruleName}
        </p>

        <p className="mt-0.5 truncate text-[11px] text-zinc-400">
          Target: <span className="font-medium text-zinc-300">&quot;{toast.cardTitle}&quot;</span>
        </p>

        {toast.actionSummary && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{toast.actionSummary}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
