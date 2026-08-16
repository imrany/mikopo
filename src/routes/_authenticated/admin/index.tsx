import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Check,
  FileSpreadsheet,
  LucideLoader,
  Send,
  Smartphone,
  UserX,
  Users,
  X,
} from "lucide-react";
import { getExportDataset } from "@/lib/export.functions";
import { downloadExcelFromData } from "@/lib/excel-export";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { LoadingPage } from "@/components/loading-page";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/skeleton-loaders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import { getAdminOverview } from "@/lib/admin.functions";
import { decideLoan, disburseLoan, listAdminLoans } from "@/lib/loans.functions";
import { formatKes } from "@/lib/format";

const adminSearchSchema = z
  .object({
    tab: z.enum(["overview", "users", "agents", "settings", "products"]).optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: adminSearchSchema,
  head: () => ({
    meta: [
      { title: "Admin Console — Overview & Loan Queue" },
      {
        name: "description",
        content:
          "Administrator overview of loan requests, pending queue approvals, M-Pesa disbursements, and borrower statistics.",
      },
      { property: "og:title", content: "Admin Console — Overview & Loan Queue" },
      { property: "og:description", content: "Manage borrowers and business configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { tab } = Route.useSearch();
  const { isStaff, loading, profile: currentProfile } = useAuth();
  const navigate = useNavigate();
  const overviewFn = useServerFn(getAdminOverview);
  const loansFn = useServerFn(listAdminLoans);
  const decideFn = useServerFn(decideLoan);
  const disburseFn = useServerFn(disburseLoan);
  const getExportFn = useServerFn(getExportDataset);
  const queryClient = useQueryClient();
  const { businessName } = useAppConfig();
  const [rejectLoanId, setRejectLoanId] = useState<string | null>(null);
  const [isExportingLoans, setIsExportingLoans] = useState(false);

  const handleQuickExportLoans = async () => {
    setIsExportingLoans(true);
    try {
      const res = await getExportFn({
        data: { dataset: "loans", statusFilter: "all" },
      });
      if (res.loans && res.loans.length > 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        downloadExcelFromData(res.loans, {
          fileName: `${businessName}_Loans_Queue_Export_${todayStr}`,
          sheetName: "Loans Queue",
        });
        toast.success(`Exported ${res.loans.length} loan records to Excel!`);
      } else {
        toast.info("No loan records found to export.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export loans to Excel.");
    } finally {
      setIsExportingLoans(false);
    }
  };

  useEffect(() => {
    if (!loading && !isStaff) {
      void navigate({ to: "/dashboard", replace: true });
      return;
    }

    if (loading) return;

    if (tab === "users") {
      void navigate({ to: "/admin/users", replace: true });
    } else if (tab === "agents") {
      void navigate({ to: "/staff", replace: true });
    } else if (tab === "products") {
      void navigate({ to: "/admin/products", replace: true });
    } else if (tab === "settings") {
      void navigate({ to: "/admin/settings", replace: true });
    }
  }, [loading, isStaff, tab, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    enabled: isStaff,
  });

  const loansQuery = useQuery({
    queryKey: ["admin-loans"],
    queryFn: () => loansFn(),
    enabled: isStaff,
  });

  const decideMutation = useMutation({
    mutationFn: (input: { loanId: string; approve: boolean }) => decideFn({ data: input }),
    onSuccess: (_res, input) => {
      toast.success(input.approve ? "Loan approved" : "Loan rejected");
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disburseMutation = useMutation({
    mutationFn: (loanId: string) => disburseFn({ data: { loanId } }),
    onSuccess: () => {
      toast.success("M-Pesa payout sent for processing");
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || !isStaff) {
    return <LoadingPage />;
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <AdminNav onRefresh={handleRefresh} />

        {isLoading || loansQuery.isLoading ? (
          <div className="space-y-6">
            <CardGridSkeleton count={4} />
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Users}
                label="Registered Borrowers"
                value={isLoading ? "—" : String(data?.totalUsers ?? 0)}
              />
              <Metric
                icon={UserX}
                label="Suspended Profiles"
                value={isLoading ? "—" : String(data?.suspendedUsers ?? 0)}
              />
              <Metric
                icon={Building2}
                label="Business Identity"
                value={data?.settings?.business_name ?? "—"}
              />
              <Metric
                icon={Smartphone}
                label="M-Pesa Shortcode"
                value={data?.settings?.mpesa_shortcode ?? "—"}
              />
            </div>

            {/* Loan Approval Queue */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">Loan Queue & Approvals</CardTitle>
                  <CardDescription className="text-xs">
                    Approve requests once guarantors accept, then disburse via Safaricom B2C.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {loansQuery.data?.length ?? 0} Total Requests
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleQuickExportLoans}
                    disabled={isExportingLoans}
                    className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/50"
                  >
                    {isExportingLoans ? (
                      <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>Export Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {loansQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <LucideLoader
                      className="size-5 animate-spin text-primary"
                      aria-label="Loading"
                    />
                  </div>
                ) : (loansQuery.data?.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No active loan requests in queue.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Principal Amount</TableHead>
                        <TableHead>Guarantors Confirmed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Handled By (Agent)</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {}
                      {loansQuery.data?.map((loan: any) => {
                        const guarantorsList = loan.loan_guarantors ?? [];
                        const totalGuarantors = guarantorsList.length;
                        const accepted_gaurantors = guarantorsList.filter(
                          (g: any) => g.status === "accepted",
                        ).length;
                        const rejected_guarantors = guarantorsList.filter(
                          (g: any) => g.status === "rejected",
                        ).length;

                        const guarantorBadgeVariant =
                          rejected_guarantors > 0
                            ? "destructive"
                            : totalGuarantors > 0 && accepted_gaurantors >= totalGuarantors
                              ? "default"
                              : "gold";

                        return (
                          <TableRow key={loan.id}>
                            <TableCell className="font-medium">
                              {loan.borrower?.id ? (
                                <Link
                                  to="/admin/user/$userId"
                                  params={{ userId: loan.borrower.id }}
                                  className="font-semibold text-foreground hover:text-primary hover:underline"
                                >
                                  {`${loan.borrower?.first_name ?? ""} ${loan.borrower?.last_name ?? ""}`.trim() ||
                                    "Borrower Profile"}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>{loan.loan_products?.name ?? "—"}</TableCell>
                            <TableCell className="font-semibold">
                              {formatKes(Number(loan.principal))}
                            </TableCell>
                            <TableCell>
                              <Badge variant={guarantorBadgeVariant} className="text-xs">
                                {accepted_gaurantors}/{totalGuarantors}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                title={loan.status.replace(/_/g, " ")}
                                variant={
                                  loan.status === "active"
                                    ? "default"
                                    : loan.status.includes("pending")
                                      ? "gold"
                                      : loan.status === "rejected"
                                        ? "destructive"
                                        : loan.status === "defaulted"
                                          ? "gray"
                                          : "secondary"
                                }
                              >
                                {loan.status.replace(/_/g, " ").split(" ")[0]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {loan.approved_by_user ? (
                                <span className="font-medium text-foreground">
                                  {loan.approved_by_user.name}{" "}
                                  <span className="text-muted-foreground font-normal">
                                    ({loan.approved_by_user.role.replace(/_/g, " ")})
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                    >
                                      <Link to="/admin/loans/$loanId" params={{ loanId: loan.id }}>
                                        View Details
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Open complete loan review, guarantor status, and payout controls
                                  </TooltipContent>
                                </Tooltip>
                                {loan.status === "pending_approval" && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs"
                                          disabled={decideMutation.isPending}
                                          onClick={() =>
                                            decideMutation.mutate({
                                              loanId: loan.id,
                                              approve: true,
                                            })
                                          }
                                        >
                                          <Check className="size-3.5 mr-1" /> Approve
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Approve this loan application so it moves to approved state
                                        for disbursement
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs text-destructive"
                                          disabled={decideMutation.isPending}
                                          onClick={() => setRejectLoanId(loan.id)}
                                        >
                                          <X className="size-3.5 mr-1" /> Reject
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Reject this loan application and notify the borrower
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                                {loan.status === "approved" &&
                                  !loan.is_daraja_configured &&
                                  currentProfile?.id !== loan.borrower.id && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="gold"
                                          className="h-7 text-xs"
                                          disabled={
                                            disburseMutation.isPending ||
                                            Boolean(loan.is_daraja_configured) ||
                                            currentProfile?.id === loan.borrower.id
                                          }
                                          onClick={() => disburseMutation.mutate(loan.id)}
                                        >
                                          <Send className="size-3.5 mr-1" /> Disburse
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Disburse funds via M-Pesa B2C payout and activate the loan
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Newest Borrowers Table */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Newest Borrowers</CardTitle>
                <CardDescription className="text-xs">
                  Latest registered accounts on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LucideLoader
                      className="size-5 animate-spin text-primary"
                      aria-label="Loading"
                    />
                  </div>
                ) : (data?.recentUsers.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No borrowers registered yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Credit Score</TableHead>
                        <TableHead>Loan Limit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {}
                      {data?.recentUsers.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {`${user.first_name} ${user.last_name}`.trim() || "—"}
                          </TableCell>
                          <TableCell>{user.phone ?? "—"}</TableCell>
                          <TableCell>{user.credibility_score} pts</TableCell>
                          <TableCell className="font-semibold">
                            {formatKes(Number(user.loan_limit))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.status === "active"
                                  ? "default"
                                  : user.status === "suspended"
                                    ? "gold"
                                    : "destructive"
                              }
                            >
                              {user.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <AlertDialog
        open={Boolean(rejectLoanId)}
        onOpenChange={(open) => !open && setRejectLoanId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Confirm Loan Request Rejection
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this loan request? The applicant will be notified
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={decideMutation.isPending}
              onClick={() => {
                if (rejectLoanId) {
                  decideMutation.mutate({ loanId: rejectLoanId, approve: false });
                  setRejectLoanId(null);
                }
              }}
            >
              {decideMutation.isPending ? (
                <LucideLoader className="size-4 animate-spin mr-1" />
              ) : null}
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-5">
        <Icon className="size-5 text-primary" aria-hidden />
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-display text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
