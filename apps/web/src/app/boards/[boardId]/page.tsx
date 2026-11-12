"use client";

import React, { Suspense, use, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { KinetixWorkspace } from "@/components/kinetix-workspace";
import { useWorkspaceStore } from "@/store/workspace-store";
import { recordRecentBoard } from "@/lib/recent-boards";

interface BoardDetailPageProps {
  params: Promise<{ boardId: string }>;
}

function BoardDetailContent({ boardId }: { boardId: string }) {
  const setActiveBoardId = useWorkspaceStore((s) => s.setActiveBoardId);

  useEffect(() => {
    if (boardId) {
      setActiveBoardId(boardId);
      recordRecentBoard(boardId);
    }
  }, [boardId, setActiveBoardId]);

  return <KinetixWorkspace />;
}

export default function BoardDetailPage({ params }: BoardDetailPageProps) {
  const { boardId } = use(params);

  return (
    <AuthGuard>
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <BoardDetailContent boardId={boardId} />
      </Suspense>
    </AuthGuard>
  );
}
