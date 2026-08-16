import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { AgentManagement } from "@/components/agent-management";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff Agents & Operational Task Delegation" },
      {
        name: "description",
        content:
          "Manage task-based staff agents, delegate operational roles, and search active borrowers to appoint as staff.",
      },
      { property: "og:title", content: "Staff Agents & Operational Task Delegation" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { isStaff, isAdmin, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!isAdmin) {
        if (hasPermission("approve_loans")) {
          void navigate({ to: "/admin", replace: true });
        } else if (hasPermission("manage_users") || hasPermission("manage_phone_requests")) {
          void navigate({ to: "/admin/users", replace: true });
        } else if (hasPermission("manage_settings")) {
          void navigate({ to: "/admin/settings", replace: true });
        } else if (hasPermission("manage_tiers") || hasPermission("manage_testimonials")) {
          void navigate({ to: "/admin/products", replace: true });
        } else {
          void navigate({ to: "/dashboard", replace: true });
        }
      }
    }
  }, [loading, isStaff, isAdmin, hasPermission, navigate]);

  if (loading || !isStaff || !isAdmin) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-all-users-for-agents"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        <AgentManagement />
      </main>
    </div>
  );
}
