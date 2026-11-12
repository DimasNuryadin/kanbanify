import { Suspense } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { KinetixWorkspace } from "@/components/kinetix-workspace";

export default function HomePage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <KinetixWorkspace />
      </Suspense>
    </AuthGuard>
  );
}
