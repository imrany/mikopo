import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  Check,
  CreditCard,
  Crown,
  Globe,
  History,
  LucideLoader,
  LucideTrash2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Send,
  Shield,
  Trash2,
  User,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { LoadingPage } from "@/components/loading-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { LexicalRichEditor } from "@/components/lexical-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  adminDeleteUser,
  adminDeleteUserGuarantor,
  adminSaveUserGuarantor,
  adminSetCreditScore,
  adminSetLoanLimit,
  adminSetUserStatus,
  adminToggleFreezePoints,
  adminUpdateUser,
  getAdminUserDetails,
} from "@/lib/admin.functions";
import { getAdminSmtpSettings, sendAdminCustomUserEmail } from "@/lib/admin-email.functions";
import { formatKes } from "@/lib/format";
import BackButton from "@/components/back-button";
import { useAppConfig } from "@/lib/config-context";
import { useUrlBooleanState } from "@/lib/use-url-search-state";

export const Route = createFileRoute("/_authenticated/admin/user/$userId")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Manage User Details — Admin Console" },
      {
        name: "description",
        content:
          "Manage borrower profile details, credibility score, loan limit, saved guarantors, and active loan applications.",
      },
    ],
  }),
  component: AdminUserDetailPage,
});

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const {
    profile: currentProfile,
    isInitialAdmin: currentIsInitialAdmin,
    isStaff,
    loading,
  } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { businessName } = useAppConfig();

  const getDetailsFn = useServerFn(getAdminUserDetails);
  const updateUserFn = useServerFn(adminUpdateUser);
  const setScoreFn = useServerFn(adminSetCreditScore);
  const setLimitFn = useServerFn(adminSetLoanLimit);
  const setStatusFn = useServerFn(adminSetUserStatus);
  const freezeFn = useServerFn(adminToggleFreezePoints);
  const saveGuarantorFn = useServerFn(adminSaveUserGuarantor);
  const deleteGuarantorFn = useServerFn(adminDeleteUserGuarantor);
  const deleteUserFn = useServerFn(adminDeleteUser);
  const getSmtpSettingsFn = useServerFn(getAdminSmtpSettings);
  const sendCustomEmailFn = useServerFn(sendAdminCustomUserEmail);

  // SMTP query to check if configured
  const { data: smtpSettings } = useQuery({
    queryKey: ["admin-smtp-settings"],
    queryFn: () => getSmtpSettingsFn(),
    enabled: isStaff,
  });

  // Custom User Email Form State
  const [emailTitle, setEmailTitle] = useState("");
  const [emailReason, setEmailReason] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendInApp, setSendInApp] = useState(true);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  const COMMON_EMAIL_REASONS = [
    "Loan Application Update",
    "KYC / Identity Document Request",
    "Repayment & Due Date Notice",
    "Account Status Notification",
    "Guarantor Verification Follow-up",
    "General Borrower Inquiries",
  ];

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useUrlBooleanState("editUser");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");

  // Edit Score & Limit Modal
  const [editScoreOpen, setEditScoreOpen] = useUrlBooleanState("editScore");
  const [scoreVal, setScoreVal] = useState(300);

  const [editLimitOpen, setEditLimitOpen] = useUrlBooleanState("editLimit");
  const [limitVal, setLimitVal] = useState(1000);

  // User Guarantor Modal
  const [guarantorModalOpen, setGuarantorModalOpen] = useUrlBooleanState("guarantorModal");
  const [editingGuarantorId, setEditingGuarantorId] = useState<string | null>(null);
  const [gFirstName, setGFirstName] = useState("");
  const [gLastName, setGLastName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gIdNumber, setGIdNumber] = useState("");
  const [gAddress, setGAddress] = useState("");
  const [gRelationship, setGRelationship] = useState("");
  const [gOccupation, setGOccupation] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-details", userId],
    queryFn: () => getDetailsFn({ data: { targetUserId: userId } }),
    enabled: isStaff && Boolean(userId),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      idNumber?: string;
    }) => updateUserFn({ data: input }),
    onSuccess: () => {
      setEditProfileOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setScoreMutation = useMutation({
    mutationFn: (input: { userId: string; score: number }) => setScoreFn({ data: input }),
    onSuccess: () => {
      setEditScoreOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setLimitMutation = useMutation({
    mutationFn: (input: { userId: string; limit: number }) => setLimitFn({ data: input }),
    onSuccess: () => {
      setEditLimitOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setStatusMutation = useMutation({
    mutationFn: (input: { userId: string; status: "active" | "suspended" }) =>
      setStatusFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const freezeMutation = useMutation({
    mutationFn: (input: { userId: string; isFrozen: boolean }) => freezeFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveGuarantorMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      userId: string;
      firstName: string;
      lastName: string;
      phone: string;
      idNumber: string;
      address?: string;
      relationship?: string;
      occupation?: string;
    }) => saveGuarantorFn({ data: input }),
    onSuccess: () => {
      setGuarantorModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteGuarantorMutation = useMutation({
    mutationFn: (id: string) => deleteGuarantorFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (targetUserId: string) => deleteUserFn({ data: { userId: targetUserId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      router.navigate({ to: "/admin/users" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendCustomEmailMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      title: string;
      reason: string;
      body: string;
      sendInAppNotification: boolean;
      websiteUrl?: string;
    }) => sendCustomEmailFn({ data: input }),
    onSuccess: (res) => {
      toast.success(res.message || "Email successfully sent to user.");
      setEmailTitle("");
      setEmailReason("");
      setEmailBody("");
      void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSendCustomEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTitle.trim()) {
      toast.error("Please provide an email title / subject.");
      return;
    }
    if (!emailReason.trim()) {
      toast.error("Please provide the reason for this email.");
      return;
    }
    if (!emailBody.trim()) {
      toast.error("Please enter the email body message.");
      return;
    }

    const websiteUrl = typeof window !== "undefined" ? window.location.origin : "";

    sendCustomEmailMutation.mutate({
      userId,
      title: emailTitle.trim(),
      reason: emailReason.trim(),
      body: emailBody.trim(),
      sendInAppNotification: sendInApp,
      websiteUrl,
    });
  };

  if (loading || isLoading || !isStaff) {
    return <LoadingPage />;
  }

  if (!data?.user) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center space-y-4">
          <AlertCircle className="size-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">User Not Found</h1>
          <Button asChild variant="outline">
            <Link to="/admin/users">Back to User Management</Link>
          </Button>
        </main>
      </div>
    );
  }

  const { user, guarantors, loans, audit_logs } = data;
  const isSelf = user.id === currentProfile?.id;
  const agentCannotEditInitialAdmin = Boolean(user.is_initial_admin) && !currentIsInitialAdmin;

  const openEditProfile = () => {
    if (agentCannotEditInitialAdmin) return;
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setIdNumber(user.id_number || "");
    setEditProfileOpen(true);
  };

  const openAddGuarantor = () => {
    setEditingGuarantorId(null);
    setGFirstName("");
    setGLastName("");
    setGPhone("");
    setGIdNumber("");
    setGAddress("");
    setGRelationship("");
    setGOccupation("");
    setGuarantorModalOpen(true);
  };

  const openEditGuarantor = (g: (typeof guarantors)[0]) => {
    setEditingGuarantorId(g.id);
    setGFirstName(g.first_name);
    setGLastName(g.last_name);
    setGPhone(g.phone);
    setGIdNumber(g.id_number);
    setGAddress(g.address || "");
    setGRelationship(g.relationship || "");
    setGOccupation(g.occupation || "");
    setGuarantorModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col items-start gap-2">
          <BackButton label="Back to Previous Page" size="sm" />
          <div className="flex justify-between items-center w-full">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">
                  {`${user.first_name} ${user.last_name}`.trim() || user.email}
                </h1>
                {user.is_super_admin ? (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Crown className="size-3" /> Super Admin
                  </Badge>
                ) : user.is_agent ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Shield className="size-3 text-primary" /> Agent
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Borrower
                  </Badge>
                )}
                <Badge variant={user.status === "active" ? "default" : "destructive"}>
                  {user.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main 2 Cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Profile Overview */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>User Details & Contact Info</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={agentCannotEditInitialAdmin}
                    title={
                      agentCannotEditInitialAdmin
                        ? "Agents cannot edit initial admin details."
                        : "Edit"
                    }
                    onClick={openEditProfile}
                    className="h-7 text-xs gap-1"
                  >
                    <Pencil className="size-2" /> Edit
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-muted/20 p-3.5 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground block">First Name</span>
                    <span className="font-semibold text-foreground">{user.first_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Last Name</span>
                    <span className="font-semibold text-foreground">{user.last_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Email Address</span>
                    <span className="font-semibold text-foreground">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone Number</span>
                    <span className="font-semibold text-primary">{user.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">National ID</span>
                    <span className="font-semibold text-foreground">{user.id_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Referral Code</span>
                    <span className="font-semibold text-foreground font-mono">
                      {user.referral_code}
                    </span>
                  </div>
                </div>
                {!isSelf && (
                  <div className="flex gap-2 items-center">
                    {user.status === "active" ? (
                      <Button
                        variant="gold"
                        size="sm"
                        disabled={
                          setStatusMutation.isPending ||
                          user.is_super_admin ||
                          user.is_initial_admin ||
                          isSelf
                        }
                        title={
                          isSelf
                            ? "You cannot suspend your own account."
                            : user.is_super_admin || user.is_initial_admin
                              ? "Super Admin status cannot be changed directly."
                              : "Suspend User"
                        }
                        onClick={() =>
                          setStatusMutation.mutate({ userId: user.id, status: "suspended" })
                        }
                        className="gap-1.5 text-xs"
                      >
                        <Ban className="size-3.5" /> Suspend User
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={setStatusMutation.isPending}
                        onClick={() =>
                          setStatusMutation.mutate({ userId: user.id, status: "active" })
                        }
                        className="gap-1.5 text-xs bg-primary/80 hover:bg-primary text-white"
                      >
                        <UserCheck className="size-3.5" /> Activate User
                      </Button>
                    )}

                    <Button
                      disabled={
                        agentCannotEditInitialAdmin || isSelf || deleteUserMutation.isPending
                      }
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteUserMutation.mutate(user.id)}
                    >
                      {deleteUserMutation.isPending ? (
                        <>
                          <LucideLoader className="size-3.5" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <LucideTrash2 className="size-3.5" />
                          <span>Delete User</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Send Custom Email to User - Only visible when SMTP is configured */}
            {smtpSettings?.isConfigured && (
              <Card className="border-border/70 shadow-soft overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="size-4 text-primary" />
                        Send Custom Email
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Dispatch a direct email to {user.first_name || user.email} with verified
                        admin signature, title, reason, and body.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <form onSubmit={handleSendCustomEmail} className="space-y-4">
                    {/* Recipient info indicator */}
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/50 text-xs">
                      <span className="text-muted-foreground">Recipient:</span>
                      <span className="font-semibold text-foreground">
                        {user.first_name ? `${user.first_name} ${user.last_name}` : user.email}
                      </span>
                      <span className="text-muted-foreground font-mono">({user.email})</span>
                    </div>

                    {/* Title / Subject */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="email-title"
                        className="text-xs font-semibold flex items-center gap-1.5"
                      >
                        Email Title / Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email-title"
                        placeholder="e.g. Loan Application Verification — Action Required"
                        value={emailTitle}
                        onChange={(e) => setEmailTitle(e.target.value)}
                        disabled={sendCustomEmailMutation.isPending}
                        className="text-xs"
                      />
                    </div>

                    {/* Reason of Email */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="email-reason"
                          className="text-xs font-semibold flex items-center gap-1.5"
                        >
                          Reason of the Email <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Highlighted in email notice box
                        </span>
                      </div>
                      <Input
                        id="email-reason"
                        placeholder="e.g. KYC Identity Verification, Repayment Reminder, or General Inquiry"
                        value={emailReason}
                        onChange={(e) => setEmailReason(e.target.value)}
                        disabled={sendCustomEmailMutation.isPending}
                        className="text-xs"
                      />
                      {/* Quick preset chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {COMMON_EMAIL_REASONS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEmailReason(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                              emailReason === preset
                                ? "bg-primary/10 text-primary border-primary/40 font-medium"
                                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="email-body"
                          className="text-xs font-semibold flex items-center gap-1.5"
                        >
                          Email Body Message <span className="text-destructive">*</span>
                        </Label>
                      </div>
                      <LexicalRichEditor
                        id="email-body"
                        placeholder="Type the formatted message content to the borrower..."
                        value={emailBody}
                        mode="html"
                        minHeight="160px"
                        showIconPicker={true}
                        disabled={sendCustomEmailMutation.isPending}
                        onChange={(val) => setEmailBody(val)}
                      />
                    </div>

                    {/* In-app notification toggle & signature preview toggle */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20">
                        <div className="space-y-0.5">
                          <Label
                            htmlFor="send-in-app"
                            className="text-xs font-medium cursor-pointer"
                          >
                            Mirror as In-App Alert
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Create in-app announcement notification
                          </p>
                        </div>
                        <Switch
                          id="send-in-app"
                          checked={sendInApp}
                          onCheckedChange={setSendInApp}
                          disabled={sendCustomEmailMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20">
                        <div className="space-y-0.5">
                          <Label
                            htmlFor="show-sig"
                            className="text-xs font-medium cursor-pointer flex items-center gap-1"
                          >
                            Official Signature
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Name, email, role & website
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSignaturePreview(!showSignaturePreview)}
                          className="h-6 text-[11px] px-2 text-primary"
                        >
                          {showSignaturePreview ? "Hide Preview" : "View Preview"}
                        </Button>
                      </div>
                    </div>

                    {/* Signature Live Preview */}
                    {showSignaturePreview && (
                      <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground border-b border-border/40 pb-1.5">
                          <span>Attached Email Signature Template</span>
                          <Badge variant="secondary" className="text-[9px] h-4">
                            Auto-Generated
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">
                            {currentProfile
                              ? `${currentProfile.first_name} ${currentProfile.last_name}`.trim() ||
                                currentProfile.email
                              : "Authorized Officer"}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Authorized Staff Loan Officer at {businessName}
                          </p>
                          <div className="pt-1 text-[11px] space-y-0.5 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Mail className="size-3 text-primary" />
                              <span>Direct Email:</span>
                              <span className="text-foreground font-medium">
                                {currentProfile?.email || ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Globe className="size-3 text-primary" />
                              <span>Official Website:</span>
                              <span className="text-foreground font-medium">{siteOrigin}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          sendCustomEmailMutation.isPending ||
                          (!emailTitle && !emailReason && !emailBody)
                        }
                        onClick={() => {
                          setEmailTitle("");
                          setEmailReason("");
                          setEmailBody("");
                        }}
                        className="text-xs"
                      >
                        Clear Form
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          sendCustomEmailMutation.isPending ||
                          !emailTitle.trim() ||
                          !emailReason.trim() ||
                          !emailBody.trim()
                        }
                        className="text-xs gap-1.5 min-w-30"
                      >
                        {sendCustomEmailMutation.isPending ? (
                          <>
                            <LucideLoader className="size-3.5 animate-spin" />
                            <span>Sending Email...</span>
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" />
                            <span>Send Email</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Saved User Guarantors Card */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    Saved Profile Guarantors ({guarantors.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Guarantors registered on this borrower's account profile.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openAddGuarantor} className="gap-1 text-xs">
                  <Plus className="size-3.5" /> Add Guarantor
                </Button>
              </CardHeader>
              <CardContent>
                {guarantors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    No guarantors registered for this user yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guarantor Name</TableHead>
                        <TableHead>Phone / ID</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Occupation</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guarantors.map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium text-xs">
                            {`${g.first_name} ${g.last_name}`.trim()}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{g.phone}</div>
                            <div className="text-[10px] text-muted-foreground">
                              ID: {g.id_number}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{g.relationship || "—"}</TableCell>
                          <TableCell className="text-xs">{g.occupation || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => openEditGuarantor(g)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive"
                                disabled={deleteGuarantorMutation.isPending}
                                onClick={() => deleteGuarantorMutation.mutate(g.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* User Loans & Applications */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  Loan History & Requests ({loans.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Active, pending, and past loan applications for this user.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    This user has no loan applications on record.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / Tier</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Guarantors Verified</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map(
                        (l: {
                          id: string;
                          product_name?: string;
                          principal?: number | string | Record<string, unknown>;
                          accepted_guarantors_count?: number;
                          guarantors_required?: number;
                          status: string;
                        }) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium text-xs">{l.product_name}</TableCell>
                            <TableCell className="font-semibold text-xs">
                              {formatKes(l.principal as number)}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px]">
                                {l.accepted_guarantors_count} / {l.guarantors_required}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  l.status === "active"
                                    ? "default"
                                    : l.status === "repaid"
                                      ? "default"
                                      : l.status === "rejected"
                                        ? "destructive"
                                        : l.status === "defaulted"
                                          ? "gray"
                                          : "gold"
                                }
                                className="text-[10px] capitalize"
                              >
                                {l.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                                <Link to="/admin/loans/$loanId" params={{ loanId: l.id }}>
                                  View Details
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Credibility Score, Loan Limit & Audit */}
          <div className="space-y-6">
            {/* Credibility & Loan Limit Card */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Credit Score & Loan Limit</CardTitle>
                <CardDescription className="text-xs">
                  Adjust borrower metrics to grant higher limits or update scoring.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {(user.is_super_admin || user.is_agent || user.is_initial_admin) && (
                  <div className="p-3 rounded-lg border border-gold/30 bg-gold/10 text-gold space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-xs">
                      <Shield className="size-3.5" /> Administrative Account
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Administrators and staff agents do not hold credibility points or loan limits.
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Credibility Score:</span>
                    <span className="font-bold text-base text-primary">
                      {user.is_super_admin || user.is_agent || user.is_initial_admin
                        ? "N/A (Admin)"
                        : `${user.credibility_score} pts`}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      agentCannotEditInitialAdmin ||
                      user.is_super_admin ||
                      user.is_agent ||
                      user.is_initial_admin ||
                      user.is_earning_points_frozen ||
                      isSelf
                    }
                    title={
                      user.is_super_admin ||
                      user.is_agent ||
                      user.is_initial_admin ||
                      user.is_earning_points_frozen ||
                      isSelf
                        ? "Admins and staff agents do not hold points."
                        : agentCannotEditInitialAdmin
                          ? "Agents cannot modify initial admin score."
                          : "Adjust Score"
                    }
                    className="w-full text-xs h-7"
                    onClick={() => {
                      if (
                        !agentCannotEditInitialAdmin &&
                        !(
                          user.is_super_admin ||
                          user.is_agent ||
                          user.is_initial_admin ||
                          user.is_earning_points_frozen ||
                          isSelf
                        )
                      ) {
                        setScoreVal(user.credibility_score);
                        setEditScoreOpen(true);
                      }
                    }}
                  >
                    Adjust Score
                  </Button>
                </div>

                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Available Loan Limit:</span>
                    <span className="font-bold text-base text-primary">
                      {user.is_super_admin || user.is_agent || user.is_initial_admin
                        ? "N/A (Admin)"
                        : formatKes(user.loan_limit)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      agentCannotEditInitialAdmin ||
                      user.is_super_admin ||
                      user.is_agent ||
                      user.is_initial_admin ||
                      user.is_earning_points_frozen ||
                      isSelf
                    }
                    title={
                      user.is_super_admin ||
                      user.is_agent ||
                      user.is_initial_admin ||
                      user.is_earning_points_frozen ||
                      isSelf
                        ? "Admins and staff agents do not hold loan limits."
                        : agentCannotEditInitialAdmin
                          ? "Agents cannot modify initial admin limit."
                          : "Adjust Loan Limit"
                    }
                    className="w-full text-xs h-7"
                    onClick={() => {
                      if (
                        !agentCannotEditInitialAdmin &&
                        !(
                          user.is_super_admin ||
                          user.is_agent ||
                          user.is_initial_admin ||
                          user.is_earning_points_frozen ||
                          isSelf
                        )
                      ) {
                        setLimitVal(user.loan_limit);
                        setEditLimitOpen(true);
                      }
                    }}
                  >
                    Adjust Loan Limit
                  </Button>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {!isSelf && (
                    <>
                      <Button
                        variant={user.is_earning_points_frozen ? "outline" : "secondary"}
                        size="sm"
                        disabled={freezeMutation.isPending || agentCannotEditInitialAdmin || isSelf}
                        title={
                          agentCannotEditInitialAdmin
                            ? "Agents cannot freeze or unfreeze initial admin points."
                            : user.is_earning_points_frozen
                              ? "Unfreeze points"
                              : "Freeze points"
                        }
                        onClick={() =>
                          freezeMutation.mutate({
                            userId: user.id,
                            isFrozen: !user.is_earning_points_frozen,
                          })
                        }
                        className="text-xs"
                      >
                        {user.is_earning_points_frozen ? "Unfreeze Points" : "Freeze Points"}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audit Log Events */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Recent User Activity Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {audit_logs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No activity logs recorded.
                    </p>
                  ) : (
                    audit_logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-2 rounded border border-border/40 flex justify-between items-center"
                      >
                        <span className="font-medium text-foreground">{log.action}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Dialog: Edit Profile */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              Edit Borrower Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update personal contact details, email, and identification for {user.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-first-name"
                  className="text-xs font-medium flex items-center gap-1 text-foreground"
                >
                  <User className="size-3 text-muted-foreground" />
                  First Name
                </Label>
                <Input
                  id="edit-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-last-name"
                  className="text-xs font-medium flex items-center gap-1 text-foreground"
                >
                  <User className="size-3 text-muted-foreground" />
                  Last Name
                </Label>
                <Input
                  id="edit-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-email"
                className="text-xs font-medium flex items-center gap-1 text-foreground"
              >
                <Mail className="size-3 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="borrower@example.com"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-phone"
                  className="text-xs font-medium flex items-center gap-1 text-foreground"
                >
                  <Phone className="size-3 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-id"
                  className="text-xs font-medium flex items-center gap-1 text-foreground"
                >
                  <CreditCard className="size-3 text-muted-foreground" />
                  National ID
                </Label>
                <Input
                  id="edit-id"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="6-10 digits"
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateProfileMutation.isPending}
              onClick={() =>
                updateProfileMutation.mutate({
                  userId: user.id,
                  firstName,
                  lastName,
                  email,
                  phone,
                  idNumber,
                })
              }
              className="gap-1.5"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <LucideLoader className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adjust Credit Score */}
      <Dialog open={editScoreOpen} onOpenChange={setEditScoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credibility Score</DialogTitle>
            <DialogDescription className="text-xs">
              Set credibility score between 300 and 850 pts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs">
            <div className="text-center font-bold text-2xl text-primary">{scoreVal} pts</div>
            <Slider
              value={[scoreVal]}
              min={300}
              max={850}
              step={10}
              onValueChange={([val]) => setScoreVal(val as number)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditScoreOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={setScoreMutation.isPending}
              onClick={() =>
                setScoreMutation.mutate({
                  userId: user.id,
                  score: scoreVal,
                })
              }
            >
              {setScoreMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Save Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adjust Loan Limit */}
      <Dialog open={editLimitOpen} onOpenChange={setEditLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Maximum Loan Limit</DialogTitle>
            <DialogDescription className="text-xs">
              Set maximum loan limit for this borrower in KES.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-xs">
            <Label htmlFor="edit-limit-val" className="text-xs font-medium">
              Loan Limit (KES)
            </Label>
            <Input
              id="edit-limit-val"
              type="number"
              value={limitVal}
              onChange={(e) => setLimitVal(Number(e.target.value))}
              className="text-xs font-semibold"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditLimitOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={setLimitMutation.isPending}
              onClick={() =>
                setLimitMutation.mutate({
                  userId: user.id,
                  limit: limitVal,
                })
              }
            >
              {setLimitMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Save Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit User Guarantor */}
      <Dialog open={guarantorModalOpen} onOpenChange={setGuarantorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGuarantorId ? "Edit Profile Guarantor" : "Add Profile Guarantor"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save or update guarantor credentials linked to this borrower's profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-first-name" className="text-xs">
                  First Name *
                </Label>
                <Input
                  id="g-first-name"
                  value={gFirstName}
                  onChange={(e) => setGFirstName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-last-name" className="text-xs">
                  Last Name *
                </Label>
                <Input
                  id="g-last-name"
                  value={gLastName}
                  onChange={(e) => setGLastName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-phone" className="text-xs">
                  Phone Number *
                </Label>
                <Input
                  id="g-phone"
                  value={gPhone}
                  onChange={(e) => setGPhone(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-id" className="text-xs">
                  National ID Number *
                </Label>
                <Input
                  id="g-id"
                  value={gIdNumber}
                  onChange={(e) => setGIdNumber(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-relationship" className="text-xs">
                  Relationship
                </Label>
                <Input
                  id="g-relationship"
                  placeholder="e.g. Sibling, Friend, Colleague"
                  value={gRelationship}
                  onChange={(e) => setGRelationship(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-occupation" className="text-xs">
                  Occupation
                </Label>
                <Input
                  id="g-occupation"
                  placeholder="e.g. Teacher, Merchant"
                  value={gOccupation}
                  onChange={(e) => setGOccupation(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="g-address" className="text-xs">
                Physical Address
              </Label>
              <Input
                id="g-address"
                placeholder="e.g. Nairobi, Kenya"
                value={gAddress}
                onChange={(e) => setGAddress(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGuarantorModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                saveGuarantorMutation.isPending ||
                !gFirstName.trim() ||
                !gLastName.trim() ||
                !gPhone.trim() ||
                !gIdNumber.trim()
              }
              onClick={() =>
                saveGuarantorMutation.mutate({
                  id: editingGuarantorId || "",
                  userId: user.id,
                  firstName: gFirstName,
                  lastName: gLastName,
                  phone: gPhone,
                  idNumber: gIdNumber,
                  address: gAddress,
                  relationship: gRelationship,
                  occupation: gOccupation,
                })
              }
            >
              {saveGuarantorMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Save Guarantor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
