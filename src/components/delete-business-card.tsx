import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Trash2, Download, ShieldAlert, LucideLoader } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import { deleteBusinessFn } from "@/lib/admin.functions";
import { getExportDataset } from "@/lib/export.functions";
import { downloadMultiSheetExcel } from "@/lib/excel-export";
import { toast } from "sonner";

export function DeleteBusinessCard() {
  const { roles, isInitialAdmin, signOut } = useAuth();
  const { businessName } = useAppConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isSuperAdmin = roles.includes("super_admin") || isInitialAdmin;

  const [isOpen, setIsOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState<"export_and_delete" | "delete_only">(
    "export_and_delete",
  );
  const [confirmText, setConfirmText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const deleteServerFn = useServerFn(deleteBusinessFn);
  const getExportFn = useServerFn(getExportDataset);

  const cleanBusinessName = (businessName || "Business").trim();
  const isConfirmValid =
    confirmText.trim().toLowerCase() === "delete" ||
    confirmText.trim().toLowerCase() === cleanBusinessName.toLowerCase() ||
    confirmText.trim().toLowerCase() === `delete ${cleanBusinessName.toLowerCase()}`;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (deleteOption === "export_and_delete") {
        setStatusMessage("Fetching and preparing complete Excel backup...");
        const res = await getExportFn({
          data: { dataset: "all" },
        });

        const todayStr = new Date().toISOString().split("T")[0];
        const sheets = [
          { sheetName: "Loans & Applications", data: res.loans || [] },
          { sheetName: "User & Borrower Profiles", data: res.users || [] },
          { sheetName: "Loan Repayments", data: res.repayments || [] },
          { sheetName: "M-Pesa Transactions", data: (res as any).mpesaTransactions || [] },
          { sheetName: "Guarantors", data: res.guarantors || [] },
          { sheetName: "System Audit Logs", data: res.auditLogs || [] },
          { sheetName: "Loan Products", data: (res as any).products || [] },
        ];

        try {
          downloadMultiSheetExcel(
            sheets,
            `${cleanBusinessName}_Final_Backup_Before_Delete_${todayStr}`,
          );
          toast.success("Excel backup downloaded to your computer.");
        } catch {
          // If all tables are completely empty, continue to deletion
        }
      }

      setStatusMessage("Permanently wiping database and resetting system...");
      const result = await deleteServerFn({
        data: { confirmPhrase: confirmText },
      });

      return result;
    },
    onSuccess: async (data) => {
      toast.success(data.message || "Business deleted and platform reset successfully.");
      setIsOpen(false);

      // Wipe local storage keys and auth state
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("mikopo_auth_token");
        localStorage.removeItem("mikopo_cached_identity");
        localStorage.removeItem("mikopo_offline_manifest");
      }
      if (typeof document !== "undefined") {
        document.cookie = "mikopo_auth_token=; path=/; max-age=0";
      }

      // Reset Query Cache
      queryClient.clear();

      try {
        await signOut();
      } catch {
        // Ignore signout errors if db is already empty
      }

      // Redirect to fresh setup onboarding wizard
      void navigate({ to: "/setup", replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete business. Please verify confirmation text.");
      setStatusMessage("");
    },
  });

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <>
      <Card
        id="delete-business-card"
        className="border-destructive/40 bg-destructive/5 shadow-soft"
      >
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                  <span>Danger Zone: Delete Business</span>
                  <Badge variant="destructive" className="text-[10px] uppercase font-mono">
                    Super Admin
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5 text-muted-foreground">
                  Permanently erase this business organization and purge all records from the
                  database.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Deleting the business is a destructive, irreversible action. It will permanently drop
            and purge all borrower profiles, staff accounts, loan requests, active portfolios,
            M-Pesa transaction histories, and business settings from the database. The system will
            be restored to the fresh setup wizard state.
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge
              variant="outline"
              className="text-destructive border-destructive/30 bg-destructive/10"
            >
              Complete Database Wipe
            </Badge>
            <Badge variant="outline" className="border-border">
              Excel Data Export Option Available
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="p-6 pt-2 border-t border-destructive/20 bg-destructive/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Requires confirmation and super admin authority.
          </span>
          <Button
            id="open-delete-business-dialog-btn"
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirmText("");
              setStatusMessage("");
              setIsOpen(true);
            }}
            className="gap-2 font-semibold shadow-xs hover:bg-destructive/90 self-start sm:self-auto"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Business...</span>
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Side Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !deleteMutation.isPending && setIsOpen(open)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col justify-between p-0 gap-0 border-l border-border bg-background"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border/80 bg-muted/20">
            <SheetHeader className="text-left space-y-1.5">
              <div className="flex items-center gap-2 text-destructive">
                <div className="p-2 rounded-lg bg-destructive/15">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <SheetTitle className="text-lg font-bold text-destructive">
                  Delete Business & Wipe Database
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
                You are about to permanently delete{" "}
                <strong className="text-foreground">{cleanBusinessName}</strong> and purge all
                system records from the database.
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <Alert
              variant="destructive"
              className="py-3 px-3.5 border-destructive/30 bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">
                Warning: This action cannot be undone
              </AlertTitle>
              <AlertDescription className="text-[11px] mt-0.5 leading-relaxed">
                All borrowers, loans, repayments, M-Pesa records, audit logs, and settings will be
                permanently erased. The platform will reset back to the initial setup wizard.
              </AlertDescription>
            </Alert>

            {/* Step 1: Select Option */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-foreground">
                1. Select Deletion & Backup Option:
              </Label>
              <RadioGroup
                value={deleteOption}
                onValueChange={(val: "export_and_delete" | "delete_only") => setDeleteOption(val)}
                className="space-y-2.5"
                disabled={deleteMutation.isPending}
              >
                {/* Option 1 */}
                <div
                  onClick={() => !deleteMutation.isPending && setDeleteOption("export_and_delete")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    deleteOption === "export_and_delete"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem
                    value="export_and_delete"
                    id="opt-export-and-delete"
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="opt-export-and-delete"
                        className="text-xs font-semibold cursor-pointer"
                      >
                        Export data and delete business
                      </Label>
                      <Badge className="text-[10px] bg-primary/20 text-primary hover:bg-primary/20 border-primary/30">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Generates and downloads a complete multi-sheet Excel spreadsheet (.xlsx) with
                      all platform data before permanently wiping the database.
                    </p>
                  </div>
                </div>

                {/* Option 2 */}
                <div
                  onClick={() => !deleteMutation.isPending && setDeleteOption("delete_only")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    deleteOption === "delete_only"
                      ? "border-destructive bg-destructive/5 ring-1 ring-destructive/40 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="delete_only" id="opt-delete-only" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="opt-delete-only"
                      className="text-xs font-semibold cursor-pointer text-destructive"
                    >
                      Delete business (without exporting the data as excel)
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Directly and immediately wipes all database records without creating or
                      downloading any Excel backup.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Step 2: Confirmation input */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <Label
                htmlFor="confirm-delete-input"
                className="text-xs font-semibold text-foreground"
              >
                2. Confirmation Check:
              </Label>
              <p className="text-[11px] text-muted-foreground">
                To confirm deletion, type{" "}
                <span className="font-semibold text-foreground select-all font-mono">
                  {cleanBusinessName}
                </span>{" "}
                or{" "}
                <span className="font-semibold text-foreground select-all font-mono">DELETE</span>{" "}
                below:
              </p>
              <Input
                id="confirm-delete-input"
                placeholder={`Type "${cleanBusinessName}" or "DELETE"`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleteMutation.isPending}
                className="h-10 text-xs"
                autoComplete="off"
              />
            </div>

            {statusMessage && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted text-xs text-foreground animate-pulse">
                <LucideLoader className="h-4 w-4 animate-spin text-primary shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border/80 bg-muted/10">
            <SheetFooter className="gap-2 sm:gap-2 flex flex-col-reverse sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={deleteMutation.isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                id="confirm-delete-business-btn"
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={!isConfirmValid || deleteMutation.isPending}
                className="gap-2 text-xs font-semibold shadow-xs"
              >
                {deleteMutation.isPending ? (
                  <>
                    <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Deletion...</span>
                  </>
                ) : deleteOption === "export_and_delete" ? (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Data & Delete Business</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Business (No Export)</span>
                  </>
                )}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
