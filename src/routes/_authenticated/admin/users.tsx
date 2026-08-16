import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { UserManagement } from "@/components/user-management";
import { PhoneChangeManagement } from "@/components/phone-change-management";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & Borrowers Management — Admin Console" },
      {
        name: "description",
        content:
          "View registered borrowers, adjust credibility scores, freeze points, and process phone change requests.",
      },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { isStaff, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManageUsers = hasPermission("manage_users");
  const canManagePhone = hasPermission("manage_phone_requests");

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!canManageUsers && !canManagePhone) {
        if (hasPermission("approve_loans")) {
          void navigate({ to: "/admin", replace: true });
        } else if (hasPermission("manage_settings")) {
          void navigate({ to: "/admin/settings", replace: true });
        } else if (hasPermission("manage_tiers") || hasPermission("manage_testimonials")) {
          void navigate({ to: "/admin/products", replace: true });
        } else {
          void navigate({ to: "/dashboard", replace: true });
        }
      }
    }
  }, [loading, isStaff, canManageUsers, canManagePhone, hasPermission, navigate]);

  if (loading || !isStaff || (!canManageUsers && !canManagePhone)) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    if (canManageUsers) {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
    }
    if (canManagePhone) {
      void queryClient.invalidateQueries({ queryKey: ["phone-change-requests"] });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        {canManageUsers && <UserManagement />}
        {canManagePhone && <PhoneChangeManagement />}
      </main>
    </div>
  );
}
