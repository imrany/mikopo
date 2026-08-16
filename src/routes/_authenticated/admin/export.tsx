import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { ExportManagement } from "@/components/export-management";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";

export const Route = createFileRoute("/_authenticated/admin/export")({
  head: () => ({
    meta: [
      { title: "Data & Reports Export Console — Admin Console" },
      {
        name: "description",
        content:
          "Export loans, borrower profiles, repayments, guarantors, and audit logs to Excel (.xlsx) format.",
      },
    ],
  }),
  component: AdminExportPage,
});

function AdminExportPage() {
  const { isStaff, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { businessName } = useAppConfig();

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [loading, isStaff, navigate]);

  if (loading || !isStaff) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        <ExportManagement businessName={businessName as string} />
      </main>
    </div>
  );
}
