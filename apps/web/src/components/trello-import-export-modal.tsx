"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  FolderKanban,
  Layers,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  BoardImportFormat,
  TrelloImportRequest,
  TrelloImportResult,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  generateBoardCsvExport,
  SAMPLE_TRELLO_EXPORT_JSON,
} from "@/lib/mock-data";
import { apiClient } from "@/lib/api-client";

interface TrelloImportExportModalProps {
  onImportSuccess: (result: TrelloImportResult) => void;
}

interface DetectedPayloadSummary {
  boardName: string;
  description: string;
  format: BoardImportFormat;
  listsCount: number;
  cardsCount: number;
  checklistsCount: number;
  listNames: string[];
}

function analyzeImportPayload(
  raw: Record<string, any> | null
): DetectedPayloadSummary | null {
  if (!raw || typeof raw !== "object") return null;

  // Detect Kinetix JSON backup vs Trello JSON export
  if (Array.isArray(raw.columns) && !Array.isArray(raw.lists)) {
    const cols = raw.columns as any[];
    const cards = Array.isArray(raw.cards) ? (raw.cards as any[]) : [];
    const checklistsCount = cards.reduce(
      (sum, c) =>
        sum + (Array.isArray(c.checklists) ? c.checklists.length : 0),
      0
    );
    return {
      boardName: String(
        raw.title || raw.name || "Imported Kinetix Board"
      ).slice(0, 150),
      description: String(raw.description || raw.desc || ""),
      format: "kinetix_json",
      listsCount: cols.length,
      cardsCount: cards.length,
      checklistsCount,
      listNames: cols.map((c) => String(c.title || "List")).slice(0, 8),
    };
  }

  const lists = Array.isArray(raw.lists)
    ? (raw.lists as any[]).filter((l) => !l.closed)
    : [];
  const cards = Array.isArray(raw.cards)
    ? (raw.cards as any[]).filter((c) => !c.closed)
    : [];
  const topChecklists = Array.isArray(raw.checklists)
    ? (raw.checklists as any[]).length
    : 0;
  const inlineChecklists = cards.reduce(
    (sum, c) => sum + (Array.isArray(c.checklists) ? c.checklists.length : 0),
    0
  );

  return {
    boardName: String(raw.name || raw.title || "Imported Trello Board").slice(
      0,
      150
    ),
    description: String(raw.desc || raw.description || ""),
    format: "trello_json",
    listsCount: lists.length,
    cardsCount: cards.length,
    checklistsCount: topChecklists + inlineChecklists,
    listNames: lists.map((l) => String(l.name || l.title || "List")).slice(0, 8),
  };
}

function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TrelloImportExportModal({
  onImportSuccess,
}: TrelloImportExportModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isImportExportModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setImportExportModalOpen);
  const board = useWorkspaceStore((s) => s.board);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [parsedPayload, setParsedPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [boardTitleOverride, setBoardTitleOverride] = useState("");
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => analyzeImportPayload(parsedPayload as Record<string, any> | null),
    [parsedPayload]
  );

  if (!isOpen) return null;

  const boardSlug =
    board.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "board";

  const handleLoadSampleTrelloJson = () => {
    setErrorMsg(null);
    const sample = JSON.parse(JSON.stringify(SAMPLE_TRELLO_EXPORT_JSON));
    setParsedPayload(sample);
    setBoardTitleOverride(sample.name);
    setLoadedFileName("sample-trello-board-export.json");
  };

  const handleParseFile = async (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setErrorMsg("Please select a valid .json file exported from Trello or Kinetix.");
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        setErrorMsg("Invalid JSON structure: expected a board JSON object.");
        return;
      }
      setParsedPayload(json as Record<string, unknown>);
      setLoadedFileName(file.name);
      const detected = analyzeImportPayload(json);
      if (detected) {
        setBoardTitleOverride(detected.boardName);
      }
    } catch {
      setErrorMsg("Failed to parse JSON file. Ensure the file contains valid JSON.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleParseFile(file);
    }
  };

  const handleImportSubmit = async () => {
    if (!parsedPayload || !preview) return;
    setIsImporting(true);
    setErrorMsg(null);

    try {
      const req: TrelloImportRequest = {
        workspace_id: currentWorkspaceId || board.workspace_id,
        board_title_override:
          boardTitleOverride.trim() || preview.boardName || "Imported Board",
        format: preview.format,
        payload: parsedPayload,
      };

      const result = await apiClient.importBoard(req, {
        useMock: useMockMode,
      });

      onImportSuccess(result);
      setOpen(false);
      setParsedPayload(null);
      setLoadedFileName(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to import board JSON."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      let csvResp = await apiClient.exportBoardCsv(board.id, {
        useMock: useMockMode,
      });
      // If current store board has newer unsaved/optimistic cards in Mock Mode, ensure parity
      if (useMockMode) {
        csvResp = generateBoardCsvExport(board);
      }
      triggerBrowserDownload(
        csvResp.filename || `${boardSlug}-export.csv`,
        csvResp.csv_data,
        "text/csv;charset=utf-8;"
      );

      addToast({
        id: `export-csv-${Date.now()}`,
        ruleName: "CSV Export Complete",
        cardTitle: board.title,
        actionSummary: `Downloaded ${csvResp.filename}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      const exportedBoard = useMockMode
        ? board
        : await apiClient.exportBoardJson(board.id, { useMock: false });
      const filename = `${boardSlug}-backup.json`;
      triggerBrowserDownload(
        filename,
        JSON.stringify(exportedBoard, null, 2),
        "application/json;charset=utf-8;"
      );

      addToast({
        id: `export-json-${Date.now()}`,
        ruleName: "Full JSON Backup Exported",
        cardTitle: board.title,
        actionSummary: `Downloaded ${filename}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                📥 Native Trello JSON Importer &amp; 📤 CSV/JSON Exporter
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Migrate boards from Trello with O(1) fractional indexing or
                export sprint telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
              activeTab === "import"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>📥 Import Trello / Kinetix JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
              activeTab === "export"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>📤 Instant Board Export (CSV &amp; JSON)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {activeTab === "import" ? (
            <>
              {/* 1-Click Sample Trello JSON Loader Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-transparent p-4">
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Instant 1-Click Trello Migration Test
                  </span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    No external file needed! Pre-load a complete sample Trello
                    JSON payload with lists, cards, labels &amp; checklists.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLoadSampleTrelloJson}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-500 active:scale-[0.99]"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  <span>🧪 Load Sample Trello Export JSON</span>
                </button>
              </div>

              {/* Drag and Drop File Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDraggingOver
                    ? "border-indigo-500 bg-indigo-500/10"
                    : loadedFileName
                      ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-zinc-300 bg-zinc-50/70 hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-indigo-500/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleParseFile(file);
                  }}
                />
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FileUp className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {loadedFileName
                    ? `Loaded: ${loadedFileName}`
                    : "Drag & drop your Trello .json export or Kinetix backup here"}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Supports native Trello JSON (<code>lists</code>,{" "}
                  <code>cards</code>, <code>checklists</code>,{" "}
                  <code>labels</code>) or Kinetix <code>BoardSchema</code> JSON
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Live Preview Before Import */}
              {preview && (
                <div className="space-y-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/5 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Live Import Preview — Ready to Import
                      </span>
                    </div>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 uppercase dark:text-emerald-200">
                      {preview.format === "trello_json"
                        ? "Trello JSON"
                        : "Kinetix Backup"}
                    </span>
                  </div>

                  {/* Board Title Override Input */}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                      Detected Board Name (Editable before import)
                    </label>
                    <input
                      type="text"
                      value={boardTitleOverride}
                      onChange={(e) => setBoardTitleOverride(e.target.value)}
                      placeholder="Imported Board Title..."
                      className="w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>

                  {/* Detected Counts Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/90">
                      <div className="flex items-center justify-center gap-1 text-indigo-500">
                        <Layers className="h-4 w-4" />
                        <span className="font-mono text-lg font-extrabold text-zinc-900 dark:text-white">
                          {preview.listsCount}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                        Detected Lists
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/90">
                      <div className="flex items-center justify-center gap-1 text-emerald-500">
                        <FolderKanban className="h-4 w-4" />
                        <span className="font-mono text-lg font-extrabold text-zinc-900 dark:text-white">
                          {preview.cardsCount}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                        Detected Cards
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/90">
                      <div className="flex items-center justify-center gap-1 text-sky-500">
                        <CheckSquare className="h-4 w-4" />
                        <span className="font-mono text-lg font-extrabold text-zinc-900 dark:text-white">
                          {preview.checklistsCount}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                        Checklists
                      </p>
                    </div>
                  </div>

                  {preview.listNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                        Lists to create:
                      </span>
                      {preview.listNames.map((name, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Export Bar at bottom of Import tab so both actions are always 1 click away */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Want to export{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    {board.title}
                  </strong>{" "}
                  instead?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExportingCsv}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Export CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    disabled={isExportingJson}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Export JSON (.json)</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* EXPORT TAB */
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Active Board:{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {board.title}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Contains{" "}
                  {board.columns.filter((c) => !c.is_archived).length} active
                  lists, {board.cards.filter((c) => !c.is_archived).length}{" "}
                  active cards, and{" "}
                  {(board.automation_rules ?? []).length} Butler automation
                  rules.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Export to CSV Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Export to CSV (.csv)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Downloads{" "}
                      <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        {boardSlug}-export.csv
                      </code>{" "}
                      with Card ID, Title, Column, Priority, Story Points,
                      Labels, Members, Due Date, and Checklist Progress for
                      Excel / Google Sheets.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExportingCsv}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isExportingCsv ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>Download {boardSlug}-export.csv</span>
                  </button>
                </div>

                {/* Export to Full JSON Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <FileCode2 className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Export to Full JSON (.json)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Downloads{" "}
                      <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        {boardSlug}-backup.json
                      </code>{" "}
                      containing complete board state, columns, cards,
                      checklists, comments, and Butler rules.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    disabled={isExportingJson}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {isExportingJson ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>Download {boardSlug}-backup.json</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200/80 bg-zinc-50/80 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>

          {activeTab === "import" && (
            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={!preview || isImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>Import as New Board</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
