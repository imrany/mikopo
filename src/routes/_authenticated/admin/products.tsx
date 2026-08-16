import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { TierManagement } from "@/components/tier-management";
import { TestimonialManagement } from "@/components/testimonial-management";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Loan Products & Tiers — Admin Console" },
      {
        name: "description",
        content:
          "Configure loan product tiers, interest rates, term days, emergency locks, and borrower testimonials.",
      },
    ],
  }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const { isStaff, hasPermission, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManageTiers = hasPermission("manage_tiers");
  const canManageTestimonials = hasPermission("manage_testimonials");

  useEffect(() => {
    if (!loading) {
      if (!isStaff) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (!canManageTiers && !canManageTestimonials) {
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
  }, [loading, isStaff, canManageTiers, canManageTestimonials, hasPermission, navigate]);

  if (loading || !isStaff || (!canManageTiers && !canManageTestimonials)) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    if (canManageTiers) {
      void queryClient.invalidateQueries({ queryKey: ["admin-tiers"] });
    }
    if (canManageTestimonials) {
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />
        {canManageTiers && <TierManagement />}
        {canManageTestimonials && <TestimonialManagement />}
      </main>
    </div>
  );
}
