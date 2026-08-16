import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fireCelebrationConfetti } from "@/lib/confetti";
import { subscribeNewsletter } from "@/lib/notifications.functions";
import { useAppConfig } from "@/lib/config-context";

export function NewsletterForm() {
  const subscribeFn = useServerFn(subscribeNewsletter);
  const { businessName } = useAppConfig();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await subscribeFn({ data: { email } });
      setSuccessMsg(res.message);
      fireCelebrationConfetti();
      setEmail("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden shadow-none border-none bg-transparent">
      <CardContent>
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Subscribe to {businessName} Email Updates
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get instant updates on new loan tiers, interest rate reductions, credibility rewards,
            and financial tips sent straight to your inbox.
          </p>

          {!successMsg && (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row items-center gap-3 pt-2"
            >
              <div className="relative w-full">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background border-input text-sm text-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                variant="hero"
                className="w-full sm:w-auto h-11 px-6 font-medium shrink-0"
              >
                {loading ? "Subscribing..." : "Subscribe Now"}
              </Button>
            </form>
          )}

          {successMsg && (
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 pt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {successMsg}
            </div>
          )}

          {errorMsg && <div className="text-sm font-medium text-destructive pt-2">{errorMsg}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
