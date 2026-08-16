import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Gavel,
  Lock,
  Unlock,
  ShieldCheck,
  Zap,
  Mail,
  Key,
  AlertTriangle,
  CheckCircle2,
  LucideLoader,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminRules, saveAdminRules } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";

export function RulesManagement() {
  const queryClient = useQueryClient();
  const { isInitialAdmin } = useAuth();
  const { updateConfigOptimistic, notifyConfigChanged } = useAppConfig();

  const getRulesFn = useServerFn(getAdminRules);
  const saveRulesFn = useServerFn(saveAdminRules);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-rules"],
    queryFn: () => getRulesFn(),
  });

  // Local form state
  const [formState, setFormState] = useState({
    allowActivationWithoutDisbursement: false,
    enable2faByEmail: false,
    lockDarajaConfig: false,
    lockSmtpConfig: false,
    lockLandingEditMode: false,
    maxActiveLoansPerBorrower: 1,
    requireGuarantorsForLoans: true,
    autoRejectIfDefaulted: true,
  });

  // Synchronize initial state when query data loads
  const [initialized, setInitialized] = useState(false);
  if (data && !initialized) {
    setFormState({
      allowActivationWithoutDisbursement: data.allowActivationWithoutDisbursement,
      enable2faByEmail: data.enable2faByEmail,
      lockDarajaConfig: data.lockDarajaConfig,
      lockSmtpConfig: data.lockSmtpConfig,
      lockLandingEditMode: data.lockLandingEditMode,
      maxActiveLoansPerBorrower: data.maxActiveLoansPerBorrower,
      requireGuarantorsForLoans: data.requireGuarantorsForLoans,
      autoRejectIfDefaulted: data.autoRejectIfDefaulted,
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: typeof formState) => saveRulesFn({ data: payload }),
    onSuccess: (res, variables) => {
      setIsAutoSaving(false);
      setLastAutoSavedAt(new Date());
      setMessage({ type: "success", text: res.message || "App rules saved & applied live!" });
      notifyConfigChanged(variables);
      void queryClient.invalidateQueries({ queryKey: ["admin-rules"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      void queryClient.invalidateQueries({ queryKey: ["daraja-credentials"] });
      void queryClient.invalidateQueries({ queryKey: ["daraja-env"] });
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
      void queryClient.invalidateQueries({ queryKey: ["my-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-smtp-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["2fa-security-settings"] });
    },
    onError: (err: Error) => {
      setIsAutoSaving(false);
      setMessage({ type: "error", text: err.message || "Failed to save app rules." });
      toast.error(err.message || "Failed to save rule change.");
    },
  });

  const handleToggle = (key: keyof typeof formState, val: boolean) => {
    const updated = { ...formState, [key]: val };
    setFormState(updated);
    updateConfigOptimistic(updated);
    setMessage(null);
    setIsAutoSaving(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveMutation.mutate(updated);
  };

  const handleNumberChange = (key: keyof typeof formState, val: number) => {
    const updated = { ...formState, [key]: val };
    setFormState(updated);
    updateConfigOptimistic(updated);
    setMessage(null);
    setIsAutoSaving(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveMutation.mutate(updated);
    }, 600);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center gap-3">
          <LucideLoader className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">
            Loading system rules and operational policies...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              <span>System Rules & Safety Guardrails</span>
              {isInitialAdmin ? (
                <Badge variant="secondary" className="text-xs">
                  Initial Admin Console
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Super Admin / Staff
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configure system-wide operational policies, loan activation procedures, security
              lockouts for credentials, and user two-factor authentication rules.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              onClick={() => {
                refetch();
                setInitialized(false);
              }}
              variant="outline"
              size="sm"
              disabled={isRefetching}
              className="gap-1.5 text-xs"
            >
              <LucideLoader className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={
            message.type === "success"
              ? "border-emerald-500/50 bg-emerald-50/50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300"
              : ""
          }
        >
          {message.type === "error" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <AlertTitle>{message.type === "error" ? "Error" : "Rules Updated"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Rules Quick Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>Direct Loan Activation</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-sm font-bold">
              {formState.allowActivationWithoutDisbursement ? "Allowed" : "Disbursement Required"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {formState.allowActivationWithoutDisbursement
              ? "Activation button visible on approved loan queue"
              : "Loans require Daraja B2C cash payout"}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-soft">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>Email 2FA Status</span>
              <Mail className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-sm font-bold">
              {formState.enable2faByEmail ? "Enabled for Users" : "Disabled"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {!data?.smtpConfigured ? (
              <span className="text-gold font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Requires SMTP Setup
              </span>
            ) : formState.enable2faByEmail ? (
              "Users can activate Email 2FA under Account Security"
            ) : (
              "2FA option hidden on user security tab"
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-soft">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>Config Security Lock</span>
              <Lock className="h-4 w-4 text-purple-500" />
            </CardDescription>
            <CardTitle className="text-sm font-bold">
              {formState.lockDarajaConfig && formState.lockSmtpConfig
                ? "Fully Locked"
                : formState.lockDarajaConfig || formState.lockSmtpConfig
                  ? "Partially Locked"
                  : "Unlocked"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {formState.lockDarajaConfig && formState.lockSmtpConfig
              ? "Daraja & SMTP settings protected from modifications"
              : "Config settings editable in admin settings console"}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="loan-rules" className="w-full">
        <TabsList className="grid w-full grid-cols-2 text-xs h-fit">
          <TabsTrigger value="loan-rules" className="py-2.5 gap-2 text-xs font-medium">
            <Gavel className="h-3.5 w-3.5" />
            <span>1. Loan & Disbursement Rules</span>
          </TabsTrigger>
          <TabsTrigger value="security-rules" className="py-2.5 gap-2 text-xs font-medium">
            <Key className="h-3.5 w-3.5" />
            <span>2. Security & Lockout Rules</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LOAN RULES */}
        <TabsContent value="loan-rules" className="space-y-4 pt-4">
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                Loan Activation & Disbursement Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Define operational conditions for approving, activating, and disbursing loans across
                the lending platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rule 1: Allow Activation Without Disbursement */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="allowActivationWithoutDisbursement"
                      className="font-semibold text-sm cursor-pointer"
                    >
                      Allow Loan Activation Without Disbursement
                    </Label>
                    {formState.allowActivationWithoutDisbursement ? (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, shows an{" "}
                    <strong className="text-foreground">"Activate Loan (Direct)"</strong> button on
                    approved loan detail pages in the admin console. Allows staff to activate loan
                    contracts directly (e.g. cash over the counter or offline disbursements) without
                    invoking automated M-Pesa B2C payouts.
                  </p>
                </div>
                <Switch
                  id="allowActivationWithoutDisbursement"
                  checked={formState.allowActivationWithoutDisbursement}
                  onCheckedChange={(val) => handleToggle("allowActivationWithoutDisbursement", val)}
                />
              </div>

              {/* Rule 2: Require Guarantor Approvals */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="requireGuarantorsForLoans"
                      className="font-semibold text-sm cursor-pointer"
                    >
                      Enforce Mandatory Guarantor Approvals
                    </Label>
                    {formState.requireGuarantorsForLoans ? (
                      <Badge variant="default" className="text-xs">
                        Enforced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Bypassed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires all designated guarantors on a loan request to accept their guarantor
                    request before the loan can progress to admin approval or disbursement.
                  </p>
                </div>
                <Switch
                  id="requireGuarantorsForLoans"
                  checked={formState.requireGuarantorsForLoans}
                  onCheckedChange={(val) => handleToggle("requireGuarantorsForLoans", val)}
                />
              </div>

              {/* Rule 5: Auto-Reject Defaulted Borrowers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="autoRejectIfDefaulted"
                      className="font-semibold text-sm cursor-pointer"
                    >
                      Auto-Block New Loans for Defaulted Borrowers
                    </Label>
                    {formState.autoRejectIfDefaulted ? (
                      <Badge variant="default" className="text-xs">
                        Strict Protection
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Off
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically blocks borrowers with active defaulted loans from submitting new
                    loan applications until past defaults are fully cleared.
                  </p>
                </div>
                <Switch
                  id="autoRejectIfDefaulted"
                  checked={formState.autoRejectIfDefaulted}
                  onCheckedChange={(val) => handleToggle("autoRejectIfDefaulted", val)}
                />
              </div>

              {/* Rule 6: Max Active Loans per Borrower */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <Label htmlFor="maxActiveLoansPerBorrower" className="font-semibold text-sm">
                    Maximum Active Concurrent Loans Per Borrower
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Limits how many active open loan contracts a single borrower profile can
                    maintain simultaneously.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxActiveLoansPerBorrower"
                    type="number"
                    min={1}
                    max={10}
                    className="w-24 text-center font-bold text-sm"
                    value={formState.maxActiveLoansPerBorrower}
                    onChange={(e) =>
                      handleNumberChange("maxActiveLoansPerBorrower", parseInt(e.target.value) || 1)
                    }
                  />
                  <span className="text-xs text-muted-foreground font-medium">Loan(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SECURITY RULES */}
        <TabsContent value="security-rules" className="space-y-4 pt-4">
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                Security, Authentication & Configuration Lockouts
              </CardTitle>
              <CardDescription className="text-xs">
                Manage two-factor authentication options and lock down critical API and SMTP
                credentials to prevent unauthorized edits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Security Rule 1: Enable 2FA by Email */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable2faByEmail"
                      className="font-semibold text-sm cursor-pointer"
                    >
                      Allow Users to Enable 2FA via Email
                    </Label>
                    {formState.enable2faByEmail ? (
                      <Badge className="bg-success text-success-foreground text-xs">
                        Option Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled (and SMTP is configured), users will see an "Enable Email
                    Two-Factor Authentication (2FA)" option on their Account Security tab to protect
                    their accounts with 6-digit email codes.
                  </p>
                  {!data?.smtpConfigured && (
                    <div className="flex items-center gap-1.5 text-xs text-warning pt-1 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>
                        SMTP is not configured yet. Configure SMTP settings in Admin Settings for
                        email 2FA to deliver codes.
                      </span>
                    </div>
                  )}
                </div>
                <Switch
                  id="enable2faByEmail"
                  checked={formState.enable2faByEmail}
                  onCheckedChange={(val) => handleToggle("enable2faByEmail", val)}
                />
              </div>

              {/* Security Rule 2: Lock Daraja Credentials */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="lockDarajaConfig"
                      className="font-semibold text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      {formState.lockDarajaConfig ? (
                        <Lock className="h-4 w-4 text-warning" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      Lock Daraja M-Pesa Credentials
                    </Label>
                    {formState.lockDarajaConfig ? (
                      <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Unlocked
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prevents staff and admin users from modifying Daraja M-Pesa credentials
                    (Consumer Key, Consumer Secret, Passkey) on the Admin Settings page. Must be
                    unlocked here in Admin Rules to make changes.
                  </p>
                </div>
                <Switch
                  id="lockDarajaConfig"
                  checked={formState.lockDarajaConfig}
                  onCheckedChange={(val) => handleToggle("lockDarajaConfig", val)}
                />
              </div>

              {/* Security Rule 3: Lock SMTP Settings */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="lockSmtpConfig"
                      className="font-semibold text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      {formState.lockSmtpConfig ? (
                        <Lock className="h-4 w-4 text-warning" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      Lock SMTP Email Configuration
                    </Label>
                    {formState.lockSmtpConfig ? (
                      <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Unlocked
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Locks down SMTP host, port, credentials, and sender email settings from
                    accidental edits or overwrites in the Admin Email settings form.
                  </p>
                </div>
                <Switch
                  id="lockSmtpConfig"
                  checked={formState.lockSmtpConfig}
                  onCheckedChange={(val) => handleToggle("lockSmtpConfig", val)}
                />
              </div>

              {/* Security Rule 4: Lock Landing Page Edit Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="lockLandingEditMode"
                      className="font-semibold text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      {formState.lockLandingEditMode ? (
                        <Lock className="h-4 w-4 text-warning" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      Lock Landing Page Visual Edit Mode
                    </Label>
                    {formState.lockLandingEditMode ? (
                      <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    ) : (
                      <Badge className="bg-success text-success-foreground flex items-center gap-1 text-xs">
                        <Unlock className="h-3 w-3" /> Edit Mode Enabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled (locked), inline double-click editing on the landing page is
                    locked. Admins visiting the landing page will see the Admin UI / operations hub
                    page. When disabled (unlocked), admins can directly double-click and edit
                    landing text.
                  </p>
                </div>
                <Switch
                  id="lockLandingEditMode"
                  checked={formState.lockLandingEditMode}
                  onCheckedChange={(val) => handleToggle("lockLandingEditMode", val)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
