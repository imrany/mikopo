import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, LucideLoader, Lock, UserCog } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
          "One-time setup wizard: create the first administrator and configure your business and M-Pesa payment details.",
      },
      { property: "og:title", content: "Business Setup & Initial Admin Configuration" },
      { property: "og:description", content: "Create the first admin and configure M-Pesa." },
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
  | "supportPhone";

type SetupErrors = Partial<Record<SetupField, string>>;

const stepFields: Record<number, SetupField[]> = {
  0: ["firstName", "lastName", "email", "phone", "password"],
  1: ["businessName", "businessLocation", "supportEmail", "supportPhone"],
};

const steps = [
  { title: "Administrator", description: "Your login for the admin console", icon: UserCog },
  { title: "Business", description: "How borrowers see you", icon: Building2 },
];

function SetupPage() {
  const statusFn = useServerFn(getSetupStatus);
  const submitSetup = useServerFn(completeSetup);
  const navigate = useNavigate();

  const { data: status, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => statusFn(),
  });

  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<SetupErrors>({});
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    businessName: "",
    businessLocation: "",
    supportEmail: "",
    supportPhone: "",
    mpesaShortcode: "",
    mpesaAccountNumber: "",
    mpesaEnvironment: "sandbox" as "sandbox" | "production",
    mpesaCallbackUrl: "",
  });

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(fields: SetupField[]) {
    const payload = { ...values, phone: normalizePhone(values.phone) };
    const result = setupSchema.safeParse(payload);
    if (result.success) return {};
    const relevant: SetupErrors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "") as SetupField;
      if (fields.includes(key)) relevant[key] = issue.message;
    }
    return relevant;
  }

  function next() {
    const found = validate(stepFields[step] ?? []);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, 1));
  }

  async function submit() {
    const found = validate(Object.values(stepFields).flat());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setPending(true);
    try {
      const result = await submitSetup({
        data: setupSchema.parse({ ...values, phone: normalizePhone(values.phone) }),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Setup complete — sign in as the administrator");
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setPending(false);
    }
  }

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
              process — sign in with the administrator account to change business or M-Pesa
              settings.
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

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <BrandMark />
        <h1 className="mt-8 text-3xl font-semibold">First-run setup</h1>
        <p className="mt-2 text-muted-foreground">
          This one-time wizard creates the super administrator and configures your initial business
          profile.
        </p>

        <div className="mt-8">
          <Progress value={((step + 1) / 2) * 100} aria-label="Setup progress" />
          <ol className="mt-4 grid grid-cols-2 gap-3">
            {steps.map((item, index) => (
              <li
                key={item.title}
                className={`flex items-center gap-2 text-xs ${
                  index <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {index < step ? (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                ) : (
                  <item.icon className="size-4" aria-hidden />
                )}
                {item.title}
              </li>
            ))}
          </ol>
        </div>

        <Card className="mt-6 border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle>{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="firstName"
                    label="First name"
                    value={values.firstName}
                    error={errors.firstName}
                    onChange={(v) => set("firstName", v)}
                  />
                  <SetupField
                    id="lastName"
                    label="Last name"
                    value={values.lastName}
                    error={errors.lastName}
                    onChange={(v) => set("lastName", v)}
                  />
                </div>
                <SetupField
                  id="email"
                  label="Admin email"
                  type="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(v) => set("email", v)}
                />
                <SetupField
                  id="phone"
                  label="Admin phone"
                  placeholder="254712345678"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(v) => set("phone", v)}
                />
                <SetupField
                  id="password"
                  label="Password"
                  type="password"
                  value={values.password}
                  error={errors.password}
                  onChange={(v) => set("password", v)}
                />
              </>
            )}

            {step === 1 && (
              <>
                <SetupField
                  id="businessName"
                  label="Business name"
                  value={values.businessName}
                  error={errors.businessName}
                  onChange={(v) => set("businessName", v)}
                />
                <SetupField
                  id="businessLocation"
                  label="Business location"
                  placeholder="Nairobi, Kenya"
                  value={values.businessLocation}
                  error={errors.businessLocation}
                  onChange={(v) => set("businessLocation", v)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SetupField
                    id="supportEmail"
                    label="Support email (optional)"
                    type="email"
                    value={values.supportEmail}
                    error={errors.supportEmail}
                    onChange={(v) => set("supportEmail", v)}
                  />
                  <SetupField
                    id="supportPhone"
                    label="Support phone (optional)"
                    value={values.supportPhone}
                    error={errors.supportPhone}
                    onChange={(v) => set("supportPhone", v)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>
          {step < 1 ? (
            <Button variant="hero" size="lg" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button variant="hero" size="lg" onClick={() => void submit()} disabled={pending}>
              {pending && <LucideLoader className="animate-spin" />}
              Finish setup
            </Button>
          )}
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
}: {
  id: string;
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
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
