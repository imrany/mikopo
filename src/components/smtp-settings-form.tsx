import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Clock, Lock, Mail, Send, Server, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LexicalRichEditor } from "@/components/lexical-editor";
import {
  deleteAdminSubscriber,
  getAdminSmtpSettings,
  listAdminSubscribers,
  saveAdminSmtpSettings,
  sendAdminBroadcastEmail,
  testAdminSmtpConnection,
} from "@/lib/admin-email.functions";
import { getAdminRules, listAdminUsers } from "@/lib/admin.functions";
import { triggerDueRemindersNow } from "@/lib/notifications.functions";
import { Badge } from "./ui/badge";

type UserItem = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type SubscriberItem = {
  id: string;
  email: string;
  created_at: string;
};

export function SmtpSettingsForm() {
  const getSmtpFn = useServerFn(getAdminSmtpSettings);
  const saveSmtpFn = useServerFn(saveAdminSmtpSettings);
  const testSmtpFn = useServerFn(testAdminSmtpConnection);
  const broadcastFn = useServerFn(sendAdminBroadcastEmail);
  const listSubsFn = useServerFn(listAdminSubscribers);
  const deleteSubFn = useServerFn(deleteAdminSubscriber);
  const listUsersFn = useServerFn(listAdminUsers);
  const triggerRemindersFn = useServerFn(triggerDueRemindersNow);
  const rulesFn = useServerFn(getAdminRules);

  const { data: rulesData } = useQuery({
    queryKey: ["admin-rules"],
    queryFn: () => rulesFn(),
  });

  const isSmtpLocked = Boolean(rulesData?.lockSmtpConfig);

  // SMTP Form State
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [smtpStatusMsg, setSmtpStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Broadcast Form State
  const [targetGroup, setTargetGroup] = useState<
    "all_users" | "specific_user" | "newsletter_subscribers" | "all_including_subscribers"
  >("all_users");
  const [specificUserId, setSpecificUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendInApp, setSendInApp] = useState(true);

  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Users & Subscribers Data
  const [users, setUsers] = useState<UserItem[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [reminding, setReminding] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const smtp = await getSmtpFn();
        setSmtpHost(smtp.smtpHost);
        setSmtpPort(smtp.smtpPort);
        setSmtpUser(smtp.smtpUser);
        setHasPassword(smtp.hasPassword);
        setSmtpFromEmail(smtp.smtpFromEmail);
        setSmtpFromName(smtp.smtpFromName);
        setSmtpSecure(smtp.smtpSecure);

        const uList = await listUsersFn();
        setUsers(
          uList.map((u: any) => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
          })),
        );

        const sList = await listSubsFn();
        setSubscribers(sList);
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSmtpStatusMsg(null);
    try {
      const res = await saveSmtpFn({
        data: {
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPass: smtpPass || undefined,
          smtpFromEmail,
          smtpFromName,
          smtpSecure,
        },
      });
      setSmtpStatusMsg({ type: "success", text: res.message });
      if (smtpPass) {
        setHasPassword(true);
        setSmtpPass("");
      }
    } catch (err) {
      setSmtpStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save SMTP settings",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSmtp() {
    if (!testRecipient) {
      setSmtpStatusMsg({
        type: "error",
        text: "Please enter a recipient email address for testing.",
      });
      return;
    }
    setTesting(true);
    setSmtpStatusMsg(null);
    try {
      const res = await testSmtpFn({ data: { recipientEmail: testRecipient } });
      setSmtpStatusMsg({ type: "success", text: res.message });
    } catch (err) {
      setSmtpStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Test email failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await broadcastFn({
        data: {
          target: targetGroup,
          specificUserId: specificUserId || undefined,
          subject,
          message,
          sendInAppNotification: sendInApp,
        },
      });
      setBroadcastResult(res.message);
      setSubject("");
      setMessage("");
    } catch (err) {
      setBroadcastResult(err instanceof Error ? err.message : "Broadcast failed.");
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleDeleteSubscriber(id: string) {
    try {
      await deleteSubFn({ data: { id } });
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTriggerReminders() {
    setReminding(true);
    setReminderResult(null);
    try {
      const res = await triggerRemindersFn();
      setReminderResult(
        `Scanned ${res.scanned} active loans. Sent ${res.remindersSent} payment due reminder emails & in-app notifications.`,
      );
    } catch (err) {
      setReminderResult(err instanceof Error ? err.message : "Trigger failed.");
    } finally {
      setReminding(false);
    }
  }

  return (
    <div className="space-y-8 mt-8">
      {/* 1. SMTP Server Configuration */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <div className="flex flex-col items-start justify-center gap-2">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">SMTP Server Setup</CardTitle>
              </div>
              <div>
                <CardDescription>
                  Configure host, credentials, and sender profile to enable automated emails.
                </CardDescription>
              </div>
            </div>
            {isSmtpLocked && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="size-3" />
                Locked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveSmtp} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host Address</Label>
                <Input
                  id="smtpHost"
                  disabled={isSmtpLocked}
                  placeholder="e.g. smtp.gmail.com or mail.yourdomain.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPort">Port Number</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  disabled={isSmtpLocked}
                  placeholder="587 or 465"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">SMTP Username / Login Email</Label>
                <Input
                  id="smtpUser"
                  placeholder="e.g. notifications@yourdomain.com"
                  disabled={isSmtpLocked}
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPass">
                  SMTP Password{" "}
                  {hasPassword && <span className="text-primary text-xs">(Password Saved)</span>}
                </Label>
                <Input
                  id="smtpPass"
                  type="password"
                  disabled={isSmtpLocked}
                  placeholder={
                    hasPassword
                      ? "Leave blank to keep existing password"
                      : "Enter SMTP password or App Password"
                  }
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpFromEmail">From Email Address</Label>
                <Input
                  id="smtpFromEmail"
                  type="email"
                  disabled={isSmtpLocked}
                  placeholder="support@yourdomain.com"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpFromName">From Name (Sender Title)</Label>
                <Input
                  id="smtpFromName"
                  placeholder="e.g. Customer Support"
                  disabled={isSmtpLocked}
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="smtpSecure"
                disabled={isSmtpLocked}
                checked={smtpSecure}
                onCheckedChange={(c) => setSmtpSecure(Boolean(c))}
              />
              <Label htmlFor="smtpSecure" className="text-sm cursor-pointer">
                Use Secure Transport (SSL/TLS for Port 465)
              </Label>
            </div>

            {smtpStatusMsg && (
              <div
                className={`p-3 rounded-lg text-sm border ${
                  smtpStatusMsg.type === "success"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                {smtpStatusMsg.text}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="email"
                  placeholder="Test recipient email..."
                  value={testRecipient}
                  disabled={isSmtpLocked}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full sm:w-64 h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSmtp}
                  disabled={testing || isSmtpLocked}
                  className="h-9 text-xs shrink-0"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  {testing ? "Testing..." : "Send Test Email"}
                </Button>
              </div>

              <Button
                type="submit"
                disabled={saving || isSmtpLocked}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              >
                {saving
                  ? "Saving Settings..."
                  : isSmtpLocked
                    ? "Settings Locked by Admin Rules"
                    : "Save SMTP Credentials"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Automated Loan Due Reminders Control */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col items-start justify-center gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Automated Loan Payment Reminders</CardTitle>
            </div>
            <CardDescription>
              Scan active loans due tomorrow or overdue and send email & in-app alerts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            The system automatically scans active loans and sends notifications 24 hours before
            payment deadline and for overdue balances. You can also trigger a manual scan right now.
          </p>

          {reminderResult && (
            <div className="p-3 bg-primary-50 border border-primary-200 text-primary-900 rounded-lg text-sm">
              {reminderResult}
            </div>
          )}

          <Button
            type="button"
            onClick={handleTriggerReminders}
            disabled={reminding}
            variant="outline"
            className="border-amber-300 bg-amber-50/50 hover:bg-amber-100 text-amber-900 gap-2"
          >
            <BellRing className="h-4 w-4 text-amber-600" />
            {reminding ? "Scanning Loans..." : "Run Due Reminders Now"}
          </Button>
        </CardContent>
      </Card>

      {/* 3. Send Email Broadcast / Announcements */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col items-start justify-center gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Send Email Broadcast & New Updates</CardTitle>
            </div>
            <CardDescription>
              Send updates, new loan tier alerts, or direct messages to specific users or all
              subscribers.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSendBroadcast} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Recipient Audience Target</Label>
                <Select
                  value={targetGroup}
                  onValueChange={(val) => setTargetGroup(val as typeof targetGroup)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_users">All Active Members ({users.length})</SelectItem>
                    <SelectItem value="specific_user">Specific Member</SelectItem>
                    <SelectItem value="newsletter_subscribers">
                      Newsletter Subscribers ({subscribers.length})
                    </SelectItem>
                    <SelectItem value="all_including_subscribers">
                      All Members + Subscribers
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetGroup === "specific_user" && (
                <div className="space-y-2">
                  <Label>Select Specific Member</Label>
                  <Select value={specificUserId} onValueChange={setSpecificUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subject">Email Subject Title</Label>
                <Input
                  id="subject"
                  placeholder="e.g. Exciting News: New Platinum Loan Tier Available!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="message">Email Content / Update Details</Label>
                <LexicalRichEditor
                  id="message"
                  placeholder="Write your email content or announcement message here..."
                  value={message}
                  mode="html"
                  minHeight="220px"
                  showIconPicker={true}
                  onChange={(val) => setMessage(val)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendInApp"
                checked={sendInApp}
                onCheckedChange={(c) => setSendInApp(Boolean(c))}
              />
              <Label htmlFor="sendInApp" className="text-sm cursor-pointer">
                Also create an in-app notification in member dashboards
              </Label>
            </div>

            {broadcastResult && (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-800">
                {broadcastResult}
              </div>
            )}

            <Button
              type="submit"
              disabled={broadcasting}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {broadcasting ? "Sending Broadcast..." : "Send Email Broadcast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 4. Newsletter Subscribers List */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <div>
              <CardTitle className="text-lg">
                Newsletter & Update Subscribers ({subscribers.length})
              </CardTitle>
              <CardDescription>
                Website visitors and members who subscribed for news and updates.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {subscribers.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No newsletter subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Email Address</TableHead>
                    <TableHead>Subscribed Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-slate-900">{s.email}</TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {new Date(s.created_at).toLocaleDateString("en-KE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSubscriber(s.id)}
                          className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 h-8 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
