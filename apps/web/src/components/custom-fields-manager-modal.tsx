"use client";

import React, { useState } from "react";
import {
  Calendar,
  Check,
  CheckSquare,
  Hash,
  List,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  CustomFieldDefinition,
  CustomFieldOption,
  CustomFieldType,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

export const CUSTOM_FIELD_OPTION_COLORS = [
  {
    id: "green",
    label: "Green",
    bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "yellow",
    label: "Yellow",
    bg: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    id: "orange",
    label: "Orange",
    bg: "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  {
    id: "red",
    label: "Red",
    bg: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  {
    id: "purple",
    label: "Purple",
    bg: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  {
    id: "sky",
    label: "Sky",
    bg: "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    id: "slate",
    label: "Slate",
    bg: "bg-slate-500/15 border-slate-500/40 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
  },
] as const;

export function getCustomFieldOptionColor(colorName?: string) {
  const found = CUSTOM_FIELD_OPTION_COLORS.find((c) => c.id === colorName);
  return (
    found ?? {
      id: "blue",
      label: "Blue",
      bg: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
    }
  );
}

export function CustomFieldsManagerModal() {
  const isOpen = useWorkspaceStore((s) => s.isCustomFieldsModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setCustomFieldsModalOpen);
  const board = useWorkspaceStore((s) => s.board);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const isViewer = activeRole === "VIEWER";

  const upsertCustomFieldDefinition = useWorkspaceStore(
    (s) => s.upsertCustomFieldDefinition
  );
  const removeCustomFieldDefinition = useWorkspaceStore(
    (s) => s.removeCustomFieldDefinition
  );
  const addToast = useWorkspaceStore((s) => s.addToast);

  // New field form state
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [showOnFront, setShowOnFront] = useState(true);
  const [options, setOptions] = useState<CustomFieldOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionColor, setNewOptionColor] = useState("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick edit option state for existing dropdown
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingOptionLabel, setEditingOptionLabel] = useState("");
  const [editingOptionColor, setEditingOptionColor] = useState("blue");

  if (!isOpen) return null;

  const customFields = (board.custom_fields ?? []).slice();

  const handleAddOptionToDraft = () => {
    const trimmed = newOptionLabel.trim();
    if (!trimmed) return;
    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setOptions((prev) => [
      ...prev,
      { id: optId, label: trimmed, color: newOptionColor },
    ]);
    setNewOptionLabel("");
  };

  const handleRemoveOptionFromDraft = (optId: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== optId));
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isViewer) return;

    if (type === "DROPDOWN" && options.length === 0) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Validation Warning",
        cardTitle: "Custom Fields",
        actionSummary: "Dropdown custom fields require at least one option.",
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiClient.createCustomField(
        board.id,
        {
          name: trimmedName,
          type,
          show_on_front: showOnFront,
          options: type === "DROPDOWN" ? options : [],
        },
        { useMock: useMockMode }
      );

      upsertCustomFieldDefinition(created);
      setName("");
      setType("TEXT");
      setShowOnFront(true);
      setOptions([]);
      setNewOptionLabel("");

      addToast({
        id: `cf-created-${created.id}`,
        ruleName: "Custom Field Created",
        cardTitle: created.name,
        actionSummary: `Added "${created.name}" (${created.type}) to board.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Failed to Create Field",
        cardTitle: "Custom Fields",
        actionSummary:
          err instanceof Error ? err.message : "Unknown error occurred",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleShowOnFront = async (
    field: CustomFieldDefinition,
    current: boolean
  ) => {
    if (isViewer) return;
    try {
      const updated = await apiClient.updateCustomField(
        field.id,
        { show_on_front: !current },
        { useMock: useMockMode }
      );
      upsertCustomFieldDefinition(updated);
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Update Failed",
        cardTitle: field.name,
        actionSummary:
          err instanceof Error ? err.message : "Failed to toggle card front",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleDeleteField = async (field: CustomFieldDefinition) => {
    if (isViewer) return;
    const ok = window.confirm(
      `Delete "${field.name}" custom field?\n\nThis will remove stored values for this field across all cards on this board.`
    );
    if (!ok) return;

    try {
      await apiClient.deleteCustomField(field.id, { useMock: useMockMode });
      removeCustomFieldDefinition(field.id);
      addToast({
        id: `cf-del-${field.id}`,
        ruleName: "Custom Field Deleted",
        cardTitle: field.name,
        actionSummary: `Removed "${field.name}" and cleared associated card values.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Delete Failed",
        cardTitle: field.name,
        actionSummary:
          err instanceof Error ? err.message : "Failed to delete custom field",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleAddOptionToExisting = async (field: CustomFieldDefinition) => {
    const trimmed = editingOptionLabel.trim();
    if (!trimmed || isViewer) return;

    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextOptions = [
      ...field.options,
      { id: optId, label: trimmed, color: editingOptionColor },
    ];

    try {
      const updated = await apiClient.updateCustomField(
        field.id,
        { options: nextOptions },
        { useMock: useMockMode }
      );
      upsertCustomFieldDefinition(updated);
      setEditingOptionLabel("");
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Failed to Add Option",
        cardTitle: field.name,
        actionSummary:
          err instanceof Error ? err.message : "Failed to add dropdown option",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleRemoveOptionFromExisting = async (
    field: CustomFieldDefinition,
    optId: string
  ) => {
    if (isViewer) return;
    const nextOptions = field.options.filter((o) => o.id !== optId);
    try {
      const updated = await apiClient.updateCustomField(
        field.id,
        { options: nextOptions },
        { useMock: useMockMode }
      );
      upsertCustomFieldDefinition(updated);
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Failed to Remove Option",
        cardTitle: field.name,
        actionSummary:
          err instanceof Error ? err.message : "Failed to update options",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🧩 Custom Fields Power-Up</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {customFields.length} defined
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Define typed metadata across cards with front-of-card badges and
                Table View columns.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Fields List */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Defined Board Fields ({customFields.length})
            </h3>
            {customFields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No custom fields defined on this board yet. Use the form below to
                create one!
              </div>
            ) : (
              <div className="space-y-3">
                {customFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/90"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {field.type === "DROPDOWN" && (
                            <List className="h-3.5 w-3.5" />
                          )}
                          {field.type === "NUMBER" && (
                            <Hash className="h-3.5 w-3.5" />
                          )}
                          {field.type === "TEXT" && (
                            <Type className="h-3.5 w-3.5" />
                          )}
                          {field.type === "DATE" && (
                            <Calendar className="h-3.5 w-3.5" />
                          )}
                          {field.type === "CHECKBOX" && (
                            <CheckSquare className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                              {field.name}
                            </span>
                            <span className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.2 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {field.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Controls: Show on front toggle + Delete button */}
                      <div className="flex items-center gap-3">
                        <label
                          className={`flex items-center gap-2 text-xs font-medium cursor-pointer ${
                            isViewer
                              ? "opacity-60 cursor-not-allowed"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isViewer}
                            checked={field.show_on_front}
                            onChange={() =>
                              handleToggleShowOnFront(
                                field,
                                field.show_on_front
                              )
                            }
                            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Show on card front</span>
                        </label>

                        {!isViewer && (
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field)}
                            title="Delete custom field"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* If DROPDOWN: Render Option Pills and Editor */}
                    {field.type === "DROPDOWN" && (
                      <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className="text-[11px] font-medium text-zinc-400 mr-1">
                            Options:
                          </span>
                          {field.options.map((opt) => {
                            const optColor = getCustomFieldOptionColor(
                              opt.color
                            );
                            return (
                              <span
                                key={opt.id}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${optColor.bg}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${optColor.dot}`}
                                />
                                <span>{opt.label}</span>
                                {!isViewer && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveOptionFromExisting(
                                        field,
                                        opt.id
                                      )
                                    }
                                    className="ml-0.5 text-zinc-400 hover:text-rose-600 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>

                        {/* Add option to existing dropdown */}
                        {!isViewer && editingFieldId === field.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-zinc-100/80 p-2 dark:bg-zinc-800/60">
                            <input
                              type="text"
                              placeholder="New option label..."
                              value={editingOptionLabel}
                              onChange={(e) =>
                                setEditingOptionLabel(e.target.value)
                              }
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            />
                            {/* Color Selector */}
                            <div className="flex items-center gap-1">
                              {CUSTOM_FIELD_OPTION_COLORS.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setEditingOptionColor(c.id)}
                                  title={c.label}
                                  className={`h-5 w-5 rounded-full border transition-all ${c.dot} ${
                                    editingOptionColor === c.id
                                      ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900 scale-110"
                                      : "border-black/10 opacity-70 hover:opacity-100"
                                  }`}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddOptionToExisting(field)}
                              className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFieldId(null);
                                setEditingOptionLabel("");
                              }}
                              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {!isViewer && editingFieldId !== field.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFieldId(field.id);
                              setEditingOptionLabel("");
                              setEditingOptionColor("blue");
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add option</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* "+ New Custom Field" Creator Form */}
          {!isViewer && (
            <form
              onSubmit={handleCreateField}
              className="rounded-xl border border-indigo-500/30 bg-indigo-50/40 p-5 dark:border-indigo-500/20 dark:bg-indigo-950/20 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>+ New Custom Field</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Field Name */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Environment, Est. Hours, Sprint Target..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Field Type */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Field Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as CustomFieldType)
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="TEXT">Text (Single Line)</option>
                    <option value="NUMBER">Number</option>
                    <option value="DROPDOWN">Dropdown (Colored Pills)</option>
                    <option value="DATE">Date</option>
                    <option value="CHECKBOX">Checkbox (Yes/No)</option>
                  </select>
                </div>
              </div>

              {/* Show on Front Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="new-show-on-front"
                  checked={showOnFront}
                  onChange={(e) => setShowOnFront(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="new-show-on-front"
                  className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Show badge on front of Kanban cards
                </label>
              </div>

              {/* If DROPDOWN: Options Builder */}
              {type === "DROPDOWN" && (
                <div className="rounded-lg border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Dropdown Options (Select Color Pill):
                  </div>

                  {/* Existing Draft Options */}
                  {options.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {options.map((opt) => {
                        const optColor = getCustomFieldOptionColor(opt.color);
                        return (
                          <span
                            key={opt.id}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${optColor.bg}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${optColor.dot}`}
                            />
                            <span>{opt.label}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveOptionFromDraft(opt.id)
                              }
                              className="ml-1 text-zinc-400 hover:text-rose-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Add option bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Option label (e.g. Staging, High, v1.2)..."
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOptionToDraft();
                        }
                      }}
                      className="flex-1 min-w-[160px] rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />

                    {/* Color Palette */}
                    <div className="flex items-center gap-1">
                      {CUSTOM_FIELD_OPTION_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewOptionColor(c.id)}
                          title={c.label}
                          className={`h-5 w-5 rounded-full border transition-all ${c.dot} ${
                            newOptionColor === c.id
                              ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900 scale-110"
                              : "border-black/10 opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOptionToDraft}
                      className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                    >
                      + Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? "Creating..." : "Create Field"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200/80 bg-zinc-50/70 px-6 py-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/60 text-xs text-zinc-500">
          <span>
            {isViewer
              ? "Read-only mode: Only Admins and Editors can manage custom fields."
              : "Pre-seeded fields: Environment, Est. Hours, QA Verified."}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-white px-3 py-1.5 font-semibold text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
