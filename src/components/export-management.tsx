import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileSpreadsheet,
  Download,
  Database,
  Users,
  CreditCard,
  CheckCircle2,
  LucideLoader,
  UserCheck,
  History,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getExportDataset, getExportCounts } from "@/lib/export.functions";
import { downloadExcelFromData, downloadMultiSheetExcel } from "@/lib/excel-export";
import { toast } from "sonner";

export function ExportManagement({ businessName }: { businessName: string }) {
  const getDatasetFn = useServerFn(getExportDataset);
  const getCountsFn = useServerFn(getExportCounts);

  const [loanStatusFilter, setLoanStatusFilter] = useState("all");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [activeExportingKey, setActiveExportingKey] = useState<string | null>(null);

  const { data: counts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ["admin-export-counts"],
    queryFn: () => getCountsFn(),
  });

  const loansCount = counts?.loans ?? 0;
  const usersCount = counts?.users ?? 0;
  const repaymentsCount = counts?.repayments ?? 0;
  const guarantorsCount = counts?.guarantors ?? 0;
  const auditLogsCount = counts?.auditLogs ?? 0;
  const totalCount = counts?.total ?? 0;

  // Mutation to fetch and trigger download
  const exportMutation = useMutation({
    mutationFn: async ({
      dataset,
      statusFilter,
      roleFilter,
      exportName,
    }: {
      dataset: "loans" | "users" | "repayments" | "guarantors" | "audit_logs" | "all";
      statusFilter?: string;
      roleFilter?: string;
      exportName: string;
    }) => {
      setActiveExportingKey(dataset);
      const res = await getDatasetFn({
        data: { dataset, statusFilter, roleFilter },
      });

      const todayStr = new Date().toISOString().split("T")[0];

      if (dataset === "loans") {
        if (!res.loans || res.loans.length === 0) {
          throw new Error("No loan records match the selected filter.");
        }
        downloadExcelFromData(res.loans, {
          fileName: `${businessName}_Loans_Export_${statusFilter || "all"}_${todayStr}`,
          sheetName: "Loans & Applications",
        });
        toast.success(`Exported ${res.loans.length} loan records to Excel!`);
      } else if (dataset === "users") {
        if (!res.users || res.users.length === 0) {
          throw new Error("No user records match the selected filter.");
        }
        downloadExcelFromData(res.users, {
          fileName: `${businessName}_Users_Export_${roleFilter || "all"}_${todayStr}`,
          sheetName: "User & Borrower Profiles",
        });
        toast.success(`Exported ${res.users.length} user profiles to Excel!`);
      } else if (dataset === "repayments") {
        const reps = res.repayments || [];
        const mpesa = (res as any).mpesaTransactions || [];
        if (reps.length === 0 && mpesa.length === 0) {
          throw new Error("No transaction records available to export.");
        }

        downloadMultiSheetExcel(
          [
            { sheetName: "Loan Repayments", data: reps },
            { sheetName: "M-Pesa Transactions", data: mpesa },
          ],
          `${businessName}_Repayments_Transactions_${todayStr}`,
        );
        toast.success(`Exported ${reps.length} repayments & ${mpesa.length} M-Pesa transactions!`);
      } else if (dataset === "guarantors") {
        if (!res.guarantors || res.guarantors.length === 0) {
          throw new Error("No guarantor records found.");
        }
        downloadExcelFromData(res.guarantors, {
          fileName: `${businessName}_Guarantors_Export_${todayStr}`,
          sheetName: "Guarantors & Guarantees",
        });
        toast.success(`Exported ${res.guarantors.length} guarantor records!`);
      } else if (dataset === "audit_logs") {
        if (!res.auditLogs || res.auditLogs.length === 0) {
          throw new Error("No audit logs found.");
        }
        downloadExcelFromData(res.auditLogs, {
          fileName: `${businessName}_Audit_Logs_Export_${todayStr}`,
          sheetName: "System Audit Trail",
        });
        toast.success(`Exported ${res.auditLogs.length} audit log entries!`);
      } else if (dataset === "all") {
        const sheets = [
          { sheetName: "Loans & Applications", data: res.loans || [] },
          { sheetName: "User Profiles", data: res.users || [] },
          { sheetName: "Loan Repayments", data: res.repayments || [] },
          { sheetName: "M-Pesa Transactions", data: (res as any).mpesaTransactions || [] },
          { sheetName: "Guarantors", data: res.guarantors || [] },
          { sheetName: "System Audit Logs", data: res.auditLogs || [] },
          { sheetName: "Loan Products", data: (res as any).products || [] },
        ];

        downloadMultiSheetExcel(sheets, `${businessName}_Master_Platform_Backup_${todayStr}`);
        toast.success("Master Multi-Sheet Excel Workbook exported successfully!");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate Excel export.");
    },
    onSettled: () => {
      setActiveExportingKey(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span>Data & Reports Export Console</span>
              <Badge
                variant="outline"
                className="text-xs text-primary border-primary/30 bg-primary/10"
              >
                Excel (.xlsx)
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Export structured lending datasets, loan portfolios, borrower accounts, M-Pesa
              transaction histories, and security audit logs in native Microsoft Excel (.xlsx)
              spreadsheet format.
            </CardDescription>
          </div>

          {!isLoadingCounts && totalCount > 0 && (
            <Button
              id="master-export-header-btn"
              onClick={() =>
                exportMutation.mutate({
                  dataset: "all",
                  exportName: "Master Backup",
                })
              }
              disabled={exportMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shrink-0 self-start md:self-auto shadow-xs"
            >
              {activeExportingKey === "all" ? (
                <LucideLoader className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary-foreground/80" />
              )}
              <span>
                {activeExportingKey === "all"
                  ? "Generating Master File..."
                  : "Export Full Master Backup (.xlsx)"}
              </span>
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. LOAN DATA EXPORT CARD */}
        <Card className="border-border/70 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[11px]">
                {isLoadingCounts ? "..." : `${loansCount} Records`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">Loan Portfolio & Queue</CardTitle>
            <CardDescription className="text-xs">
              Principal, interest fees, total due, borrower IDs, approval status, disbursal phones,
              due dates, and repayment balances.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Filter by Loan Status</Label>
              <Select value={loanStatusFilter} onValueChange={setLoanStatusFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses (Full Queue)</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved (Awaiting Disbursal)</SelectItem>
                  <SelectItem value="active">Active Open Loans</SelectItem>
                  <SelectItem value="repaid">Fully Repaid Loans</SelectItem>
                  <SelectItem value="defaulted">Defaulted Loans</SelectItem>
                  <SelectItem value="rejected">Rejected Applications</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">Format: .xlsx</span>
            {loansCount > 0 ? (
              <Button
                id="export-loans-dataset-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "loans",
                    statusFilter: loanStatusFilter,
                    exportName: "Loans",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {activeExportingKey === "loans" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "loans" ? "Exporting..." : "Export Loans Excel"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">No loan data to export</span>
            )}
          </CardFooter>
        </Card>

        {/* 2. USER & BORROWER PROFILES EXPORT CARD */}
        <Card className="border-border/70 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-accent/20 text-accent-foreground">
                <Users className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[11px]">
                {isLoadingCounts ? "..." : `${usersCount} Profiles`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">Users & Borrower Profiles</CardTitle>
            <CardDescription className="text-xs">
              Borrower contact info, National IDs, verification statuses, credibility scores,
              referral codes, active loan counts, and total borrowed values.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Filter by Account Role</Label>
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Users & Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users & Staff</SelectItem>
                  <SelectItem value="user">Borrowers Only</SelectItem>
                  <SelectItem value="staff">Staff Agents</SelectItem>
                  <SelectItem value="super_admin">Super Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">Format: .xlsx</span>
            {usersCount > 0 ? (
              <Button
                id="export-users-dataset-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "users",
                    roleFilter: userRoleFilter,
                    exportName: "Users",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {activeExportingKey === "users" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "users" ? "Exporting..." : "Export Users Excel"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">No user data to export</span>
            )}
          </CardFooter>
        </Card>

        {/* 3. REPAYMENTS & TRANSACTIONS EXPORT CARD */}
        <Card className="border-border/70 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-secondary text-secondary-foreground">
                <Database className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[11px]">
                {isLoadingCounts ? "..." : `${repaymentsCount} Records`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">Repayments & M-Pesa Log</CardTitle>
            <CardDescription className="text-xs">
              Completed loan repayments, M-Pesa receipt references, STK push collections, B2C
              disbursement payouts, and transaction callback statuses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <div className="p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground">Multi-Sheet Export:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Sheet 1: Direct Loan Repayments</li>
                <li>Sheet 2: M-Pesa C2B & B2C API Transactions</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">
              Format: .xlsx (2 Sheets)
            </span>
            {repaymentsCount > 0 ? (
              <Button
                id="export-repayments-dataset-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "repayments",
                    exportName: "Repayments",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {activeExportingKey === "repayments" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "repayments" ? "Exporting..." : "Export Repayments Excel"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No transaction data to export
              </span>
            )}
          </CardFooter>
        </Card>

        {/* 4. GUARANTORS EXPORT CARD */}
        <Card className="border-border/70 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-accent/20 text-accent-foreground">
                <UserCheck className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[11px]">
                {isLoadingCounts ? "..." : `${guarantorsCount} Records`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">Guarantors & Guarantees</CardTitle>
            <CardDescription className="text-xs">
              Designated loan guarantors, contact details, national IDs, relationships to borrowers,
              request timestamps, and acceptance/rejection statuses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <div className="p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
              Contains complete loan guarantee links and response history across all loan requests.
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">Format: .xlsx</span>
            {guarantorsCount > 0 ? (
              <Button
                id="export-guarantors-dataset-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "guarantors",
                    exportName: "Guarantors",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {activeExportingKey === "guarantors" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "guarantors" ? "Exporting..." : "Export Guarantors Excel"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No guarantor data to export
              </span>
            )}
          </CardFooter>
        </Card>

        {/* 5. AUDIT LOGS EXPORT CARD */}
        <Card className="border-border/70 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-gold/15 text-gold-foreground dark:text-gold">
                <History className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[11px]">
                {isLoadingCounts ? "..." : `${auditLogsCount} Entries`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">System Audit Trail</CardTitle>
            <CardDescription className="text-xs">
              Staff actions, admin system setting overrides, loan approval logs, user status
              changes, and timestamped system event details.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <div className="p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
              Exports up to 1,000 recent system audit log events with actor IDs and action metadata.
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">Format: .xlsx</span>
            {auditLogsCount > 0 ? (
              <Button
                id="export-audit-logs-dataset-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "audit_logs",
                    exportName: "Audit Logs",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {activeExportingKey === "audit_logs" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "audit_logs" ? "Exporting..." : "Export Audit Logs"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No audit log data to export
              </span>
            )}
          </CardFooter>
        </Card>

        {/* 6. MASTER FULL BACKUP EXPORT CARD */}
        <Card className="border-primary/30 bg-primary/5 shadow-soft flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-xs">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <Badge className="bg-primary text-primary-foreground text-[11px]">
                {isLoadingCounts ? "..." : `${totalCount} Total Items`}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold mt-3">
              Master Platform Backup (.xlsx)
            </CardTitle>
            <CardDescription className="text-xs">
              Generates a single comprehensive Excel workbook file containing dedicated tabs for
              Loans, Users, Repayments, M-Pesa Transactions, Guarantors, Audit Logs, and Loan
              Products.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/10 text-xs text-foreground space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Complete Data Snapshot</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ideal for monthly financial reporting, compliance audits, and offline data backups.
              </p>
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t border-primary/20 bg-primary/5 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">
              Multi-Sheet Workbook
            </span>
            {totalCount > 0 ? (
              <Button
                id="export-master-backup-btn"
                size="sm"
                onClick={() =>
                  exportMutation.mutate({
                    dataset: "all",
                    exportName: "Master Backup",
                  })
                }
                disabled={exportMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                {activeExportingKey === "all" ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {activeExportingKey === "all" ? "Exporting..." : "Download Master Excel"}
                </span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No platform data to export
              </span>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
