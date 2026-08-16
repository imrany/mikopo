import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { RulesManagement } from "@/components/rules-management";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/rules")({
  head: () => ({
    meta: [
      { title: "App Rules & Policies — Admin Console" },
      {
        name: "description",
        content:
          "Configure general application rules, loan activation policies, sandbox controls, and security lockouts.",
      },
    ],
  }),
  component: AdminRulesPage,
});

function AdminRulesPage() {
  const { isStaff, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManageSettings = hasPermission("manage_settings");

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!canManageSettings) {
        void navigate({ to: "/admin", replace: true });
      }
    }
  }, [loading, isStaff, canManageSettings, navigate]);

  if (loading || !isStaff || !canManageSettings) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-rules"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        <RulesManagement />
      </main>
    </div>
  );
}
