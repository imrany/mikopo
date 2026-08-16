import { useState, useEffect, useCallback } from "react";
import {
  User,
  Phone,
  CreditCard,
  Lock,
  LucideLoader,
  Mail,
  Key,
  Check,
  Smartphone,
  ShieldCheck,
  Laptop,
  Globe,
  Trash2,
  Send,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
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
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";

export function ProfileEditDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { profile, token, refresh } = useAuth();
  const [open, setOpen] = useUrlBooleanState("editProfile");
  const [activeTabUrl, setActiveTabUrl] = useUrlStringState("editProfileTab", "profile");

  const validTabs = ["profile", "password", "sessions", "phone"];
  const activeTab = (validTabs.includes(activeTabUrl || "") ? activeTabUrl : "profile") as
    "profile" | "password" | "sessions" | "phone";
  const setActiveTab = (t: "profile" | "password" | "sessions" | "phone") => setActiveTabUrl(t);

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (profile && open) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setIdNumber(profile.id_number || "");
    }
  }, [profile, open]);

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

  useEffect(() => {
    if (open && token) {
      if (activeTab === "sessions") {
        fetchSessions();
      } else if (activeTab === "phone") {
        fetchPhoneRequests();
      }
    }
  }, [open, activeTab, token, fetchSessions, fetchPhoneRequests]);

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

      toast.success("Profile details updated successfully!");
      await refresh();
      setOpen(false);
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

      toast.success("Password changed successfully!");
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

      toast.success("Session terminated");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to terminate session";
      toast.error(msg);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeAllOtherSessions() {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const res = await revokeAllOtherSessions({
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to revoke other sessions");
        return;
      }

      toast.success("All other active sessions have been logged out");
      await fetchSessions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handlePhoneRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!/^254[17]\d{8}$/.test(requestedPhone.trim())) {
      toast.error("Phone number must be in the format 2547XXXXXXXX or 2541XXXXXXXX");
      return;
    }

    if (phoneReason.trim().length < 5) {
      toast.error("Please provide a reason (at least 5 characters)");
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

      toast.success("Phone change request submitted to admin for approval!");
      setRequestedPhone("");
      setPhoneReason("");
      await fetchPhoneRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <User className="h-3.5 w-3.5 text-primary" />
            Edit Profile & Security
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Account & Security Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage your personal details, update password, and view active logged-in devices.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as typeof activeTab)}
          className="w-full mt-2"
        >
          <TabsList className="grid grid-cols-4 w-full text-xs">
            <TabsTrigger value="profile" className="gap-1 px-1 text-[11px] sm:text-xs">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-1 px-1 text-[11px] sm:text-xs">
              <Key className="h-3.5 w-3.5" />
              Password
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1 px-1 text-[11px] sm:text-xs">
              <Laptop className="h-3.5 w-3.5" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="phone" className="gap-1 px-1 text-[11px] sm:text-xs">
              <Phone className="h-3.5 w-3.5" />
              Phone Req
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROFILE DETAILS */}
          <TabsContent value="profile" className="space-y-4 pt-3">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Email Address
                  </Label>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 bg-muted text-muted-foreground border-border/80"
                  >
                    <Lock className="h-2.5 w-2.5" />
                    Locked
                  </Badge>
                </div>
                <Input
                  value={profile?.email || ""}
                  disabled
                  readOnly
                  className="bg-muted/50 text-muted-foreground cursor-not-allowed text-sm font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Your email address is permanent and used for identity verification.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    M-Pesa Phone Number
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary font-medium"
                    onClick={() => setActiveTab("phone")}
                  >
                    Request Change
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    value={profile?.phone || "—"}
                    disabled
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed text-sm font-mono pr-20"
                  />
                  <Badge
                    variant="outline"
                    className="absolute right-2 top-2 text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  >
                    <Lock className="h-2.5 w-2.5" />
                    Admin Locked
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Phone numbers are locked to prevent fraud. Click "Request Change" to submit an
                  admin request.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="firstName"
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="lastName"
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="idNumber"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  National ID Number
                </Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Enter 6-10 digit National ID"
                  required
                  className="text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used for credit checks and borrower verification.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={profileLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={profileLoading} className="gap-2">
                  {profileLoading ? (
                    <>
                      <LucideLoader className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Details
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* TAB 2: CHANGE PASSWORD */}
          <TabsContent value="password" className="space-y-4 pt-3">
            <form onSubmit={handleChangePassword} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label
                  htmlFor="currentPassword"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  name="user_current_password_input"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="newPassword"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  name="user_new_password_input"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="user_confirm_password_input"
                  type="password"
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="text-sm"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                After changing your password, your active login session will remain active on this
                device.
              </p>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={passwordLoading}
                  className="gap-2 w-full sm:w-auto"
                >
                  {passwordLoading ? (
                    <>
                      <LucideLoader className="h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* TAB 3: LOGGED IN DEVICES */}
          <TabsContent value="sessions" className="space-y-4 pt-3">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h4 className="text-xs font-semibold">Active Sessions & Devices</h4>
                <p className="text-[11px] text-muted-foreground">
                  Devices currently signed into your account.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleRevokeAllOtherSessions}
                disabled={sessionsLoading || sessions.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
                Sign Out Others
              </Button>
            </div>

            {sessionsLoading ? (
              <div className="flex justify-center py-8">
                <LucideLoader className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                No active device logs recorded yet. Your current session is active.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-65 overflow-y-auto pr-1">
                {sessions.map((sess, idx) => {
                  const isCurrent = idx === 0;
                  return (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-medium">
                          {sess.deviceInfo.includes("Mobile") ? (
                            <Smartphone className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Laptop className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span>{sess.deviceInfo}</span>
                          {isCurrent && (
                            <Badge
                              variant="default"
                              className="text-[9px] py-0 px-1.5 bg-emerald-600"
                            >
                              Current Device
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          IP: {sess.ipAddress} • Last active:{" "}
                          {new Date(sess.lastActiveAt).toLocaleString()}
                        </p>
                      </div>

                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevokeSession(sess.id)}
                          disabled={revokingId === sess.id}
                        >
                          {revokingId === sess.id ? (
                            <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Revoke"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: REQUEST PHONE NUMBER CHANGE */}
          <TabsContent value="phone" className="space-y-4 pt-3">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                Phone Number Security Rule
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                To safeguard loans and M-Pesa payouts, borrowers cannot directly edit their phone
                numbers. Submit a change request below with a valid reason. An administrator will
                review and update it.
              </p>
            </div>

            <form onSubmit={handlePhoneRequestSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reqPhone" className="text-xs font-semibold">
                  New M-Pesa Phone Number
                </Label>
                <Input
                  id="reqPhone"
                  placeholder="e.g. 254712345678"
                  value={requestedPhone}
                  onChange={(e) => setRequestedPhone(e.target.value)}
                  required
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Format: 2547XXXXXXXX or 2541XXXXXXXX
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reqReason" className="text-xs font-semibold">
                  Reason for Change
                </Label>
                <Textarea
                  id="reqReason"
                  placeholder="Explain why you need to update your M-Pesa phone number (e.g. Lost SIM card, switched Safaricom line)..."
                  value={phoneReason}
                  onChange={(e) => setPhoneReason(e.target.value)}
                  required
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <Button type="submit" size="sm" disabled={phoneLoading} className="gap-2 w-full">
                {phoneLoading ? (
                  <>
                    <LucideLoader className="h-4 w-4 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Request to Admin
                  </>
                )}
              </Button>
            </form>

            {/* Previous Requests History */}
            {phoneRequests.length > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <h5 className="text-xs font-semibold">Your Phone Change History</h5>
                <div className="space-y-2 max-h-35 overflow-y-auto pr-1">
                  {phoneRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-md border border-border/60 bg-muted/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">
                          {req.currentPhone} → {req.requestedPhone}
                        </span>
                        {req.status === "pending" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 text-amber-600 border-amber-500/30"
                          >
                            <Clock className="h-2.5 w-2.5" /> Pending
                          </Badge>
                        )}
                        {req.status === "approved" && (
                          <Badge variant="default" className="text-[10px] gap-1 bg-emerald-600">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Approved
                          </Badge>
                        )}
                        {req.status === "rejected" && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <XCircle className="h-2.5 w-2.5" /> Declined
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{req.reason}</p>
                      {req.rejectionReason && (
                        <p className="text-[10px] text-destructive">
                          Admin Note: {req.rejectionReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
