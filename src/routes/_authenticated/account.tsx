import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  User,
  Phone,
  Lock,
  LucideLoader,
  Mail,
  Key,
  Smartphone,
  Laptop,
  Globe,
  Trash2,
  Send,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  Save,
  Crown,
  AlertTriangle,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  X,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  updateAuthProfile,
  changePassword,
  getUserSessions,
  revokeUserSession,
  revokeAllOtherSessions,
  submitPhoneChangeRequest,
  getUserPhoneChangeRequests,
  deleteMyAccount,
  listTransferableAgents,
  transferAdminRole,
  get2faSecuritySettings,
  send2faCode,
  verifyAndToggle2fa,
  getPublicBusinessConfig,
} from "@/lib/account.functions";
import { useAppConfig } from "@/lib/config-context";
import { useUrlBooleanState } from "@/lib/use-url-search-state";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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
import BackButton from "@/components/back-button";

export type AccountTab = "profile" | "password" | "sessions" | "phone";

export function normalizeAccountTab(rawTab?: string): AccountTab {
  if (!rawTab) return "profile";
  const lower = rawTab.toLowerCase().trim();
  if (
    lower === "security" ||
    lower === "password" ||
    lower === "pass" ||
    lower === "2fa" ||
    lower === "credentials"
  ) {
    return "password";
  }
  if (lower === "sessions" || lower === "devices" || lower === "active-sessions") {
    return "sessions";
  }
  if (lower === "phone" || lower === "phone-change" || lower === "contact") {
    return "phone";
  }
  if (lower === "profile" || lower === "personal" || lower === "info") {
    return "profile";
  }
  return "profile";
}

const accountSearchSchema = z
  .object({
    tab: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: accountSearchSchema,
  loader: async () => {
    return getPublicBusinessConfig();
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    return {
      meta: [
        { title: `Account & Security Settings — ${businessName}` },
        {
          name: "description",
          content:
            "Manage your personal profile details, change security credentials, view active device sessions, and request phone updates.",
        },
      ],
    };
  },
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { tab: urlTab } = Route.useSearch();
  const navigate = useNavigate();
  const { profile, token, refresh, isInitialAdmin, isAdmin, roles, signOut } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const { businessName } = useAppConfig();
  const activeBusinessName = businessName || "the platform";

  const activeTab = useMemo(() => normalizeAccountTab(urlTab), [urlTab]);

  const handleTabChange = (nextVal: string) => {
    const normalized = normalizeAccountTab(nextVal);
    void navigate({
      to: "/account",
      search: (prev) => ({ ...prev, tab: normalized }),
      replace: true,
    });
  };

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Transfer Role State
  const [transferableAgents, setTransferableAgents] = useState<
    Array<{ id: string; name: string; email: string; phone: string | null }>
  >([]);
  const [selectedTargetAgentId, setSelectedTargetAgentId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useUrlBooleanState("confirmTransferAdmin");

  // Account Deletion State
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useUrlBooleanState("confirmDeleteAccount");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      deviceInfo: string;
      ipAddress: string;
      userAgent: string;
      lastActiveAt: string;
      createdAt: string;
    }>
  >([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Two-Factor Authentication State
  const [twoFactorSettings, setTwoFactorSettings] = useState<{
    enabled: boolean;
    is2faByEmailAllowed: boolean;
    smtpConfigured: boolean;
    is2faEnabled: boolean;
    userEmail: string;
  } | null>(null);
  const [_twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSendingCode, setTwoFactorSendingCode] = useState(false);
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState("");
  const [enable2faDialogOpen, setEnable2faDialogOpen] = useUrlBooleanState("enable2fa");
  const [disable2faDialogOpen, setDisable2faDialogOpen] = useUrlBooleanState("disable2fa");
  const [twoFactorResendCooldown, setTwoFactorResendCooldown] = useState(0);

  useEffect(() => {
    if (twoFactorResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setTwoFactorResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [twoFactorResendCooldown]);

  // Password Strength & Criteria Analysis
  const passwordCriteria = useMemo(() => {
    const minLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const notCurrent = currentPassword ? newPassword !== currentPassword : true;
    const matchesConfirm = confirmPassword ? newPassword === confirmPassword : false;

    let score = 0;
    if (minLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    let label = "Weak";
    let color = "bg-rose-500";
    let text = "text-rose-600 dark:text-rose-400";

    if (score >= 5) {
      label = "Strong";
      color = "bg-emerald-500";
      text = "text-emerald-600 dark:text-emerald-400";
    } else if (score >= 4) {
      label = "Good";
      color = "bg-sky-500";
      text = "text-sky-600 dark:text-sky-400";
    } else if (score >= 3) {
      label = "Fair";
      color = "bg-amber-500";
      text = "text-amber-600 dark:text-amber-400";
    }

    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      notCurrent,
      matchesConfirm,
      score,
      label,
      color,
      text,
    };
  }, [newPassword, currentPassword, confirmPassword]);

  const fetch2faSettings = useCallback(async () => {
    if (!token) return;
    setTwoFactorLoading(true);
    try {
      const res = await get2faSecuritySettings({
        headers: { authorization: `Bearer ${token}` },
      });
      setTwoFactorSettings({
        enabled: res.smtpConfigured,
        is2faByEmailAllowed: res.allow2faByEmail,
        smtpConfigured: res.smtpConfigured,
        is2faEnabled: res.is2faEnabled,
        userEmail: res.userEmail,
      });
    } catch (err) {
      console.error("Error loading 2FA settings:", err);
    } finally {
      setTwoFactorLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetch2faSettings();
  }, [fetch2faSettings]);

  const handleSend2faCode = async (_silentSuccess = false) => {
    if (!token) return;
    setTwoFactorSendingCode(true);
    try {
      const res = await send2faCode({
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTwoFactorResendCooldown(30);
      } else {
        toast.error(res.message || "Failed to send verification code.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending 2FA code.");
    } finally {
      setTwoFactorSendingCode(false);
    }
  };

  const handleOpenEnable2faDialog = () => {
    setTwoFactorCodeInput("");
    setEnable2faDialogOpen(true);
    void handleSend2faCode(false);
  };

  const handleVerifyAndToggle2fa = async (enable: boolean, explicitCode?: string) => {
    if (!token) return;
    const codeToVerify = (explicitCode ?? twoFactorCodeInput).trim();
    if (enable && codeToVerify.length < 6) {
      toast.error("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    setTwoFactorVerifying(true);
    try {
      const res = await verifyAndToggle2fa({
        data: { code: enable ? codeToVerify : "", enable },
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEnable2faDialogOpen(false);
        setDisable2faDialogOpen(false);
        setTwoFactorCodeInput("");
        void fetch2faSettings();
      } else {
        toast.error(res.message || "Failed to update 2FA configuration.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating 2FA settings.");
    } finally {
      setTwoFactorVerifying(false);
    }
  };

  // Phone Change Request State
  const [requestedPhone, setRequestedPhone] = useState("");
  const [phoneReason, setPhoneReason] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneRequests, setPhoneRequests] = useState<
    Array<{
      id: string;
      currentPhone: string;
      requestedPhone: string;
      reason: string;
      status: "pending" | "approved" | "rejected";
      rejectionReason?: string | null;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setIdNumber(profile.id_number || "");
    }
  }, [profile]);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const res = await getUserSessions({
        headers: { authorization: `Bearer ${token}` },
      });
      setSessions(res || []);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [token]);

  const fetchPhoneRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getUserPhoneChangeRequests({
        headers: { authorization: `Bearer ${token}` },
      });
      setPhoneRequests(res || []);
    } catch (err) {
      console.error("Error fetching phone requests:", err);
    }
  }, [token]);

  const fetchTransferableAgents = useCallback(async () => {
    if (!token || !isInitialAdmin) return;
    try {
      const res = await listTransferableAgents({
        headers: { authorization: `Bearer ${token}` },
      });
      setTransferableAgents(res || []);
    } catch (err) {
      console.error("Error fetching transferable agents:", err);
    }
  }, [token, isInitialAdmin]);

  useEffect(() => {
    if (token) {
      if (activeTab === "profile" && isInitialAdmin) {
        fetchTransferableAgents();
      } else if (activeTab === "sessions") {
        fetchSessions();
      } else if (activeTab === "phone") {
        fetchPhoneRequests();
      }
    }
  }, [
    activeTab,
    token,
    isInitialAdmin,
    fetchTransferableAgents,
    fetchSessions,
    fetchPhoneRequests,
  ]);

  async function handleTransferAdminRole() {
    if (!token || !selectedTargetAgentId) return;
    setTransferLoading(true);
    try {
      const res = await transferAdminRole({
        data: { targetUserId: selectedTargetAgentId },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to transfer role");
        return;
      }

      setShowTransferConfirm(false);
      setSelectedTargetAgentId("");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!token) return;
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm account deletion.");
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await deleteMyAccount({
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to delete account");
        return;
      }

      setShowDeleteConfirm(false);
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    if (!/^\d{6,10}$/.test(idNumber.trim())) {
      toast.error("ID number must be 6 to 10 digits");
      return;
    }

    setProfileLoading(true);
    try {
      const res = await updateAuthProfile({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          idNumber: idNumber.trim(),
        },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to update profile details");
        return;
      }

      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (
      !passwordCriteria.hasUpper ||
      !passwordCriteria.hasLower ||
      !passwordCriteria.hasNumber ||
      !passwordCriteria.hasSpecial
    ) {
      toast.error("Password must include uppercase, lowercase, numbers, and a special character.");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password cannot be identical to your current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePassword({
        data: { currentPassword, newPassword },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully! Other device sessions have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    if (!token) return;
    setRevokingId(sessionId);
    try {
      const res = await revokeUserSession({
        data: { sessionId },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to terminate session");
        return;
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to terminate session";
      toast.error(msg);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeAllOthers() {
    if (!token) return;
    setRevokingId("all");
    try {
      const res = await revokeAllOtherSessions({
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to terminate other sessions");
        return;
      }

      const resp: any = res;
      const count = resp?.count || 0;
      toast.success(
        count > 0
          ? `Terminated ${count} other active session${count > 1 ? "s" : ""}.`
          : "All other sessions have been terminated.",
      );
      fetchSessions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to terminate sessions";
      toast.error(msg);
    } finally {
      setRevokingId(null);
    }
  }

  async function handlePhoneRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!requestedPhone.trim()) {
      toast.error("Please enter a new phone number");
      return;
    }

    if (!phoneReason.trim()) {
      toast.error("Please provide a reason for the phone change");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await submitPhoneChangeRequest({
        data: {
          requestedPhone: requestedPhone.trim(),
          reason: phoneReason.trim(),
        },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to submit request");
        return;
      }

      toast.success("Phone change request submitted for administrative verification!");
      setRequestedPhone("");
      setPhoneReason("");
      fetchPhoneRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <BackButton label="Back to Previous Page" className="-ml-2 mb-2" size="sm" />
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Account & Security Settings</h1>
                <p className="text-xs text-muted-foreground">
                  Update your identity details, manage password security, and view logged-in
                  devices.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
          <TabsList
            className={`grid grid-cols-2 ${!isInitialAdmin && !isAdmin && !isSuperAdmin ? "md:grid-cols-4" : "md:grid-cols-3"} w-full text-xs h-fit`}
          >
            <TabsTrigger value="profile" className="py-2.5 gap-2 text-xs font-medium">
              <User className="h-4 w-4" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="password" className="py-2.5 gap-2 text-xs font-medium">
              <Lock className="h-4 w-4" />
              Security Password
            </TabsTrigger>
            <TabsTrigger value="sessions" className="py-2.5 gap-2 text-xs font-medium">
              <Laptop className="h-4 w-4" />
              Active Sessions
            </TabsTrigger>
            {!isInitialAdmin && !isAdmin && !isSuperAdmin && (
              <TabsTrigger value="phone" className="py-2.5 gap-2 text-xs font-medium">
                <Smartphone className="h-4 w-4" />
                Phone Change
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: PERSONAL INFORMATION */}
          <TabsContent value="profile">
            <Card className="border-border/80 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Identity Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Update your official legal names and national identification number.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="acc-first-name" className="text-xs font-medium">
                        First Name *
                      </Label>
                      <Input
                        id="acc-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        required
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="acc-last-name" className="text-xs font-medium">
                        Last Name *
                      </Label>
                      <Input
                        id="acc-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="acc-id-number"
                      className={
                        "text-xs font-medium" + (idNumber !== "" ? " text-muted-foreground" : "")
                      }
                    >
                      Kenyan ID Number *
                    </Label>
                    <Input
                      id="acc-id-number"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="e.g. 29384756"
                      required
                      disabled={idNumber !== ""}
                      className="text-sm font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {"National ID is required for verification and loan eligibility scoring."}
                      {" Can't be changed once set."}
                    </p>
                  </div>

                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
                      </Label>
                      <Input
                        value={profile?.email || ""}
                        disabled
                        className="bg-muted/50 text-xs font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Contact support to modify registered email.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" /> M-Pesa Phone Number
                      </Label>
                      <Input
                        value={profile?.phone || "Not set"}
                        disabled
                        className="bg-muted/50 text-xs font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Phone number is locked for M-Pesa disbursements. Use Phone Change tab for
                        requests.
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={profileLoading} className="gap-2">
                      {profileLoading ? (
                        <LucideLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Profile Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Transfer Initial Admin Role Card (Only for Initial Admin) */}
            {isInitialAdmin || isAdmin ? (
              <Card className="border-gold/40 bg-gold/5 shadow-soft mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-gold">
                    <Crown className="h-5 w-5" /> Transfer Initial Admin Role
                  </CardTitle>
                  <CardDescription className="text-xs">
                    As the initial administrator, you can transfer your Super Admin role to an
                    available active Agent of your choice. Upon transfer, the selected agent will
                    become Super Admin and your account will be demoted to a normal user account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {transferableAgents.length === 0 ? (
                    <div className="rounded-md border border-gold/20 bg-background/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0 text-gold" />
                      No available active agents found to receive role. Register or promote an agent
                      first in Agent Management.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="transfer-agent-select" className="text-xs font-medium">
                          Select Agent to Receive Super Admin Role
                        </Label>
                        <select
                          id="transfer-agent-select"
                          value={selectedTargetAgentId}
                          onChange={(e) => setSelectedTargetAgentId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">-- Choose an available agent --</option>
                          {transferableAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name} ({agent.email}) {agent.phone ? `- ${agent.phone}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        type="button"
                        variant="default"
                        disabled={!selectedTargetAgentId || transferLoading}
                        onClick={() => setShowTransferConfirm(true)}
                        className="gap-2 bg-gold hover:bg-gold/70 text-white"
                      >
                        {transferLoading ? (
                          <LucideLoader className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Transfer Role to Selected Agent
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              //  Danger Zone Card for Agents and Standard Users
              <Card className="border-destructive/40 bg-destructive/5 shadow-soft mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" /> Danger Zone
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Permanently delete your account, personal data, and active sessions from{" "}
                    {activeBusinessName}. This action is irreversible.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isInitialAdmin ? (
                    <div className="rounded-md border border-destructive/20 bg-background/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0 text-destructive" />
                      The Initial Admin account cannot be deleted directly. Please use the Transfer
                      Initial Admin Role card above to transfer your role to an agent first.
                    </div>
                  ) : isSuperAdmin ? (
                    <div className="rounded-md border border-destructive/20 bg-background/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0 text-destructive" />
                      Super Admin accounts cannot be directly deleted.
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setShowDeleteConfirm(true);
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" /> Delete My Account
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: CHANGE PASSWORD & 2FA */}
          <TabsContent value="password" className="space-y-6">
            <Card className="border-border/80 shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" /> Security Password & Credentials
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Update your account password with strong security requirements.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4" autoComplete="off">
                  {/* Current Password Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-curr-pass" className="text-xs font-semibold">
                      Current Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="acc-curr-pass"
                        name="current_password_manual_input"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        required
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        className="text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-new-pass" className="text-xs font-semibold">
                      New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="acc-new-pass"
                        name="new_password_input"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        required
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        className="text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Password Strength:</span>
                          <span className={`font-semibold ${passwordCriteria.text}`}>
                            {passwordCriteria.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              passwordCriteria.score >= 1
                                ? passwordCriteria.color
                                : "bg-transparent"
                            }`}
                            style={{ width: "20%" }}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              passwordCriteria.score >= 2
                                ? passwordCriteria.color
                                : "bg-transparent"
                            }`}
                            style={{ width: "20%" }}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              passwordCriteria.score >= 3
                                ? passwordCriteria.color
                                : "bg-transparent"
                            }`}
                            style={{ width: "20%" }}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              passwordCriteria.score >= 4
                                ? passwordCriteria.color
                                : "bg-transparent"
                            }`}
                            style={{ width: "20%" }}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              passwordCriteria.score >= 5
                                ? passwordCriteria.color
                                : "bg-transparent"
                            }`}
                            style={{ width: "20%" }}
                          />
                        </div>

                        {/* Password Requirements Checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.minLength ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.minLength
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              At least 8 characters
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.hasUpper ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.hasUpper
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              One uppercase letter (A-Z)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.hasLower ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.hasLower
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              One lowercase letter (a-z)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.hasNumber ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.hasNumber
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              One number (0-9)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.hasSpecial ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.hasSpecial
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              One special symbol (!@#$...)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {passwordCriteria.notCurrent && newPassword ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" />
                            )}
                            <span
                              className={
                                passwordCriteria.notCurrent && newPassword
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              Different from current password
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-conf-pass" className="text-xs font-semibold">
                      Confirm New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="acc-conf-pass"
                        name="confirm_password_input"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        required
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        className="text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && (
                      <p
                        className={`text-[11px] flex items-center gap-1 ${
                          passwordCriteria.matchesConfirm ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {passwordCriteria.matchesConfirm ? (
                          <>
                            <Check className="h-3 w-3" /> Passwords match
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" /> Passwords do not match
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Session Invalidation Security Alert */}
                  <div className="rounded-lg bg-muted/50 border p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Security Protection Notice</p>
                      <p className="mt-0.5">
                        Updating your password will automatically sign out all other active browser
                        and device sessions to ensure your account remains safe.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        passwordLoading ||
                        !currentPassword ||
                        !passwordCriteria.minLength ||
                        !passwordCriteria.hasUpper ||
                        !passwordCriteria.hasLower ||
                        !passwordCriteria.hasNumber ||
                        !passwordCriteria.hasSpecial ||
                        !passwordCriteria.matchesConfirm
                      }
                      className="gap-2"
                    >
                      {passwordLoading ? (
                        <LucideLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Email Two-Factor Authentication Card */}
            {(twoFactorSettings?.is2faByEmailAllowed || twoFactorSettings?.is2faEnabled) && (
              <Card className="border-border/80 shadow-soft">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" /> Email Two-Factor Authentication
                        (2FA)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Protect your account login sessions with one-time verification codes sent
                        directly to your registered email (
                        {twoFactorSettings?.userEmail || profile?.email}).
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {twoFactorSettings?.is2faEnabled ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-primary/10 border border-primary/20 p-3.5 flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary/60 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-primary">
                            Two-Factor Authentication is Active
                          </p>
                          <p className="text-primary/80">
                            A 6-digit security verification code will be sent to{" "}
                            <strong>{twoFactorSettings?.userEmail || profile?.email}</strong>{" "}
                            whenever you sign in.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-start">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => setDisable2faDialogOpen(true)}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Disable Two-Factor Authentication
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted/40 border p-3.5 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-foreground">
                            Two-Factor Authentication is Not Enabled
                          </p>
                          <p className="text-muted-foreground">
                            Add an extra layer of defense to keep unauthorized users from accessing
                            your account even if they obtain your password.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-start">
                        <Button type="button" onClick={handleOpenEnable2faDialog} className="gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          Enable Email Two-Factor Authentication
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 2FA Enablement Dialog */}
            <Dialog open={enable2faDialogOpen} onOpenChange={setEnable2faDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <div className="p-2 rounded-full bg-primary/10">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <DialogTitle className="text-base sm:text-lg">
                      Enable Two-Factor Authentication
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs">
                    We sent a 6-digit verification code to your registered email to confirm this
                    setup.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="rounded-lg bg-muted/50 border p-3 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        {twoFactorSettings?.userEmail || profile?.email}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Target Email
                    </Badge>
                  </div>

                  <div className="space-y-3 flex flex-col items-center">
                    <div className="flex justify-center w-full py-1">
                      <InputOTP
                        id="dialog2faCode"
                        maxLength={6}
                        value={twoFactorCodeInput}
                        disabled={twoFactorVerifying}
                        onChange={(val) => {
                          const clean = val.replace(/\D/g, "").slice(0, 6);
                          setTwoFactorCodeInput(clean);
                          if (clean.length === 6 && !twoFactorVerifying) {
                            void handleVerifyAndToggle2fa(true, clean);
                          }
                        }}
                        autoFocus
                      >
                        <InputOTPGroup>
                          <InputOTPSlot
                            index={0}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                          <InputOTPSlot
                            index={1}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                          <InputOTPSlot
                            index={2}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                          <InputOTPSlot
                            index={3}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                          <InputOTPSlot
                            index={4}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                          <InputOTPSlot
                            index={5}
                            className="h-12 w-11 sm:h-12 sm:w-12 text-lg font-bold font-mono"
                          />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Didn't get the code?</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={twoFactorSendingCode || twoFactorResendCooldown > 0}
                      onClick={() => handleSend2faCode(false)}
                      className="text-xs h-8 gap-1.5 px-2"
                    >
                      {twoFactorSendingCode ? (
                        <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {twoFactorResendCooldown > 0
                        ? `Resend in ${twoFactorResendCooldown}s`
                        : "Resend Code"}
                    </Button>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEnable2faDialogOpen(false)}
                    disabled={twoFactorVerifying}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={twoFactorVerifying || twoFactorCodeInput.trim().length < 6}
                    onClick={() => handleVerifyAndToggle2fa(true)}
                    className="gap-2"
                  >
                    {twoFactorVerifying ? (
                      <>
                        <LucideLoader className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Verify & Enable 2FA
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 2FA Disable Confirmation Dialog */}
            <AlertDialog open={disable2faDialogOpen} onOpenChange={setDisable2faDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" /> Disable Two-Factor Authentication?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs space-y-2">
                    <p>
                      Disabling 2FA will reduce the security level of your account. You will only
                      need your password to sign in to {activeBusinessName}.
                    </p>
                    <p className="font-medium text-foreground">
                      Are you sure you want to disable email two-factor authentication?
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={twoFactorVerifying}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      void handleVerifyAndToggle2fa(false);
                    }}
                    disabled={twoFactorVerifying}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {twoFactorVerifying ? (
                      <LucideLoader className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm Disable 2FA"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* TAB 3: ACTIVE SESSIONS */}
          <TabsContent value="sessions">
            <Card className="border-border/80 shadow-soft">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-primary" /> Logged-In Devices & Active Sessions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monitor devices where your account is currently signed in. Terminate
                    unrecognized sessions instantly.
                  </CardDescription>
                </div>
                {sessions.length > 1 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRevokeAllOthers}
                    disabled={revokingId === "all"}
                    className="gap-1.5 text-xs"
                  >
                    {revokingId === "all" ? (
                      <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Revoke All Other Sessions
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <LucideLoader className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No active session details found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s, idx) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-muted text-foreground">
                            {s.deviceInfo.toLowerCase().includes("mobile") ? (
                              <Smartphone className="h-4 w-4" />
                            ) : (
                              <Laptop className="h-4 w-4" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                              <span>{s.deviceInfo || "Unknown Browser / Device"}</span>
                              {idx === 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                >
                                  Current Session
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> {s.ipAddress}
                              </span>
                              <span>·</span>
                              <span>Last active: {new Date(s.lastActiveAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {idx !== 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevokeSession(s.id)}
                            disabled={revokingId === s.id}
                            className="text-xs text-destructive hover:text-destructive gap-1 self-end sm:self-center"
                          >
                            {revokingId === s.id ? (
                              <LucideLoader className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Terminate
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: PHONE CHANGE REQUEST */}
          {!isInitialAdmin && !isAdmin && !isSuperAdmin && (
            <TabsContent value="phone">
              <Card className="border-border/80 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" /> M-Pesa Phone Number Update
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your phone number is tied directly to Safaricom STK push payouts. Phone changes
                    require administrative review for security.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handlePhoneRequestSubmit} className="space-y-4">
                    <div className="p-3 rounded-lg border bg-gold/10 border-gold/20 text-gold text-xs flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-gold" />
                      <span>
                        Current phone: <strong>{profile?.phone || "None"}</strong>. Ensure the new
                        number is registered on M-Pesa under your national ID.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="acc-new-phone" className="text-xs font-medium">
                        New Requested Phone Number *
                      </Label>
                      <Input
                        id="acc-new-phone"
                        value={requestedPhone}
                        onChange={(e) => setRequestedPhone(e.target.value)}
                        placeholder="e.g. 0712345678"
                        required
                        className="text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="acc-phone-reason" className="text-xs font-medium">
                        Reason for Phone Change *
                      </Label>
                      <Textarea
                        id="acc-phone-reason"
                        value={phoneReason}
                        onChange={(e) => setPhoneReason(e.target.value)}
                        placeholder="Explain why you are changing your M-Pesa phone number (e.g. Lost SIM card, line upgrade)..."
                        required
                        rows={3}
                        className="text-xs leading-relaxed"
                      />
                    </div>

                    <div className="pt-4">
                      <div className="flex justify-end">
                        <Button type="submit" disabled={phoneLoading} className="gap-2">
                          {phoneLoading ? (
                            <LucideLoader className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Submit Phone Update Request
                        </Button>
                      </div>

                      {/* History of phone requests */}
                      <div className="space-y-1 scale-95">
                        <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                          Phone Change History
                        </h3>
                        {phoneRequests.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No prior phone change requests submitted.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {phoneRequests.map((req) => (
                              <div
                                key={req.id}
                                className="p-3 rounded-lg border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 font-medium">
                                    <span>
                                      From {req.currentPhone} →{" "}
                                      <span className="font-mono text-primary">
                                        {req.requestedPhone}
                                      </span>
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">{req.reason}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Submitted: {new Date(req.createdAt).toLocaleDateString()}
                                  </p>
                                </div>

                                <div>
                                  {req.status === "pending" && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-gold/30 text-gold bg-gold/10"
                                    >
                                      <Clock className="h-3 w-3" /> Pending Review
                                    </Badge>
                                  )}
                                  {req.status === "approved" && (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Approved
                                    </Badge>
                                  )}
                                  {req.status === "rejected" && (
                                    <Badge variant="destructive" className="gap-1">
                                      <XCircle className="h-3 w-3" /> Rejected
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Confirmation Dialog: Transfer Initial Admin Role */}
      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gold">
              <Crown className="size-5 shrink-0" />
              Transfer Initial Admin Role?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                Are you sure you want to transfer your Initial Admin role to{" "}
                <strong className="text-foreground">
                  {transferableAgents.find((a) => a.id === selectedTargetAgentId)?.name ||
                    "the selected agent"}
                </strong>
                ?
              </p>
              <p className="text-gold font-medium">
                This agent will be promoted to Super Admin with full system rights, and your account
                will be demoted to a standard user account.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferLoading}
              onClick={(e) => {
                e.preventDefault();
                handleTransferAdminRole();
              }}
              className="bg-gold hover:bg-gold/90 text-white gap-1.5"
            >
              {transferLoading && <LucideLoader className="size-3.5 animate-spin" />}
              Confirm Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete My Account */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              Delete Your Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-xs">
              <p>
                This action will immediately delete your account, personal details, and active login
                sessions.
              </p>
              <div className="space-y-1.5 pt-2">
                <Label
                  htmlFor="delete-confirm-input"
                  className="text-xs text-foreground font-medium"
                >
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="font-mono text-xs uppercase"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
            >
              {deleteLoading && <LucideLoader className="size-3.5 animate-spin" />}
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
