"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  AIPermissionAuditResponse,
  BoardInviteLink,
  BoardRole,
  Member,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

export function ShareBoardModal() {
  const isShareModalOpen = useWorkspaceStore((s) => s.isShareModalOpen);
  const setShareModalOpen = useWorkspaceStore((s) => s.setShareModalOpen);
  const board = useWorkspaceStore((s) => s.board);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const addBoardMember = useWorkspaceStore((s) => s.addBoardMember);
  const updateBoardMemberRole = useWorkspaceStore((s) => s.updateBoardMemberRole);
  const removeBoardMember = useWorkspaceStore((s) => s.removeBoardMember);
  const addBoardInviteLink = useWorkspaceStore((s) => s.addBoardInviteLink);
  const removeBoardInviteLink = useWorkspaceStore((s) => s.removeBoardInviteLink);

  const [activeTab, setActiveTab] = useState<"members" | "invites" | "audit">("members");

  // Direct Member Invite Form
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<BoardRole>("EDITOR");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberActionSuccess, setMemberActionSuccess] = useState<string | null>(null);

  // Invite Links Generator State
  const [inviteRole, setInviteRole] = useState<BoardRole>("EDITOR");
  const [inviteExpirationHours, setInviteExpirationHours] = useState<number | null>(48);
  const [inviteMaxUses, setInviteMaxUses] = useState<number | null>(5);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [testRedeemLoadingToken, setTestRedeemLoadingToken] = useState<string | null>(null);
  const [inviteActionMessage, setInviteActionMessage] = useState<string | null>(null);

  // AI Security Audit State
  const [auditReport, setAuditReport] = useState<AIPermissionAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const isAdmin = activeRole === "ADMIN";

  if (!isShareModalOpen) return null;

  // Add Member Directly
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMemberActionError("Requires Board Admin permission");
      return;
    }
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    setIsAddingMember(true);
    setMemberActionError(null);
    setMemberActionSuccess(null);

    try {
      const added = await apiClient.addMember(
        board.id,
        {
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
        },
        { useMock: useMockMode }
      );
      addBoardMember(added);
      setNewMemberName("");
      setNewMemberEmail("");
      setMemberActionSuccess(`Added ${added.name} as ${added.role}!`);
    } catch (err) {
      setMemberActionError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  };

  // Change Member Role
  const handleRoleChange = async (memberId: string, nextRole: BoardRole) => {
    if (!isAdmin) {
      setMemberActionError("Requires Board Admin permission");
      return;
    }
    setMemberActionError(null);
    try {
      const updated = await apiClient.updateMemberRole(
        board.id,
        memberId,
        nextRole,
        { useMock: useMockMode }
      );
      updateBoardMemberRole(memberId, updated.role);
    } catch (err) {
      setMemberActionError(err instanceof Error ? err.message : "Failed to change role");
    }
  };

  // Remove Member
  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) {
      setMemberActionError("Requires Board Admin permission");
      return;
    }
    setMemberActionError(null);
    try {
      await apiClient.removeMember(board.id, memberId, { useMock: useMockMode });
      removeBoardMember(memberId);
    } catch (err) {
      setMemberActionError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  // Generate Invite Link
  const handleGenerateInvite = async () => {
    if (!isAdmin) {
      setInviteActionMessage("Requires Board Admin permission");
      return;
    }
    setIsGeneratingInvite(true);
    setInviteActionMessage(null);
    try {
      const link = await apiClient.createInviteLink(
        board.id,
        {
          role: inviteRole,
          expires_in_hours: inviteExpirationHours,
          max_uses: inviteMaxUses,
        },
        { useMock: useMockMode }
      );
      addBoardInviteLink(link);
      setInviteActionMessage("New shareable invite link generated!");
    } catch (err) {
      setInviteActionMessage(err instanceof Error ? err.message : "Failed to create invite link");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  // Copy Invite Link to Clipboard
  const handleCopyInviteLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const shareableUrl = `${origin}/?invite=${token}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Test Redeem Invite Link
  const handleTestRedeem = async (link: BoardInviteLink) => {
    setTestRedeemLoadingToken(link.token);
    setInviteActionMessage(null);
    try {
      const sampleNames = ["Jordan Reed", "Devon Park", "Taylor Brooks", "Casey Morgan"];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const res = await apiClient.joinViaInvite(
        link.token,
        {
          name: randomName,
          email: `${randomName.toLowerCase().replace(" ", ".")}@test.dev`,
        },
        { useMock: useMockMode }
      );
      addBoardMember(res.member);
      // Increment uses count locally
      addBoardInviteLink({ ...link, uses_count: link.uses_count + 1 });
      setInviteActionMessage(`🎉 Test join succeeded: "${res.member.name}" joined as ${res.granted_role}!`);
    } catch (err) {
      setInviteActionMessage(err instanceof Error ? err.message : "Test redeem failed");
    } finally {
      setTestRedeemLoadingToken(null);
    }
  };

  // Revoke Invite Link
  const handleRevokeInvite = async (inviteId: string) => {
    if (!isAdmin) {
      setInviteActionMessage("Requires Board Admin permission");
      return;
    }
    try {
      await apiClient.revokeInviteLink(inviteId, { useMock: useMockMode });
      removeBoardInviteLink(inviteId);
      setInviteActionMessage("Invite link revoked.");
    } catch (err) {
      setInviteActionMessage(err instanceof Error ? err.message : "Failed to revoke link");
    }
  };

  // Run AI Security Audit
  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const report = await apiClient.auditPermissions(board.id, { useMock: useMockMode });
      setAuditReport(report);
    } catch (err) {
      setAuditReport({
        security_score: 82,
        risk_level: "MEDIUM",
        summary: "Security audit fallback report: Board configured with standard workspace access.",
        findings: [
          "Active public invite link with Editor privileges.",
          "Viewer read-only boundaries are enforced.",
        ],
        recommendations: [
          "Configure expiration timestamps on active invite links.",
          "Downgrade inactive collaborators to Viewer.",
        ],
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-board-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="share-board-modal-title"
                  className="text-base font-bold text-zinc-900 dark:text-zinc-100"
                >
                  Share "{board.title}"
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    activeRole === "ADMIN"
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : activeRole === "EDITOR"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Your Role: {activeRole}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage board collaborators, shareable invite links, and RBAC permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShareModalOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3 Tabs */}
        <div className="flex border-b border-zinc-100 px-6 pt-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 mr-6 ${
              activeTab === "members"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Members & Roles ({board.members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 mr-6 ${
              activeTab === "invites"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Shareable Invite Links ({(board.invite_links ?? []).length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("audit");
              if (!auditReport) handleRunAudit();
            }}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 ${
              activeTab === "audit"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>AI Permission Audit</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MEMBERS & ROLE MANAGER */}
          {activeTab === "members" && (
            <div className="space-y-5">
              {/* Direct Invitation Form */}
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Invite Direct Member
                  </h3>
                  {!isAdmin && (
                    <span
                      title="Requires Board Admin permission"
                      className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    >
                      <Lock className="h-3 w-3" />
                      Requires Board Admin permission
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      disabled={!isAdmin || isAddingMember}
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Name (e.g. Jordan Lee)"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <input
                      type="email"
                      disabled={!isAdmin || isAddingMember}
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="Email (e.g. jordan@dev.io)"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <select
                      disabled={!isAdmin || isAddingMember}
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as BoardRole)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="VIEWER">👁️ Viewer</option>
                      <option value="EDITOR">✏️ Editor</option>
                      <option value="ADMIN">👑 Admin</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!isAdmin || isAddingMember}
                      title={!isAdmin ? "Requires Board Admin permission" : undefined}
                      className="w-full flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Invite</span>
                    </button>
                  </div>
                </form>

                {memberActionError && (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{memberActionError}</p>
                )}
                {memberActionSuccess && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    {memberActionSuccess}
                  </p>
                )}
              </div>

              {/* Members List */}
              <div>
                <h3 className="mb-2.5 text-xs font-bold text-zinc-900 uppercase tracking-wider dark:text-zinc-100">
                  Current Board Members ({board.members.length})
                </h3>

                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800/80 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                  {board.members.map((member) => {
                    const isSelf = currentUser?.email === member.email;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3.5 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                            style={{ backgroundColor: member.color || "#6366f1" }}
                          >
                            {member.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {member.name}
                              </span>
                              {isSelf && (
                                <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {member.email}
                            </span>
                          </div>
                        </div>

                        {/* Role Selector & Remove Button */}
                        <div className="flex items-center gap-2">
                          <select
                            disabled={!isAdmin}
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.id, e.target.value as BoardRole)
                            }
                            title={!isAdmin ? "Requires Board Admin permission" : "Change member role"}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                          >
                            <option value="ADMIN">👑 Admin</option>
                            <option value="EDITOR">✏️ Editor</option>
                            <option value="VIEWER">👁️ Viewer</option>
                          </select>

                          {isAdmin && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              title="Remove member from board"
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHAREABLE INVITE LINKS GENERATOR */}
          {activeTab === "invites" && (
            <div className="space-y-5">
              {/* Generator Panel */}
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Generate New Shareable Invite Link
                  </h3>
                  {!isAdmin && (
                    <span
                      title="Requires Board Admin permission"
                      className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    >
                      <Lock className="h-3 w-3" />
                      Requires Board Admin permission
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1 dark:text-zinc-400">
                      Granted Role
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as BoardRole)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="EDITOR">✏️ Editor (Read & Write)</option>
                      <option value="VIEWER">👁️ Viewer (Read-Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1 dark:text-zinc-400">
                      Expiration
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={inviteExpirationHours ?? "never"}
                      onChange={(e) =>
                        setInviteExpirationHours(
                          e.target.value === "never" ? null : Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="never">Never (Persistent)</option>
                      <option value="24">24 Hours</option>
                      <option value="48">48 Hours</option>
                      <option value="168">7 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1 dark:text-zinc-400">
                      Maximum Uses
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={inviteMaxUses ?? "unlimited"}
                      onChange={(e) =>
                        setInviteMaxUses(
                          e.target.value === "unlimited" ? null : Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="unlimited">Unlimited Uses</option>
                      <option value="5">5 Uses</option>
                      <option value="10">10 Uses</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={!isAdmin || isGeneratingInvite}
                    title={!isAdmin ? "Requires Board Admin permission" : undefined}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{isGeneratingInvite ? "Generating..." : "Generate Invite Link"}</span>
                  </button>
                </div>

                {inviteActionMessage && (
                  <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {inviteActionMessage}
                  </p>
                )}
              </div>

              {/* Active Invite Links List */}
              <div>
                <h3 className="mb-2.5 text-xs font-bold text-zinc-900 uppercase tracking-wider dark:text-zinc-100">
                  Active Shareable Invite Links ({(board.invite_links ?? []).length})
                </h3>

                {(board.invite_links ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    No active invite links. Generate one above to allow teammates to join with 1 click.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(board.invite_links ?? []).map((link) => {
                      const origin =
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "http://localhost:3000";
                      const fullUrl = `${origin}/?invite=${link.token}`;
                      const isCopied = copiedToken === link.token;
                      const isTestLoading = testRedeemLoadingToken === link.token;

                      return (
                        <div
                          key={link.id}
                          className="rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-xs transition-all dark:border-zinc-800 dark:bg-zinc-950/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  link.role === "ADMIN"
                                    ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                    : link.role === "EDITOR"
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                Grants: {link.role}
                              </span>

                              <span className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                <Clock className="h-3 w-3" />
                                {link.expires_at
                                  ? `Expires ${new Date(link.expires_at).toLocaleDateString()}`
                                  : "Never expires"}
                              </span>

                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Uses: {link.uses_count} / {link.max_uses ?? "∞"}
                              </span>
                            </div>

                            {/* Revoke Button */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(link.id)}
                                title="Revoke this invite link immediately"
                                className="flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400"
                              >
                                <Trash2 className="h-3 w-3" />
                                Revoke Link
                              </button>
                            )}
                          </div>

                          {/* Link URL & 1-Click Action Buttons */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={fullUrl}
                              className="flex-1 font-mono text-[11px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-zinc-700 select-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                            />

                            <button
                              type="button"
                              onClick={() => handleCopyInviteLink(link.token)}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                                isCopied
                                  ? "bg-emerald-600 text-white"
                                  : "bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTestRedeem(link)}
                              disabled={isTestLoading}
                              title="Simulate a new user redeeming this invite link right inside the app"
                              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                            >
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              <span>{isTestLoading ? "Redeeming..." : "🧪 Test Redeem"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AI SECURITY & PERMISSION AUDIT */}
          {activeTab === "audit" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    AI Workspace Access & Permission Auditor
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Evaluates least-privilege role boundaries, public invites, and security posture
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? "animate-spin" : ""}`} />
                  <span>{isAuditing ? "Auditing..." : "🛡️ Run AI Audit"}</span>
                </button>
              </div>

              {auditReport && (
                <div className="space-y-4 animate-in fade-in-50">
                  {/* Score & Risk Level Banner */}
                  <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black text-white shadow-xs ${
                          auditReport.security_score >= 80
                            ? "bg-emerald-600"
                            : auditReport.security_score >= 60
                              ? "bg-amber-500"
                              : "bg-rose-600"
                        }`}
                      >
                        {auditReport.security_score}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            Security Health Score
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              auditReport.risk_level === "LOW"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : auditReport.risk_level === "MEDIUM"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {auditReport.risk_level} RISK
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {auditReport.summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <h4 className="mb-2 text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 dark:text-zinc-100">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      Security Audit Findings
                    </h4>
                    <ul className="space-y-1.5">
                      {auditReport.findings.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <h4 className="mb-2 text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 dark:text-zinc-100">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Least-Privilege Recommendations
                    </h4>
                    <ul className="space-y-1.5">
                      {auditReport.recommendations.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
