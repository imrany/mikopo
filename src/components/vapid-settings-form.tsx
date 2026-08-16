import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LucideLoader,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateAdminVapidKeysFn,
  getAdminVapidSettingsFn,
  saveAdminVapidSettingsFn,
  sendTestWebPushFn,
} from "@/lib/notifications.functions";
import { useWebPush } from "@/hooks/use-web-push";

export function VapidSettingsForm() {
  const getVapidFn = useServerFn(getAdminVapidSettingsFn);
  const saveVapidFn = useServerFn(saveAdminVapidSettingsFn);
  const generateKeysFn = useServerFn(generateAdminVapidKeysFn);
  const sendTestFn = useServerFn(sendTestWebPushFn);

  const { isSubscribed, subscribe } = useWebPush();

  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [totalSubscriptions, setTotalSubscriptions] = useState(0);

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await getVapidFn();
        setPublicKey(res.publicKey);
        setPrivateKey(res.privateKey);
        setSubject(res.subject);
        setTotalSubscriptions(res.totalSubscriptions);
      } catch (err) {
        console.error("Failed to load VAPID settings:", err);
      }
    }
    void loadSettings();
  }, [getVapidFn]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveVapidFn({
        data: { publicKey, privateKey, subject },
      });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save VAPID settings");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKeys = async () => {
    if (
      publicKey &&
      !window.confirm(
        "Are you sure you want to generate a new VAPID keypair? Existing subscribers will need to re-enable push notifications.",
      )
    ) {
      return;
    }

    setGenerating(true);
    try {
      const res = await generateKeysFn();
      setPublicKey(res.publicKey);
      setPrivateKey(res.privateKey);
      toast.success("New VAPID keypair generated and saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate keys");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendTestPush = async () => {
    setTesting(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) return;
      }
      await sendTestFn();
      toast.success("Test Web Push notification sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test push");
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const envSnippet = `VAPID_PUBLIC_KEY="${publicKey}"\nVAPID_PRIVATE_KEY="${privateKey}"\nVAPID_SUBJECT="${subject}"`;

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Web Push & VAPID Key Settings</CardTitle>
                <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                  <Bell className="h-3 w-3 text-primary" /> {totalSubscriptions} Active Push Device
                  {totalSubscriptions === 1 ? "" : "s"}
                </Badge>
              </div>
              <CardDescription>
                Manage VAPID encryption credentials for sending native browser push alerts to users
                and staff.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateKeys}
              disabled={generating}
              className="gap-1.5 text-xs h-9"
            >
              <LucideLoader className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              Generate New Keys
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSendTestPush}
              disabled={testing}
              className="gap-1.5 text-xs h-9"
            >
              <Send className="h-3.5 w-3.5 text-primary" />
              {testing ? "Sending..." : "Test Web Push"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            {/* Public VAPID Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vapidPublicKey" className="font-semibold text-foreground">
                  VAPID Public Key
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(publicKey, "Public Key")}
                  className="h-7 text-xs text-muted-foreground gap-1"
                >
                  {copiedKey === "Public Key" ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy Public Key
                </Button>
              </div>
              <Input
                id="vapidPublicKey"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="Base64url VAPID Public Key..."
                className="font-mono text-xs bg-muted/20"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Public key exposed to client browsers for establishing push subscription handlers.
              </p>
            </div>

            {/* Private VAPID Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vapidPrivateKey" className="font-semibold text-foreground">
                  VAPID Private Key (Secret)
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="h-7 text-xs text-muted-foreground gap-1"
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {showPrivateKey ? "Hide" : "Show"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(privateKey, "Private Key")}
                    className="h-7 text-xs text-muted-foreground gap-1"
                  >
                    {copiedKey === "Private Key" ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>
              <Input
                id="vapidPrivateKey"
                type={showPrivateKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Base64url VAPID Private Key..."
                className="font-mono text-xs bg-muted/20"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Server secret used for signing web push payloads (never shared with client
                browsers).
              </p>
            </div>

            {/* VAPID Subject */}
            <div className="space-y-2">
              <Label htmlFor="vapidSubject" className="font-semibold text-foreground">
                VAPID Contact Subject URL / Email
              </Label>
              <Input
                id="vapidSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="mailto:admin@yourdomain.com or https://yourdomain.com"
                className="text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Sender contact URL or mailto address sent to web push services (FCM, Mozilla,
                Apple).
              </p>
            </div>
          </div>

          {/* Quick .env Export Block */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Environment Variable Configuration (.env)
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(envSnippet, ".env snippet")}
                className="h-6 text-[11px] text-primary gap-1"
              >
                {copiedKey === ".env snippet" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy .env Block
              </Button>
            </div>
            <pre className="text-[11px] font-mono bg-background p-3 rounded-lg border overflow-x-auto text-muted-foreground">
              {envSnippet}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving VAPID Config..." : "Save VAPID Credentials"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
