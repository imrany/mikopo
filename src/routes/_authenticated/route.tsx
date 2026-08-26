import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { LucideLoader } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSetupStatus } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const status = await getSetupStatus();
    if (status.needsSetup) {
      throw redirect({ to: "/setup" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LucideLoader className="size-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return <Outlet />;
}
