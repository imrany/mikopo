import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { SupportDesk } from "@/components/support-desk";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support Desk & Customer Requests — Admin Console" },
      {
        name: "description",
        content: "View, handle, and resolve user problem reports and customer support inquiries.",
      },
    ],
  }),
  component: AdminSupportPage,
});

function AdminSupportPage() {
  const { isStaff, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canHandleRequests = hasPermission("handle_user_requests");

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!canHandleRequests) {
        if (hasPermission("approve_loans")) {
          void navigate({ to: "/admin", replace: true });
        } else if (hasPermission("manage_users") || hasPermission("manage_phone_requests")) {
          void navigate({ to: "/admin/users", replace: true });
        } else if (hasPermission("manage_settings")) {
          void navigate({ to: "/admin/settings", replace: true });
        } else {
          void navigate({ to: "/dashboard", replace: true });
        }
      }
    }
  }, [loading, isStaff, canHandleRequests, hasPermission, navigate]);

  if (loading || !isStaff || !canHandleRequests) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        <SupportDesk />
      </main>
    </div>
  );
}
