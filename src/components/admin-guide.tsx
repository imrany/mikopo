import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  CheckCircle2,
  Users,
  Building2,
  ArrowRight,
  Send,
  SlidersHorizontal,
  Award,
  BookOpen,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableLandingText } from "@/components/editable-landing-text";

export function AdminGuide({
  businessName,
  contentMap = {},
  onChange = () => {},
  isStaff = false,
}: {
  businessName: string;
  contentMap?: Record<string, string>;
  onChange?: (id: string, text: string) => void;
  isStaff?: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Admin Welcome Banner */}
      <Card className="border-border/80 bg-gradient-hero text-primary-foreground shadow-lift overflow-hidden">
        <CardContent className="p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <Badge className="bg-gold text-gold-foreground border-0 font-semibold">
              Staff & Administrator Hub
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold font-display">
              <EditableLandingText
                id="admin_guide_title"
                defaultText={`System Control & Operations Guide for ${businessName}`}
                contentMap={contentMap}
                onChange={onChange}
                isStaff={isStaff}
                as="span"
              />
            </h2>
            <p className="text-sm text-primary-foreground/80 leading-relaxed">
              <EditableLandingText
                id="admin_guide_subtitle"
                defaultText="Welcome to the administrator control room. Manage borrower accounts, review loan applications with guarantor confirmations, execute automated M-Pesa B2C disbursements, and configure your business branding."
                contentMap={contentMap}
                onChange={onChange}
                isStaff={isStaff}
                multiline
                as="span"
              />
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Button variant="gold" size="lg" asChild>
              <Link to="/admin">
                <ShieldCheck className="mr-2 size-4" />
                Open Admin Console
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin How-To System Steps */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="size-5 text-primary" />
          <h3 className="text-xl font-semibold">How to Operate the Platform</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Step 1 */}
          <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
            <CardHeader className="pb-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-5" />
              </span>
              <CardTitle className="pt-2 text-base font-semibold">1. Borrower Management</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Monitor registered accounts, National IDs, and phone numbers. Adjust credit limits
                or credibility scores (300–850) manually, or suspend suspicious profiles when
                necessary.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin"
                  search={{ tab: "users" }}
                  className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                >
                  Manage Users <ArrowRight className="ml-1 size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
            <CardHeader className="pb-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="size-5" />
              </span>
              <CardTitle className="pt-2 text-base font-semibold">
                2. Loan Approvals Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Applications automatically enter the approval queue once nominated guarantors
                confirm in-app. Review loan terms and approve or decline with a single click.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin"
                  search={{ tab: "overview" }}
                  className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                >
                  View Loan Queue <ArrowRight className="ml-1 size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
            <CardHeader className="pb-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="size-5" />
              </span>
              <CardTitle className="pt-2 text-base font-semibold">3. M-Pesa B2C Payouts</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Click "Disburse" on approved loans to trigger Safaricom Daraja B2C payouts directly
                to borrower wallets. STK Push callbacks automatically reconcile repayments.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin"
                  search={{ tab: "settings" }}
                  className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                >
                  M-Pesa Settings <ArrowRight className="ml-1 size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
            <CardHeader className="pb-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <CardTitle className="pt-2 text-base font-semibold">4. Branding & Tiers</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Customize business name, support contact, logo image, custom terms & privacy
                policies, and configure loan product tiers (Starter, Bronze, Silver, Gold,
                Platinum).
              </p>
              <div className="pt-2">
                <Link
                  to="/admin"
                  search={{ tab: "products" }}
                  className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                >
                  Configure Tiers <ArrowRight className="ml-1 size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin Shortcuts Grid */}
      <Card className="border-border/70 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Quick Console Navigation</CardTitle>
          <CardDescription className="text-xs">
            Direct shortcuts to key administrator operational pages
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
            <Link to="/admin">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Loan Queue</div>
                <div className="text-[10px] text-muted-foreground">Approvals & Payouts</div>
              </div>
            </Link>
          </Button>

          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
            <Link to="/admin/users">
              <Users className="size-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Borrowers</div>
                <div className="text-[10px] text-muted-foreground">User Profiles</div>
              </div>
            </Link>
          </Button>

          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
            <Link to="/staff">
              <UserCheck className="size-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Staff Agents</div>
                <div className="text-[10px] text-muted-foreground">Task Delegation</div>
              </div>
            </Link>
          </Button>

          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
            <Link to="/admin/settings">
              <SlidersHorizontal className="size-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">System Settings</div>
                <div className="text-[10px] text-muted-foreground">Branding & Daraja</div>
              </div>
            </Link>
          </Button>

          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
            <Link to="/admin/products">
              <Award className="size-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Tiers & Reviews</div>
                <div className="text-[10px] text-muted-foreground">Products & Reviews</div>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
