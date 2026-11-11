import { AuthGuard } from "@/components/auth-guard";
import { KinetixWorkspace } from "@/components/kinetix-workspace";

export default function HomePage() {
  return (
    <AuthGuard>
      <KinetixWorkspace />
    </AuthGuard>
  );
}
