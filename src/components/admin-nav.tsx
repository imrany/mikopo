import { Link } from "@tanstack/react-router";
import {
  Award,
  FileSpreadsheet,
  Gavel,
  HelpCircle,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/admin.functions";
import { Skeleton } from "./ui/skeleton";

interface AdminNavProps {
  onRefresh?: () => void;
}

export function AdminNav({ onRefresh }: AdminNavProps) {
  const { hasPermission, isAdmin, isStaff } = useAuth();
  const overviewFn = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    enabled: isStaff,
  });

  const businessName = data?.settings?.business_name || "";
  const navItems = [
    {
      to: "/admin",
      label: "Overview & Queue",
      sub: "Metrics & Approvals",
      icon: ShieldCheck,
      shortLabel: "Overview",
    },
    {
      to: "/admin/users",
      label: "Users & Borrowers",
      sub: "Borrower Management",
      icon: Users,
      shortLabel: "Users",
      permission: ["manage_users", "manage_phone_requests"],
    },
    {
      to: "/staff",
      label: "Staff Agents",
      sub: "Task Rights & Roles",
      icon: UserCheck,
      shortLabel: "Agents",
      superAdminOnly: true,
    },
    {
      to: "/admin/settings",
      label: "Business & System",
      sub: "Branding & Daraja",
      icon: SlidersHorizontal,
      shortLabel: "Settings",
      permission: "manage_settings",
    },
    {
      to: "/admin/rules",
      label: "Rules & Security",
      sub: "App Rules & Policies",
      icon: Gavel,
      shortLabel: "Rules",
      permission: "manage_settings",
    },
    {
      to: "/admin/products",
      label: "Tiers & Content",
      sub: "Products & Reviews",
      icon: Award,
      shortLabel: "Products",
      permission: ["manage_tiers", "manage_testimonials"],
    },
    {
      to: "/admin/support",
      label: "Support Desk",
      sub: "User Issues & Inquiries",
      icon: HelpCircle,
      shortLabel: "Support",
      permission: "handle_user_requests",
    },
    {
      to: "/admin/export",
      label: "Data Export",
      sub: "Excel (.xlsx) Reports",
      icon: FileSpreadsheet,
      shortLabel: "Export",
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) {
      return isAdmin;
    }
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => hasPermission(p));
    }
    if (item.permission) {
      return hasPermission(item.permission);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
            {isLoading ? (
              <Skeleton className="w-20 h-5" />
            ) : (
              <Badge variant="secondary" className="font-semibold">
                {businessName}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage borrowers, loan queue approvals, M-Pesa disbursements, staff agents, and business
            settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh Page
            </Button>
          )}
        </div>
      </div>

      {/* TOP LEVEL NAVIGATION ROUTE TABS */}
      <nav
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(visibleItems.length, 5)} w-full p-1.5 gap-1 bg-background border shadow-soft rounded-2xl`}
      >
        {visibleItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/admin" }}
            className="flex items-center gap-2 py-3 px-3 text-xs font-medium rounded-xl transition-all hover:bg-muted/50 text-muted-foreground"
            activeProps={{
              className:
                "bg-primary text-primary-foreground shadow-xs hover:bg-primary font-semibold",
            }}
          >
            <item.icon className="size-4 shrink-0" />
            <div className="text-left hidden sm:block">
              <div className="font-semibold">{item.label}</div>
              <div className="text-[10px] opacity-80">{item.sub}</div>
            </div>
            <span className="sm:hidden font-semibold">{item.shortLabel}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
