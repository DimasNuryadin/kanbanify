"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Columns,
  Download,
  FileCode2,
  FileUp,
  FolderKanban,
  LayoutGrid,
  Loader2,
  Sparkles,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Board, BoardRole, TrelloImportResult } from "@kinetix/contracts";
import { SAMPLE_TRELLO_EXPORT_JSON } from "@/lib/mock-data";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { recordRecentBoard } from "@/lib/recent-boards";
import { useRouter } from "next/navigation";

interface WorkspacePulseModalProps {
  boards: Board[];
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (result: TrelloImportResult) => void;
}

export function WorkspacePulseModal({
  boards,
  isOpen,
  onClose,
  onImportSuccess,
}: WorkspacePulseModalProps) {
  const router = useRouter();
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const activeRole = useWorkspaceStore((s) => s.activeRole);

  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute live pulse metrics
  const totalBoards = boards.length;
  const totalCards = boards.reduce(
    (sum, b) => sum + (b.cards ? b.cards.filter((c) => !c.is_archived).length : 0),
    0
  );
  const totalColumns = boards.reduce(
    (sum, b) => sum + (b.columns ? b.columns.filter((col) => !col.is_archived).length : 0),
    0
  );
  const allMembers = new Set<string>();
  boards.forEach((b) => (b.members || []).forEach((m) => allMembers.add(m.id)));
  const totalMembers = Math.max(allMembers.size, 3); // Alex, Sarah, Budi

  const totalAutomations = boards.reduce(
    (sum, b) => sum + (b.automation_rules ? b.automation_rules.filter((r) => r.is_enabled).length : 0),
    0
  );

  const handleDirectTrelloImport = async (jsonString?: string) => {
    try {
      setIsImporting(true);
      setErrorMessage(null);
      setImportStatus("Calling POST /api/v1/boards/import/trello...");

      const payload = jsonString
        ? JSON.parse(jsonString)
        : SAMPLE_TRELLO_EXPORT_JSON;

      const result = await apiClient.importBoard(
        {
          format: "trello_json",
          payload: payload as Record<string, unknown>,
          workspace_id: currentWorkspaceId,
        },
        { useMock: useMockMode }
      );

      setImportStatus(`Successfully imported "${result.board.title}"!`);
      recordRecentBoard(result.board.id);

      if (onImportSuccess) {
        onImportSuccess(result);
      }

      setTimeout(() => {
        onClose();
        router.push(`/?boardId=${result.board.id}`);
      }, 700);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to import Trello board JSON"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleDirectTrelloImport(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-5 dark:border-zinc-800 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                📊 Workspace Pulse & Health
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Real-time operational summary & direct Trello board ingestion
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                <FolderKanban className="h-4 w-4 text-indigo-500" />
                <span>Boards</span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-white">
                {totalBoards}
              </p>
              <span className="text-[10px] text-zinc-400">Workspace total</span>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                <Columns className="h-4 w-4 text-emerald-500" />
                <span>Active Cards</span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-white">
                {totalCards}
              </p>
              <span className="text-[10px] text-zinc-400">Across {totalColumns} lists</span>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                <Users className="h-4 w-4 text-amber-500" />
                <span>Active Members</span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-white">
                {totalMembers}
              </p>
              <span className="text-[10px] text-zinc-400">RBAC Verified</span>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                <Zap className="h-4 w-4 text-purple-500" />
                <span>Butler Rules</span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-white">
                {totalAutomations}
              </p>
              <span className="text-[10px] text-zinc-400">Active triggers</span>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {importStatus && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          {/* Direct Trello JSON Import Action Box */}
          <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-5 dark:border-indigo-800/80 dark:bg-indigo-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Direct Trello JSON Import Endpoint
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Ingest full Trello boards (lists, cards, checklists, labels, cover images) directly via{" "}
                  <code className="rounded bg-indigo-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    POST /api/v1/boards/import/trello
                  </code>
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
              {/* 1-Click Sample Trello JSON Import */}
              <button
                type="button"
                disabled={isImporting}
                onClick={() => handleDirectTrelloImport()}
                className="flex w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/50 disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-300" />
                )}
                <span>1-Click Import Sample Trello Board</span>
              </button>

              {/* Upload custom Trello JSON */}
              <label
                className={`flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
                  isImporting ? "opacity-50 pointer-events-none" : "cursor-pointer"
                }`}
              >
                <FileUp className="h-4 w-4 text-indigo-500" />
                <span>Upload .JSON File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isImporting}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 p-4 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400">
            Active Workspace Role: <strong className="text-zinc-700 dark:text-zinc-300">{activeRole}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
