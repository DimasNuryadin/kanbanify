"use client";

import React, { useEffect, useState } from "react";
import { Check, Sparkles, UserPlus, X } from "lucide-react";
import { BoardRole } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

export function InviteBanner() {
  const pendingInviteToken = useWorkspaceStore((s) => s.pendingInviteToken);
  const setPendingInviteToken = useWorkspaceStore((s) => s.setPendingInviteToken);
  const board = useWorkspaceStore((s) => s.board);
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const addBoardMember = useWorkspaceStore((s) => s.addBoardMember);
  const setActiveRole = useWorkspaceStore((s) => s.setActiveRole);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [preview, setPreview] = useState<{
    board_id: string;
    board_title: string;
    inviter_name: string;
    granted_role: BoardRole;
    is_valid: boolean;
  } | null>(null);

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check URL query parameter for ?invite=<token>
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get("invite");
    if (inviteParam && !pendingInviteToken) {
      setPendingInviteToken(inviteParam);
    }
  }, [pendingInviteToken, setPendingInviteToken]);

  useEffect(() => {
    if (!pendingInviteToken || isDismissed) return;

    let isMounted = true;
    apiClient
      .previewInvite(pendingInviteToken, { useMock: useMockMode })
      .then((data) => {
        if (isMounted) {
          setPreview(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPreview({
            board_id: board.id,
            board_title: board.title,
            inviter_name: "Alex Rivera",
            granted_role: "EDITOR",
            is_valid: true,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pendingInviteToken, isDismissed, useMockMode, board.id, board.title]);

  if (!pendingInviteToken || isDismissed || !preview) return null;

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await apiClient.joinViaInvite(
        pendingInviteToken,
        {
          name: currentUser.name,
          email: currentUser.email,
        },
        { useMock: useMockMode }
      );
      addBoardMember(res.member);
      setActiveRole(res.granted_role);

      // Clean up URL query parameter without page reload
      if (typeof window !== "undefined" && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState({}, "", url.pathname + url.search);
      }

      setPendingInviteToken(null);
      setIsDismissed(true);

      addToast({
        id: `invite-joined-${Date.now()}`,
        ruleName: "Board Invite Accepted",
        cardTitle: res.board_title,
        actionSummary: `Joined board with ${res.granted_role} privileges!`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    } catch {
      setIsDismissed(true);
      setPendingInviteToken(null);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setPendingInviteToken(null);
    if (typeof window !== "undefined" && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full p-4 rounded-2xl border border-indigo-500/40 bg-white/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200 dark:border-indigo-500/30 dark:bg-zinc-900/95">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Board Invitation
              </span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold border ${
                  preview.granted_role === "ADMIN"
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    : preview.granted_role === "EDITOR"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {preview.granted_role}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">
              🎉 You've been invited by <strong>{preview.inviter_name}</strong> to join{" "}
              <strong>"{preview.board_title}"</strong> as <strong>{preview.granted_role}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Dismiss
        </button>

        <button
          type="button"
          onClick={handleAccept}
          disabled={isAccepting}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Check className="h-3.5 w-3.5" />
          <span>{isAccepting ? "Joining..." : "Accept Invite"}</span>
        </button>
      </div>
    </div>
  );
}
