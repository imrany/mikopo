import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LucideLoader,
  LogIn,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserPlus,
  RefreshCw,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import { fireCelebrationConfetti } from "@/lib/confetti";
import {
  registerMember,
  signInWithIdentifier,
  verify2faLoginFn,
  resend2faLoginCodeFn,
  verifyRegistrationEmailFn,
  resendRegistrationCodeFn,
  getPublicBusinessConfig,
  getSetupStatus,
} from "@/lib/account.functions";
import { loginSchema, registerSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/format";
import { useSetupStatus } from "@/lib/use-setup-status";
import { motion } from "motion/react";
const heroImg = "/hero-image.png";

const searchSchema = z
  .object({
    mode: z.enum(["login", "register"]).optional(),
    ref: z.string().max(16).optional(),
  })
  .passthrough();

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const status = await getSetupStatus();
    if (status.needsSetup) {
      throw redirect({ to: "/setup" });
    }
  },
  loader: async () => {
    try {
      const config = await getPublicBusinessConfig();
      return config;
    } catch {
      return {
        businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
        businessLocation: "Nairobi, Kenya",
        supportPhone: "",
        supportEmail: "",
        logoUrl: "",
        termsContent: "",
        privacyContent: "",
      };
    }
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    const title = `Sign In or Register — ${businessName}`;
    const description = `Sign in with your National ID or M-Pesa phone number, or register a borrower account with ${businessName}. Instant credit limit and mobile money payouts.`;
    const heroImage = (loaderData as any)?.heroImageUrl || "/hero-image.png";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: `sign in, register borrower account, ${businessName}, M-Pesa loans login, mobile credit Kenya`,
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:site_name", content: businessName },
        { property: "og:type", content: "website" },
        { property: "og:image", content: heroImage },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: heroImage },
      ],
    };
  },
  component: AuthPage,
});

type FieldErrors = Partial<
  Record<
    | "identifier"
    | "password"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "idNumber"
    | "referralCode"
    | "form",
    string
  >
>;

function fieldErrors(error: unknown): FieldErrors {
  if (error instanceof z.ZodError) {
    return Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
    );
  }
  return {};
}

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading, profile, roles } = useAuth();
  const { needsSetup } = useSetupStatus();
  const { businessName, heroImageUrl } = useAppConfig();
  const activeHeroImg = heroImageUrl || heroImg;

  useEffect(() => {
    if (!loading && session && profile) {
      const isStaffUser = roles.includes("super_admin") || roles.includes("staff");
      navigate({ to: isStaffUser ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, session, profile, roles, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
        <img
          key={activeHeroImg}
          src={activeHeroImg}
          alt={businessName}
          className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-300"
          sizes="800px"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = heroImg;
          }}
        />
        <div className="absolute inset-0 bg-linear-to-br from-primary/80 via-primary/50 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BrandMark tone="inverted" />
          </motion.div>
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-display text-3xl font-bold text-primary-foreground">
                Borrow smarter with {businessName}
              </h2>
              <p className="mt-3 max-w-sm text-primary-foreground/80 leading-relaxed text-sm">
                {businessName} credibility-based loan limits, guarantor-backed applications, and
                instant M-Pesa disbursement.
              </p>
            </motion.div>
            <div className="space-y-3">
              {[
                { icon: ShieldCheck, text: "Guarantor-backed trust network" },
                { icon: Smartphone, text: "Instant M-Pesa disbursement & repayment" },
                { icon: TrendingUp, text: "Grow your limit with on-time repayments" },
              ].map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                  className="flex items-center gap-3 text-primary-foreground/80"
                >
                  <item.icon className="size-5 shrink-0 text-gold" />
                  <span className="text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs text-primary-foreground/60"
            >
              Protected by identity verification, digital guarantor confirmation, and audited admin
              operations.
            </motion.p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <Tabs defaultValue={mode === "register" ? "register" : "login"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <LoginForm />
            </TabsContent>
            <TabsContent value="register" className="mt-6">
              <RegisterForm referral={ref ?? ""} />
            </TabsContent>
          </Tabs>

          {needsSetup && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Setting up the business instead?{" "}
              <Link to="/setup" className="text-primary underline-offset-4 hover:underline">
                Run business setup
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type VerificationChallenge = {
  tempToken: string;
  maskedEmail: string;
};

function LoginForm() {
  const signIn = useServerFn(signInWithIdentifier);
  const verify2fa = useServerFn(verify2faLoginFn);
  const resend2fa = useServerFn(resend2faLoginCodeFn);
  const verifyEmail = useServerFn(verifyRegistrationEmailFn);
  const resendEmail = useServerFn(resendRegistrationCodeFn);
  const { setAuthSession } = useAuth();
  const config = useAppConfig();

  const [values, setValues] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  // 2FA Challenge State
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<VerificationChallenge | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [resending2fa, setResending2fa] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email Verification Challenge State (for unverified existing accounts)
  const [emailChallenge, setEmailChallenge] = useState<VerificationChallenge | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailResendCooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    let parsed;
    try {
      parsed = loginSchema.parse(values);
    } catch (error) {
      setErrors(fieldErrors(error));
      return;
    }
    setPending(true);
    try {
      const result = await signIn({ data: parsed });
      if (!result.ok) {
        if ("requiresEmailVerification" in result && result.requiresEmailVerification) {
          setEmailChallenge({
            tempToken: result.tempToken,
            maskedEmail: result.maskedEmail,
          });
          setEmailCode("");
          setEmailResendCooldown(60);
          toast.info(result.error || "Please verify your email address to proceed.");
          return;
        }
        toast.error(result.error);
        return;
      }

      if (result.requires2fa) {
        setTwoFactorChallenge({
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
        });
        setTwoFactorCode("");
        setResendCooldown(30);
        return;
      }

      setAuthSession(result.token, result.user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyEmail(eOrCode?: FormEvent | string) {
    if (eOrCode && typeof eOrCode === "object" && "preventDefault" in eOrCode) {
      eOrCode.preventDefault();
    }
    if (!emailChallenge) return;
    const cleanCode = (typeof eOrCode === "string" ? eOrCode : emailCode).trim();
    if (cleanCode.length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifyingEmail(true);
    try {
      const result = await verifyEmail({
        data: {
          tempToken: emailChallenge.tempToken,
          code: cleanCode,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      fireCelebrationConfetti();
      toast.success(`Welcome to ${config.businessName || "the platform"}! Email verified.`);
      setAuthSession(result.token, result.user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email verification failed.");
    } finally {
      setVerifyingEmail(false);
    }
  }

  async function handleResendEmailCode() {
    if (!emailChallenge || emailResendCooldown > 0 || resendingEmail) return;
    setResendingEmail(true);
    try {
      const result = await resendEmail({
        data: { tempToken: emailChallenge.tempToken },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setEmailResendCooldown(60);
      toast.success(result.message || "New verification code sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code.");
    } finally {
      setResendingEmail(false);
    }
  }

  async function handleVerify2fa(eOrCode?: FormEvent | string) {
    if (eOrCode && typeof eOrCode === "object" && "preventDefault" in eOrCode) {
      eOrCode.preventDefault();
    }
    if (!twoFactorChallenge) return;
    const cleanCode = (typeof eOrCode === "string" ? eOrCode : twoFactorCode).trim();
    if (cleanCode.length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifying2fa(true);
    try {
      const result = await verify2fa({
        data: {
          tempToken: twoFactorChallenge.tempToken,
          code: cleanCode,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setAuthSession(result.token, result.user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "2FA verification failed.");
    } finally {
      setVerifying2fa(false);
    }
  }

  async function handleResend2fa() {
    if (!twoFactorChallenge || resendCooldown > 0 || resending2fa) return;
    setResending2fa(true);
    try {
      const result = await resend2fa({
        data: { tempToken: twoFactorChallenge.tempToken },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setResendCooldown(30);
      toast.success(result.message || "New 2FA code sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code.");
    } finally {
      setResending2fa(false);
    }
  }

  if (emailChallenge) {
    return (
      <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-1.5 text-primary font-medium text-xs mb-1">
              <Mail className="h-4 w-4" />
              <span>Email Verification Required</span>
            </div>
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription className="text-xs">
              We sent a 6-digit verification code to{" "}
              <strong className="text-foreground font-semibold">
                {emailChallenge.maskedEmail}
              </strong>
              . Enter it below to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleVerifyEmail} className="space-y-4" noValidate>
              <div className="space-y-3 flex flex-col items-center">
                <div className="flex justify-center w-full py-1">
                  <InputOTP
                    id="loginEmailCode"
                    maxLength={6}
                    value={emailCode}
                    disabled={verifyingEmail}
                    onChange={(val) => {
                      const clean = val.replace(/\D/g, "").slice(0, 6);
                      setEmailCode(clean);
                      if (clean.length === 6 && !verifyingEmail) {
                        void handleVerifyEmail(clean);
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

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={verifyingEmail || emailCode.length < 6}
              >
                {verifyingEmail ? <LucideLoader className="animate-spin" /> : <ShieldCheck />}
                Verify & Continue
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5 h-8 px-2"
                onClick={() => {
                  setEmailChallenge(null);
                  setEmailCode("");
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign in
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={emailResendCooldown > 0 || resendingEmail}
                onClick={handleResendEmailCode}
                className="text-xs gap-1.5 h-8 px-2"
              >
                {resendingEmail ? (
                  <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {emailResendCooldown > 0 ? `Resend code in ${emailResendCooldown}s` : "Resend Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (twoFactorChallenge) {
    return (
      <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-1.5 text-primary font-medium text-xs mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Two-Factor Authentication</span>
            </div>
            <CardTitle>Enter Security Code</CardTitle>
            <CardDescription className="text-xs">
              A 6-digit verification code was sent to{" "}
              <strong className="text-foreground font-semibold">
                {twoFactorChallenge.maskedEmail}
              </strong>
              . Check your inbox and spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleVerify2fa} className="space-y-4" noValidate>
              <div className="space-y-3 flex flex-col items-center">
                <div className="flex justify-center w-full py-1">
                  <InputOTP
                    id="twoFactorCode"
                    maxLength={6}
                    value={twoFactorCode}
                    disabled={verifying2fa}
                    onChange={(val) => {
                      const clean = val.replace(/\D/g, "").slice(0, 6);
                      setTwoFactorCode(clean);
                      if (clean.length === 6 && !verifying2fa) {
                        void handleVerify2fa(clean);
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

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={verifying2fa || twoFactorCode.length < 6}
              >
                {verifying2fa ? <LucideLoader className="animate-spin" /> : <ShieldCheck />}
                Verify & Sign in
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5 h-8 px-2"
                onClick={() => {
                  setTwoFactorChallenge(null);
                  setTwoFactorCode("");
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign in
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || resending2fa}
                onClick={handleResend2fa}
                className="text-xs gap-1.5 h-8 px-2"
              >
                {resending2fa ? (
                  <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
      <Card className="border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your ID number, phone number or email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifier">ID number or phone</Label>
              <Input
                id="identifier"
                autoComplete="username"
                placeholder="12345678 or 254712345678"
                value={values.identifier}
                aria-invalid={Boolean(errors.identifier)}
                onChange={(e) => setValues((v) => ({ ...v, identifier: e.target.value }))}
              />
              {errors.identifier && <p className="text-xs text-destructive">{errors.identifier}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={values.password}
                aria-invalid={Boolean(errors.password)}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={pending}>
              {pending ? <LucideLoader className="animate-spin" /> : <LogIn />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const STEPS = [
  { key: "personal", label: "Personal" },
  { key: "contact", label: "Contact & ID" },
  { key: "finish", label: "Finish up" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const STEP_FIELDS: Record<StepKey, (keyof FieldErrors)[]> = {
  personal: ["firstName", "lastName", "email"],
  contact: ["phone", "idNumber", "password"],
  finish: ["referralCode"],
};

function RegisterForm({ referral }: { referral: string }) {
  const register = useServerFn(registerMember);
  const verifyEmail = useServerFn(verifyRegistrationEmailFn);
  const resendEmail = useServerFn(resendRegistrationCodeFn);
  const { setAuthSession } = useAuth();
  const config = useAppConfig();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idNumber: "",
    password: "",
    referralCode: referral,
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // Email verification challenge state
  const [verificationChallenge, setVerificationChallenge] = useState<VerificationChallenge | null>(
    null,
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const stepKey = STEPS[step]!.key;
  const isLastStep = step === STEPS.length - 1;

  function validateStep(key: StepKey): boolean {
    const result = registerSchema.safeParse({
      ...values,
      phone: values.phone ? normalizePhone(values.phone) : values.phone,
    });
    if (result.success) {
      setErrors({});
      return true;
    }
    const allErrors = fieldErrors(result.error);
    const relevantKeys = STEP_FIELDS[key];
    const stepErrors = Object.fromEntries(
      Object.entries(allErrors).filter(([k]) => relevantKeys.includes(k as keyof FieldErrors)),
    ) as FieldErrors;
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }

  function handleNext() {
    if (!validateStep(stepKey)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isLastStep) {
      handleNext();
      return;
    }
    setErrors({});
    if (!agreedToTerms) {
      toast.error("Please agree to the Terms & Conditions and Privacy Policy to register.");
      return;
    }
    let parsed;
    try {
      parsed = registerSchema.parse({ ...values, phone: normalizePhone(values.phone) });
    } catch (error) {
      setErrors(fieldErrors(error));
      return;
    }
    setPending(true);
    try {
      const result = await register({ data: parsed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.requiresVerification) {
        setVerificationChallenge({
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
        });
        setVerificationCode("");
        setResendCooldown(60);
        toast.info(`Verification code sent to ${result.maskedEmail}`);
        return;
      }
      setDone(true);
      fireCelebrationConfetti();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your account");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(eOrCode?: FormEvent | string) {
    if (eOrCode && typeof eOrCode === "object" && "preventDefault" in eOrCode) {
      eOrCode.preventDefault();
    }
    if (!verificationChallenge) return;
    const cleanCode = (typeof eOrCode === "string" ? eOrCode : verificationCode).trim();
    if (cleanCode.length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifyingCode(true);
    try {
      const result = await verifyEmail({
        data: {
          tempToken: verificationChallenge.tempToken,
          code: cleanCode,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      fireCelebrationConfetti();
      toast.success(`Welcome to ${config.businessName || "the platform"}! Email verified.`);
      setAuthSession(result.token, result.user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email verification failed.");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleResendCode() {
    if (!verificationChallenge || resendCooldown > 0 || resendingCode) return;
    setResendingCode(true);
    try {
      const result = await resendEmail({
        data: { tempToken: verificationChallenge.tempToken },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setResendCooldown(60);
      toast.success(result.message || "New verification code sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code.");
    } finally {
      setResendingCode(false);
    }
  }

  if (verificationChallenge) {
    return (
      <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-1.5 text-primary font-medium text-xs mb-1">
              <Mail className="h-4 w-4" />
              <span>Email Verification Step</span>
            </div>
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription className="text-xs">
              We sent a 6-digit security code to{" "}
              <strong className="text-foreground font-semibold">
                {verificationChallenge.maskedEmail}
              </strong>
              . Enter it below to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
              <div className="space-y-3 flex flex-col items-center">
                <div className="flex justify-center w-full py-1">
                  <InputOTP
                    id="registrationEmailCode"
                    maxLength={6}
                    value={verificationCode}
                    disabled={verifyingCode}
                    onChange={(val) => {
                      const clean = val.replace(/\D/g, "").slice(0, 6);
                      setVerificationCode(clean);
                      if (clean.length === 6 && !verifyingCode) {
                        void handleVerifyCode(clean);
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

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={verifyingCode || verificationCode.length < 6}
              >
                {verifyingCode ? <LucideLoader className="animate-spin" /> : <ShieldCheck />}
                Verify & Activate Account
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5 h-8 px-2"
                onClick={() => {
                  setVerificationChallenge(null);
                  setVerificationCode("");
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Edit details
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || resendingCode}
                onClick={handleResendCode}
                className="text-xs gap-1.5 h-8 px-2"
              >
                {resendingCode ? (
                  <LucideLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (done) {
    return (
      <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle>Account created</CardTitle>
            <CardDescription>
              Sign in with your ID number or phone number to see your starter loan limit.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ x: -100 }} animate={{ x: 0 }}>
      <Card className="border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Step {step + 1} of {STEPS.length} — {STEPS[step]!.label}
          </CardDescription>
          <div className="mt-3 flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {stepKey === "personal" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="firstName"
                    label="First name"
                    value={values.firstName}
                    error={errors.firstName}
                    onChange={(value) => setValues((v) => ({ ...v, firstName: value }))}
                  />
                  <Field
                    id="lastName"
                    label="Last name"
                    value={values.lastName}
                    error={errors.lastName}
                    onChange={(value) => setValues((v) => ({ ...v, lastName: value }))}
                  />
                </div>
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(value) => setValues((v) => ({ ...v, email: value }))}
                />
              </>
            )}

            {stepKey === "contact" && (
              <>
                <Field
                  id="phone"
                  label="M-Pesa phone number"
                  placeholder="254712345678"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(value) => setValues((v) => ({ ...v, phone: value }))}
                />
                <Field
                  id="idNumber"
                  label="National ID number"
                  value={values.idNumber}
                  error={errors.idNumber}
                  onChange={(value) => setValues((v) => ({ ...v, idNumber: value }))}
                />
                <Field
                  id="password"
                  label="Password"
                  type="password"
                  value={values.password}
                  error={errors.password}
                  onChange={(value) => setValues((v) => ({ ...v, password: value }))}
                />
              </>
            )}

            {stepKey === "finish" && (
              <>
                <Field
                  id="referralCode"
                  label="Referral code (optional)"
                  value={values.referralCode}
                  error={errors.referralCode}
                  onChange={(value) => setValues((v) => ({ ...v, referralCode: value }))}
                />
                <div className="flex items-start gap-2 pt-1 text-sm text-muted-foreground">
                  <input
                    id="agree-terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="agree-terms" className="leading-snug">
                    I have read and agree to the{" "}
                    <Link
                      to="/terms"
                      target="_blank"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Terms & Conditions
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/privacy"
                      target="_blank"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={pending}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="flex-1"
                disabled={pending || (isLastStep && !agreedToTerms)}
              >
                {pending ? (
                  <LucideLoader className="animate-spin" />
                ) : isLastStep ? (
                  <UserPlus />
                ) : null}
                {isLastStep ? "Create account" : "Continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Field({
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
