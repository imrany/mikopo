import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { BusinessSettingsForm } from "@/components/business-settings-form";
import { DarajaCredentialsForm } from "@/components/daraja-credentials-form";
import { SmtpSettingsForm } from "@/components/smtp-settings-form";
import { VapidSettingsForm } from "@/components/vapid-settings-form";
import { DeleteBusinessCard } from "@/components/delete-business-card";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Business & System Settings — Admin Console" },
      {
        name: "description",
        content:
          "Configure business profile, Safaricom Daraja M-Pesa API credentials, and SMTP email service.",
      },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { isStaff, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManageSettings = hasPermission("manage_settings");

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!canManageSettings) {
        if (hasPermission("approve_loans")) {
          void navigate({ to: "/admin", replace: true });
        } else if (hasPermission("manage_users") || hasPermission("manage_phone_requests")) {
          void navigate({ to: "/admin/users", replace: true });
        } else if (hasPermission("manage_tiers") || hasPermission("manage_testimonials")) {
          void navigate({ to: "/admin/products", replace: true });
        } else {
          void navigate({ to: "/dashboard", replace: true });
        }
      }
    }
  }, [loading, isStaff, canManageSettings, hasPermission, navigate]);

  if (loading || !isStaff || !canManageSettings) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["daraja-credentials"] });
    void queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        <BusinessSettingsForm />
        <VapidSettingsForm />
        <DarajaCredentialsForm />
        <SmtpSettingsForm />
        <DeleteBusinessCard />
      </main>
    </div>
  );
}
