import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  LucideLoader,
  Lock,
  UserCog,
  Smartphone,
  Mail,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeSetup, getSetupStatus } from "@/lib/account.functions";
import { setupSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/format";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Business Setup & Initial Admin Configuration" },
      {
        name: "description",
        content:
          "One-time setup wizard: create the super administrator and configure optional M-Pesa Daraja, SMTP email, and operational policies.",
      },
      { property: "og:title", content: "Business Setup & Initial Admin Configuration" },
      {
        property: "og:description",
        content: "Create the first admin and configure your lending platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

type SetupField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "password"
  | "businessName"
  | "businessLocation"
  | "supportEmail"
  | "supportPhone"
  | "darajaConsumerKey"
  | "darajaConsumerSecret"
  | "darajaPasskey"
  | "darajaInitiatorName"
  | "darajaSecurityCredential"
  | "mpesaShortcode"
  | "mpesaAccountNumber"
  | "mpesaCallbackUrl"
  | "smtpHost"
  | "smtpPort"
  | "smtpUser"
  | "smtpPass"
  | "smtpFromEmail"
  | "smtpFromName";

type SetupErrors = Partial<Record<SetupField, string>>;

const requiredStepFields: Record<number, SetupField[]> = {
  0: ["firstName", "lastName", "email", "phone", "password"],
  1: ["businessName", "businessLocation", "supportEmail", "supportPhone"],
};

const steps = [
  {
    title: "Super Administrator",
    shortTitle: "Admin",
    description: "Create the primary administrator account for the console",
    icon: UserCog,
    optional: false,
  },
  {
    title: "Business Profile",
    shortTitle: "Business",
    description: "Organization details and borrower contact info",
    icon: Building2,
    optional: false,
  },
  {
    title: "M-Pesa / Daraja API",
    shortTitle: "M-Pesa API",
    description: "Safaricom keys for automated STK pushes and disbursements",
    icon: Smartphone,
    optional: true,
  },
  {
    title: "SMTP Email Service",
    shortTitle: "SMTP Email",
    description: "Transactional email for notifications, 2FA codes, and receipts",
    icon: Mail,
    optional: true,
  },
  {
    title: "Operational Rules",
    shortTitle: "System Rules",
    description: "Guarantor requirements, concurrent loan limits, and security",
    icon: ShieldCheck,
    optional: true,
  },
];

function SetupPage() {
  const statusFn = useServerFn(getSetupStatus);
  const submitSetup = useServerFn(completeSetup);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => statusFn(),
  });

  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [errors, setErrors] = useState<SetupErrors>({});

  const [values, setValues] = useState({
    // 0. Admin
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    // 1. Business
    businessName: "",
    businessLocation: "",
    supportEmail: "",
    supportPhone: "",
    // 2. Daraja (Optional)
    mpesaEnvironment: "sandbox" as "sandbox" | "production",
    darajaConsumerKey: "",
    darajaConsumerSecret: "",
    darajaPasskey: "",
    darajaInitiatorName: "",
    darajaSecurityCredential: "",
    mpesaShortcode: "",
    mpesaAccountNumber: "",
    mpesaCallbackUrl: "",
    // 3. SMTP (Optional)
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFromEmail: "",
    smtpFromName: "",
    smtpSecure: false,
    // 4. Rules (Optional)
    requireGuarantorsForLoans: true,
    autoRejectIfDefaulted: true,
    maxActiveLoansPerBorrower: 1,
    enable2faByEmail: false,
    allowActivationWithoutDisbursement: false,
    lockDarajaConfig: false,
    lockSmtpConfig: false,
    lockLandingEditMode: false,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(fields: SetupField[]) {
    const payload = {
      ...values,
      phone: normalizePhone(values.phone),
    };
    const result = setupSchema.safeParse(payload);
    if (result.success) return {};
    const relevant: SetupErrors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "") as SetupField;
      if (fields.includes(key)) {
        relevant[key] = issue.message;
      }
    }
    return relevant;
  }

  function validateAllRequired(): boolean {
    const allReqFields = [...requiredStepFields[0]!, ...requiredStepFields[1]!];
    const found = validate(allReqFields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // jump to the first step with error
      const step0Error = requiredStepFields[0]?.some((k) => found[k]);
      if (step0Error) {
        setStep(0);
      } else {
        setStep(1);
      }
      toast.error("Please fill in the required fields highlighted");
      return false;
    }
    return true;
  }

  function next() {
    const fieldsToValidate = requiredStepFields[step] ?? [];
    if (fieldsToValidate.length > 0) {
      const found = validate(fieldsToValidate);
      setErrors(found);
      if (Object.keys(found).length > 0) {
        toast.error("Please complete the required fields");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function skipStep() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
      toast.info(`Skipped ${steps[step]?.shortTitle}. You can configure this later in Settings.`);
    } else {
      void submit();
    }
  }

  async function submit() {
    if (!validateAllRequired()) return;

    setPending(true);
    try {
      const normalizedPayload = {
        ...values,
        phone: normalizePhone(values.phone),
        // Ensure empty strings for optional URL or email if not provided
        supportEmail: values.supportEmail?.trim() || undefined,
        supportPhone: values.supportPhone?.trim() || undefined,
        smtpFromEmail: values.smtpFromEmail?.trim() || undefined,
        mpesaCallbackUrl: values.mpesaCallbackUrl?.trim() || undefined,
      };

      const parsed = setupSchema.parse(normalizedPayload);
      const result = await submitSetup({
        data: parsed,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("mikopo_cached_business_config");
        } catch {
          // ignore cache clearing failure
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-rules"] });
      await queryClient.invalidateQueries({ queryKey: ["daraja-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-smtp-settings"] });

      toast.success("Platform setup completed successfully! Sign in to enter the Admin Console.");
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Setup failed. Please check the values.",
      );
    } finally {
      setPending(false);
    }
  }

  const handleFillDarajaSandbox = () => {
    setValues((prev) => ({
      ...prev,
      mpesaEnvironment: "sandbox",
      darajaInitiatorName: prev.darajaInitiatorName || "testapi",
      mpesaShortcode: prev.mpesaShortcode || "174379",
      mpesaAccountNumber: prev.mpesaAccountNumber || "174379",
      mpesaCallbackUrl: prev.mpesaCallbackUrl || currentOrigin || "",
    }));
    toast.success("Sandbox defaults populated (Shortcode 174379, testapi)");
  };

  const handleUseCurrentOriginUrl = () => {
    if (currentOrigin) {
      set("mpesaCallbackUrl", currentOrigin);
      toast.success(`Callback URL set to ${currentOrigin}`);
    }
  };

  const handlePresetGmail = () => {
    setValues((prev) => ({
      ...prev,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpFromName: prev.smtpFromName || prev.businessName || "Mikopo Support",
    }));
    toast.success("Gmail SMTP preset applied (smtp.gmail.com:587)");
  };

  const handlePresetOutlook = () => {
    setValues((prev) => ({
      ...prev,
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpFromName: prev.smtpFromName || prev.businessName || "Mikopo Support",
    }));
    toast.success("Outlook SMTP preset applied (smtp.office365.com:587)");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LucideLoader className="size-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (status?.locked) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md border-border/70 shadow-soft">
          <CardHeader>
            <Lock className="size-5 text-primary" aria-hidden />
            <CardTitle className="pt-3">Setup already completed</CardTitle>
            <CardDescription>
              An administrator has already been created for this business. Setup is a one-time
              process — sign in with the administrator account to manage business or API settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="hero" asChild>
              <Link to="/auth">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = steps[step]!;
  const progressPercent = ((step + 1) / steps.length) * 100;
  const canDirectSubmit = step >= 1; // Can complete from step 1 onward

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <BrandMark />
        </div>

        <div className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight">Setup Wizard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure your initial super administrator, business details, and optional service
            integrations. All optional steps can be skipped and configured later from the Admin
            Console.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {step + 1} of {steps.length}:{" "}
              <strong className="text-foreground">{current.title}</strong>
            </span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
          <Progress value={progressPercent} aria-label="Setup progress" className="h-2" />

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {steps.map((item, index) => {
              const isDone = index < step;
              const isCurrent = index === step;
              const Icon = item.icon;

              return (
                <li
                  key={item.title}
                  onClick={() => {
                    // Allow jumping back or jumping to completed/optional steps if basic validation passes
                    if (index < step) {
                      setStep(index);
                    } else if (index > step && step >= 1) {
                      setStep(index);
                    }
                  }}
                  className={`text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? "text-primary font-medium"
                      : isDone
                        ? "text-foreground"
                        : "text-muted-foreground opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 text-success" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                      <span className="font-semibold">
                        {index + 1}. {item.shortTitle}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Active Step Card */}
        <Card className="mt-6 border-border/70 shadow-soft">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <current.icon className="size-5 text-primary" />
                  {current.title}
                </CardTitle>
                <CardDescription className="mt-1">{current.description}</CardDescription>
              </div>
              <div>
                {current.optional ? (
                  <Badge variant="secondary" className="font-normal text-xs">
                    Optional Step (Can be skipped)
                  </Badge>
                ) : (
                  <Badge variant="default" className="font-normal text-xs">
                    Required Step
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* STEP 0: SUPER ADMINISTRATOR */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground">
                  <strong className="text-foreground">Primary Super Admin:</strong> This account
                  will have unrestricted administrative privileges to manage all loans, products,
                  users, settings, and staff credentials.
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="firstName"
                    label="First Name"
                    value={values.firstName}
                    error={errors.firstName}
                    onChange={(v) => set("firstName", v)}
                    placeholder="e.g. John"
                    required
                  />
                  <SetupField
                    id="lastName"
                    label="Last Name"
                    value={values.lastName}
                    error={errors.lastName}
                    onChange={(v) => set("lastName", v)}
                    placeholder="e.g. Kamau"
                    required
                  />
                </div>

                <SetupField
                  id="email"
                  label="Admin Email Address"
                  type="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(v) => set("email", v)}
                  placeholder="admin@yourbusiness.co.ke"
                  required
                />

                <SetupField
                  id="phone"
                  label="Admin Phone Number (M-Pesa Format)"
                  placeholder="2547XXXXXXXX or 2541XXXXXXXX"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(v) => set("phone", v)}
                  required
                />

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={values.password}
                      placeholder="Minimum 8 characters"
                      aria-invalid={Boolean(errors.password)}
                      onChange={(e) => set("password", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Use a secure password with at least 8 characters.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: BUSINESS PROFILE */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs text-muted-foreground">
                  <strong className="text-foreground">Public Branding:</strong> These details appear
                  across borrower loan contracts, SMS/email notifications, receipts, and public
                  landing pages.
                </div>

                <SetupField
                  id="businessName"
                  label="Business / Platform Name"
                  placeholder="e.g. Mikopo Quick Loans"
                  value={values.businessName}
                  error={errors.businessName}
                  onChange={(v) => set("businessName", v)}
                  required
                />

                <SetupField
                  id="businessLocation"
                  label="Physical Business Location / City"
                  placeholder="e.g. Nairobi, Kenya"
                  value={values.businessLocation}
                  error={errors.businessLocation}
                  onChange={(v) => set("businessLocation", v)}
                  required
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="supportEmail"
                    label="Customer Support Email (Optional)"
                    type="email"
                    placeholder="support@yourbusiness.co.ke"
                    value={values.supportEmail}
                    error={errors.supportEmail}
                    onChange={(v) => set("supportEmail", v)}
                  />
                  <SetupField
                    id="supportPhone"
                    label="Customer Support Phone (Optional)"
                    placeholder="254700000000"
                    value={values.supportPhone}
                    error={errors.supportPhone}
                    onChange={(v) => set("supportPhone", v)}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: DARAJA M-PESA CREDENTIALS (OPTIONAL) */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 p-3.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Safaricom Daraja Gateway
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Used for automated STK push borrower repayments and B2C instant disbursements.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillDarajaSandbox}
                    className="shrink-0 gap-1.5 text-xs h-8"
                  >
                    <Sparkles className="size-3 text-amber-500" />
                    Fill Sandbox Defaults
                  </Button>
                </div>

                {/* Environment Mode Switch */}
                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="envSwitch" className="text-sm font-medium cursor-pointer">
                        Production Mode
                      </Label>
                      <Badge
                        variant={values.mpesaEnvironment === "production" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {values.mpesaEnvironment === "production"
                          ? "Live Safaricom Network"
                          : "Sandbox Simulator"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Switch ON for live M-Pesa business Paybill/Till transactions.
                    </p>
                  </div>
                  <Switch
                    id="envSwitch"
                    checked={values.mpesaEnvironment === "production"}
                    onCheckedChange={(checked) =>
                      set("mpesaEnvironment", checked ? "production" : "sandbox")
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="mpesaShortcode"
                    label="M-Pesa Shortcode / Paybill"
                    placeholder="e.g. 174379 (Sandbox) or 600XXX"
                    value={values.mpesaShortcode}
                    error={errors.mpesaShortcode}
                    onChange={(v) => set("mpesaShortcode", v)}
                  />
                  <SetupField
                    id="mpesaAccountNumber"
                    label="Account Reference / Till"
                    placeholder="e.g. MIKOPO or 174379"
                    value={values.mpesaAccountNumber}
                    error={errors.mpesaAccountNumber}
                    onChange={(v) => set("mpesaAccountNumber", v)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="darajaConsumerKey"
                    label="Consumer Key"
                    placeholder="From Daraja Developer Portal"
                    value={values.darajaConsumerKey}
                    onChange={(v) => set("darajaConsumerKey", v)}
                  />
                  <SetupField
                    id="darajaConsumerSecret"
                    label="Consumer Secret"
                    type="password"
                    placeholder="From Daraja Developer Portal"
                    value={values.darajaConsumerSecret}
                    onChange={(v) => set("darajaConsumerSecret", v)}
                  />
                </div>

                <SetupField
                  id="darajaPasskey"
                  label="Lipa Na M-Pesa Online Passkey"
                  type="password"
                  placeholder="Online passkey for STK push requests"
                  value={values.darajaPasskey}
                  onChange={(v) => set("darajaPasskey", v)}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="darajaInitiatorName"
                    label="B2C Initiator Name"
                    placeholder="e.g. testapi or admin"
                    value={values.darajaInitiatorName}
                    onChange={(v) => set("darajaInitiatorName", v)}
                  />
                  <SetupField
                    id="darajaSecurityCredential"
                    label="B2C Security Credential"
                    type="password"
                    placeholder="Encrypted certificate credential"
                    value={values.darajaSecurityCredential}
                    onChange={(v) => set("darajaSecurityCredential", v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mpesaCallbackUrl">Public Callback Base URL</Label>
                    {currentOrigin && (
                      <button
                        type="button"
                        onClick={handleUseCurrentOriginUrl}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="size-3" />
                        Use current domain
                      </button>
                    )}
                  </div>
                  <Input
                    id="mpesaCallbackUrl"
                    value={values.mpesaCallbackUrl}
                    placeholder={currentOrigin || "https://yourdomain.com"}
                    onChange={(e) => set("mpesaCallbackUrl", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Base URL where Safaricom will send STK and B2C webhook responses.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3: SMTP EMAIL SERVICE (OPTIONAL) */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 p-3.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Transactional Email Server
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sends automated notifications for loan status updates, overdue reminders, and
                      2FA login verification codes.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePresetGmail}
                      className="text-xs h-8"
                    >
                      Gmail Preset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePresetOutlook}
                      className="text-xs h-8"
                    >
                      Outlook Preset
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <SetupField
                      id="smtpHost"
                      label="SMTP Server Host"
                      placeholder="e.g. smtp.gmail.com or smtp.mailgun.org"
                      value={values.smtpHost}
                      onChange={(v) => set("smtpHost", v)}
                    />
                  </div>
                  <SetupField
                    id="smtpPort"
                    label="SMTP Port"
                    type="number"
                    placeholder="587"
                    value={String(values.smtpPort)}
                    onChange={(v) => set("smtpPort", Number(v) || 587)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="smtpUser"
                    label="SMTP Username / Email"
                    placeholder="e.g. alerts@yourbusiness.co.ke"
                    value={values.smtpUser}
                    onChange={(v) => set("smtpUser", v)}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="smtpPass">SMTP Password / App Password</Label>
                    <div className="relative">
                      <Input
                        id="smtpPass"
                        type={showSmtpPass ? "text" : "password"}
                        value={values.smtpPass}
                        placeholder="••••••••••••"
                        onChange={(e) => set("smtpPass", e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                        aria-label={showSmtpPass ? "Hide password" : "Show password"}
                      >
                        {showSmtpPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="smtpFromEmail"
                    label="From Email Address"
                    type="email"
                    placeholder="e.g. no-reply@yourbusiness.co.ke"
                    value={values.smtpFromEmail}
                    onChange={(v) => set("smtpFromEmail", v)}
                  />
                  <SetupField
                    id="smtpFromName"
                    label="From Sender Display Name"
                    placeholder={values.businessName || "Mikopo Lending"}
                    value={values.smtpFromName}
                    onChange={(v) => set("smtpFromName", v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3.5">
                  <div className="space-y-0.5">
                    <Label htmlFor="smtpSecure" className="text-sm font-medium cursor-pointer">
                      Use SSL/TLS Direct Encryption (Port 465)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Leave OFF for STARTTLS (Port 587). Turn ON only if your server requires direct
                      SSL.
                    </p>
                  </div>
                  <Switch
                    id="smtpSecure"
                    checked={values.smtpSecure}
                    onCheckedChange={(checked) => set("smtpSecure", checked)}
                  />
                </div>
              </div>
            )}

            {/* STEP 4: OPERATIONAL RULES & POLICIES (OPTIONAL) */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs text-muted-foreground">
                  <strong className="text-foreground">Default Lending Controls:</strong> You can
                  fine-tune or adjust any of these rules later in the Admin Rules & Settings
                  dashboard.
                </div>

                <div className="space-y-3">
                  {/* Require Guarantors */}
                  <div className="flex items-center justify-between rounded-lg border border-border/70 p-3.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="reqGuarantors" className="text-sm font-medium cursor-pointer">
                        Require Guarantors for Loan Applications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, borrowers must supply and verify guarantors before the loan is
                        approved and disbursed.
                      </p>
                    </div>
                    <Switch
                      id="reqGuarantors"
                      checked={values.requireGuarantorsForLoans}
                      onCheckedChange={(checked) => set("requireGuarantorsForLoans", checked)}
                    />
                  </div>

                  {/* Auto-Reject Defaulted */}
                  <div className="flex items-center justify-between rounded-lg border border-border/70 p-3.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="autoReject" className="text-sm font-medium cursor-pointer">
                        Auto-Block Defaulters
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically block new loan requests if the borrower currently has an
                        active defaulted loan.
                      </p>
                    </div>
                    <Switch
                      id="autoReject"
                      checked={values.autoRejectIfDefaulted}
                      onCheckedChange={(checked) => set("autoRejectIfDefaulted", checked)}
                    />
                  </div>

                  {/* Max Active Loans */}
                  <div className="flex items-center justify-between rounded-lg border border-border/70 p-3.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="maxLoans" className="text-sm font-medium">
                        Max Concurrent Active Loans Per Borrower
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Limit how many active loans a single borrower can service simultaneously.
                      </p>
                    </div>
                    <div className="w-28">
                      <Select
                        value={String(values.maxActiveLoansPerBorrower)}
                        onValueChange={(v) => set("maxActiveLoansPerBorrower", Number(v))}
                      >
                        <SelectTrigger id="maxLoans" className="h-9">
                          <SelectValue placeholder="1 loan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Active Loan</SelectItem>
                          <SelectItem value="2">2 Active Loans</SelectItem>
                          <SelectItem value="3">3 Active Loans</SelectItem>
                          <SelectItem value="5">5 Active Loans</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Email 2FA */}
                  <div className="flex items-center justify-between rounded-lg border border-border/70 p-3.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="enable2fa" className="text-sm font-medium cursor-pointer">
                        Email Two-Factor Authentication (2FA)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Require staff and administrators to enter a 6-digit email OTP verification
                        code at login (requires SMTP).
                      </p>
                    </div>
                    <Switch
                      id="enable2fa"
                      checked={values.enable2faByEmail}
                      onCheckedChange={(checked) => set("enable2faByEmail", checked)}
                    />
                  </div>

                  {/* Allow Activation without Disbursement */}
                  <div className="flex items-center justify-between rounded-lg border border-border/70 p-3.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="allowManual" className="text-sm font-medium cursor-pointer">
                        Permit Manual / Offline Disbursements
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow administrators to mark loans as disbursed manually without requiring
                        an automated Daraja B2C callback.
                      </p>
                    </div>
                    <Switch
                      id="allowManual"
                      checked={values.allowActivationWithoutDisbursement}
                      onCheckedChange={(checked) =>
                        set("allowActivationWithoutDisbursement", checked)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wizard Action Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || pending}
              className="gap-1 flex-1 sm:flex-none"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>

            {current.optional && (
              <Button
                variant="ghost"
                onClick={skipStep}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-foreground flex-1 sm:flex-none"
              >
                Skip this step
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Direct finish option available from step 1 onward */}
            {canDirectSubmit && step < steps.length - 1 && (
              <Button
                variant="secondary"
                onClick={() => void submit()}
                disabled={pending}
                className="text-xs flex-1 sm:flex-none"
              >
                {pending && <LucideLoader className="animate-spin size-3.5 mr-1" />}
                Complete & Finish
              </Button>
            )}

            {step < steps.length - 1 ? (
              <Button
                variant="hero"
                size="default"
                onClick={next}
                disabled={pending}
                className="gap-1 flex-1 sm:flex-none"
              >
                Continue
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="hero"
                size="default"
                onClick={() => void submit()}
                disabled={pending}
                className="gap-1.5 flex-1 sm:flex-none"
              >
                {pending ? (
                  <LucideLoader className="animate-spin size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Finish Setup & Enter Console
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const _searchSchemaUnused = z.object({});
