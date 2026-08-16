import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LucideLoader,
  Lock,
  Save,
  ShieldCheck,
  Copy,
  Check,
  Globe,
  Link as LinkIcon,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAdminRules, getDarajaCredentials, saveDarajaCredentials } from "@/lib/admin.functions";
import { useAppConfig } from "@/lib/config-context";

export function DarajaCredentialsForm() {
  const queryClient = useQueryClient();
  const { notifyConfigChanged } = useAppConfig();
  const fetchFn = useServerFn(getDarajaCredentials);
  const rulesFn = useServerFn(getAdminRules);
  const saveFn = useServerFn(saveDarajaCredentials);

  const { data, isLoading } = useQuery({
    queryKey: ["daraja-credentials"],
    queryFn: () => fetchFn(),
  });

  const { data: rulesData } = useQuery({
    queryKey: ["admin-rules"],
    queryFn: () => rulesFn(),
  });

  const isLocked = Boolean(rulesData?.lockDarajaConfig);

  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [initiatorName, setInitiatorName] = useState("");
  const [securityCredential, setSecurityCredential] = useState("");
  const [mpesaShortcode, setMpesaShortcode] = useState("");
  const [mpesaAccountNumber, setMpesaAccountNumber] = useState("");
  const [mpesaCallbackUrl, setMpesaCallbackUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  if (data && !initialized) {
    setEnvironment(data.environment);
    setConsumerKey(data.consumerKey);
    setConsumerSecret(data.consumerSecret);
    setPasskey(data.passkey);
    setInitiatorName(data.initiatorName);
    setSecurityCredential(data.securityCredential);
    setMpesaShortcode(data.mpesaShortcode ?? "");
    setMpesaAccountNumber(data.mpesaAccountNumber ?? "");
    setMpesaCallbackUrl(data.mpesaCallbackUrl ?? "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          environment,
          consumerKey,
          consumerSecret,
          passkey,
          initiatorName,
          securityCredential,
          mpesaShortcode,
          mpesaAccountNumber,
          mpesaCallbackUrl,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["daraja-credentials"] });
      void queryClient.invalidateQueries({ queryKey: ["daraja-env"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      notifyConfigChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleEnvironmentChange = (checked: boolean) => {
    const nextEnv = checked ? "production" : "sandbox";
    setEnvironment(nextEnv);
    if (!isLocked) {
      saveFn({
        data: {
          environment: nextEnv,
          consumerKey,
          consumerSecret,
          passkey,
          initiatorName,
          securityCredential,
          mpesaShortcode,
          mpesaAccountNumber,
          mpesaCallbackUrl,
        },
      })
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["daraja-credentials"] });
          void queryClient.invalidateQueries({ queryKey: ["daraja-env"] });
          void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
        })
        .catch((err: Error) => toast.error(err.message));
    }
  };

  const effectiveBaseUrl = (mpesaCallbackUrl.trim() || currentOrigin).replace(/\/$/, "");
  const stkCallbackEndpoint = effectiveBaseUrl
    ? `${effectiveBaseUrl}/api/public/mpesa/stk-callback`
    : "";
  const b2cResultEndpoint = effectiveBaseUrl
    ? `${effectiveBaseUrl}/api/public/mpesa/b2c-result`
    : "";

  const handleCopy = (text: string, key: string, _label: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleUseCurrentOrigin = () => {
    if (currentOrigin) {
      setMpesaCallbackUrl(currentOrigin);
    }
  };

  if (isLoading) {
    return (
      <Card className="mt-6 border-border/70 shadow-soft">
        <CardContent className="flex justify-center py-8">
          <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
        </CardContent>
      </Card>
    );
  }

  const isHttp = effectiveBaseUrl.startsWith("http://");

  return (
    <Card className="mt-6 border-border/70 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" aria-hidden />
              Daraja & M-Pesa API Credentials
            </CardTitle>
            <CardDescription>
              Stored securely in database. Configures STK push payments, B2C disbursements, and
              callback endpoints.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {data?.configured ? (
              <Badge variant="default" className="gap-1">
                <ShieldCheck className="size-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="destructive">Not set</Badge>
            )}
            {isLocked && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="size-3" />
                Locked
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (isLocked) return;
            saveMutation.mutate();
          }}
        >
          {/* Environment Switcher */}
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                Production mode
                <Badge
                  variant={environment === "production" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {environment === "production" ? "Live Safaricom Network" : "Sandbox Simulator"}
                </Badge>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Toggle on to use live Safaricom production API endpoints. Toggle off for sandbox
                testing.
              </p>
            </div>
            <Switch
              checked={environment === "production"}
              disabled={isLocked}
              onCheckedChange={handleEnvironmentChange}
            />
          </div>

          {/* Business Channel Inputs */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="mpesaShortcode"
              label="Paybill / Till / Shortcode"
              placeholder="e.g. 174379 or 600000"
              value={mpesaShortcode}
              onChange={setMpesaShortcode}
            />
            <Field
              id="mpesaAccountNumber"
              label="Default Account Number (Optional)"
              placeholder="e.g. LOAN or Borrower ID"
              value={mpesaAccountNumber}
              onChange={setMpesaAccountNumber}
            />
          </div>

          {/* Callback URL Configuration & Live Guide */}
          <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col justify-between gap-2 border-b border-primary/10 pb-3 sm:flex-row sm:items-center">
              <div className="space-y-0.5">
                <Label
                  htmlFor="mpesaCallbackUrl"
                  className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  <Globe className="size-4 text-primary" />
                  M-Pesa Callback Base Domain URL
                </Label>
                <p className="text-xs text-muted-foreground">
                  The base domain (e.g.{" "}
                  <code className="rounded border bg-background px-1 py-0.5 text-[11px]">
                    https://your-domain.com
                  </code>
                  ) used by Safaricom to send asynchronous payment status callbacks.
                </p>
              </div>
              {currentOrigin && currentOrigin !== mpesaCallbackUrl && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLocked}
                  size="sm"
                  onClick={handleUseCurrentOrigin}
                  className="shrink-0 gap-1.5 text-xs bg-background hover:bg-muted"
                >
                  <LinkIcon className="size-3.5 text-primary" />
                  Use Current Site URL
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Input
                id="mpesaCallbackUrl"
                type="url"
                placeholder={`Default: ${currentOrigin || "https://your-app-domain.com"}`}
                value={mpesaCallbackUrl}
                disabled={isLocked}
                onChange={(e) => setMpesaCallbackUrl(e.target.value)}
                className="bg-background font-mono text-xs"
              />
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <HelpCircle className="size-3 text-muted-foreground" />
                If left empty, defaults automatically to{" "}
                <code className="font-mono">{currentOrigin || "current application host"}</code>.
              </p>
            </div>

            {/* HTTP Warning Notice */}
            {!isLocked && isHttp && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="font-semibold">HTTPS Required by Safaricom Daraja:</span>{" "}
                  Safaricom requires callback URLs to use{" "}
                  <code className="font-mono font-bold">https://</code>. Ensure your application is
                  served over HTTPS or use an HTTPS tunnel (e.g. Ngrok) when testing locally.
                </div>
              </div>
            )}

            {/* Configured Callback Endpoints Display */}
            <div className="space-y-2.5 pt-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ArrowUpRight className="size-3.5 text-primary" />
                Active Callback Endpoints Configured in Application:
              </p>

              <div className="grid gap-2">
                {/* STK Push Callback */}
                <div className="flex flex-col justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className="inline-block size-2 rounded-full bg-primary" />
                      STK Push Repayment Callback URL
                    </div>
                    <div className="select-all truncate font-mono text-[11px] text-muted-foreground">
                      {stkCallbackEndpoint || "http://.../api/public/mpesa/stk-callback"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(stkCallbackEndpoint, "stk", "STK Callback URL")}
                    className="h-8 shrink-0 self-start text-xs gap-1 sm:self-center"
                    disabled={!stkCallbackEndpoint}
                  >
                    {copiedKey === "stk" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedKey === "stk" ? "Copied" : "Copy URL"}
                  </Button>
                </div>

                {/* B2C Payout Result Callback */}
                <div className="flex flex-col justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className="inline-block size-2 rounded-full bg-blue-500" />
                      B2C Loan Disbursement Callback URL
                    </div>
                    <div className="select-all truncate font-mono text-[11px] text-muted-foreground">
                      {b2cResultEndpoint || "http://.../api/public/mpesa/b2c-result"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(b2cResultEndpoint, "b2c", "B2C Result URL")}
                    className="h-8 shrink-0 self-start text-xs gap-1 sm:self-center"
                    disabled={!b2cResultEndpoint}
                  >
                    {copiedKey === "b2c" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedKey === "b2c" ? "Copied" : "Copy URL"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Daraja API Keys & Credentials */}
          <div className="grid gap-4 pt-2 md:grid-cols-2">
            <Field
              id="consumerKey"
              label="Consumer Key"
              placeholder="Safaricom Daraja Consumer Key"
              value={consumerKey}
              onChange={setConsumerKey}
              required
            />
            <Field
              id="consumerSecret"
              label="Consumer Secret"
              type="password"
              placeholder="Safaricom Daraja Consumer Secret"
              value={consumerSecret}
              onChange={setConsumerSecret}
              required
            />
            <Field
              id="passkey"
              label="STK Passkey"
              type="password"
              placeholder="Lipa na M-Pesa Online Passkey"
              value={passkey}
              onChange={setPasskey}
              required
            />
            <Field
              id="initiatorName"
              label="Initiator Name (B2C)"
              placeholder="e.g. testapi or B2C Admin Name"
              value={initiatorName}
              onChange={setInitiatorName}
              required
            />
            <div className="md:col-span-2">
              <Field
                id="securityCredential"
                label="Security Credential (B2C Encrypted Password)"
                type="password"
                placeholder="Encrypted B2C Password from Daraja Portal"
                value={securityCredential}
                onChange={setSecurityCredential}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={saveMutation.isPending || isLocked} className="gap-2">
            {saveMutation.isPending ? (
              <LucideLoader className="size-4 animate-spin" />
            ) : isLocked ? (
              <Lock className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {isLocked ? "Settings Locked by Admin Rules" : "Save Daraja Credentials & Callbacks"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="font-mono text-xs"
      />
    </div>
  );
}
