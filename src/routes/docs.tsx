import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Terminal,
  Database,
  ShieldCheck,
  Layers,
  Box,
  Code,
  Copy,
  Check,
  ExternalLink,
  Workflow,
  ArrowRight,
  Lock,
  Key,
  Download,
  Search,
  CheckCircle2,
  Smartphone,
  Send,
  Zap,
  Globe,
  Sliders,
  Users,
  Award,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import BackButton from "@/components/back-button";
import { useAppConfig } from "@/lib/config-context";

export const Route = createFileRoute("/docs")({
  loader: async () => {
    try {
      const config = await getPublicBusinessConfig();
      return config;
    } catch {
      return {
        businessName: process.env["BUSINESS_NAME"] || "Mikopo",
        businessLocation: "",
        supportPhone: "",
        supportEmail: "",
        logoUrl: "",
      };
    }
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Mikopo";
    const title = `Documentation & Self-Hosting Guide — ${businessName}`;
    const description = `Complete developer documentation, self-hosting steps, Docker & GHCR deployment, architecture diagrams, and M-Pesa Daraja integration for ${businessName}.`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: DocsPage,
});

function CodeSnippet({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg border border-border/80 bg-zinc-950 text-zinc-100 font-mono text-xs overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400 select-none">
        <span className="flex items-center gap-1.5 font-sans font-medium text-zinc-300">
          <Terminal className="size-3.5 text-primary" /> {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed font-mono selection:bg-primary/30">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocsPage() {
  const { businessName } = useAppConfig();
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const repoName = "Mikopo";
  const repoOwner = "imrany";
  const ghcrImage = `ghcr.io/${repoOwner}/${repoName.toLowerCase()}:latest`;
  const githubRepoUrl = `https://github.com/${repoOwner}/${repoName}`;

  const navItems = [
    { id: "overview", label: "Overview & Architecture", icon: Workflow },
    { id: "quickstart", label: "Quick Start & Docker", icon: Box },
    { id: "ghcr", label: "Pulling from GHCR", icon: Download },
    { id: "docker-compose", label: "Docker Compose Setup", icon: Layers },
    { id: "environment", label: "Environment Variables", icon: Sliders },
    { id: "mpesa", label: "M-Pesa Daraja Integration", icon: Smartphone },
    { id: "workflow", label: "Lending & Guarantor Engine", icon: Users },
    { id: "nginx-ssl", label: "Nginx & SSL Hardening", icon: ShieldCheck },
    { id: "api", label: "API & Webhook Reference", icon: Code },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      <SiteHeader />

      {/* HERO SECTION */}
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 via-background to-background py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-4">
            <BackButton fallbackUrl="/" label="Back to Home" />
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  <BookOpen className="mr-1.5 size-3.5" /> Technical Documentation
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  v1.2.0 • Self-Hostable
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Box className="mr-1.5 size-3" /> Docker Ready
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                {businessName || "Mikopo"} Architecture & Deployment Guide
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground">
                Comprehensive reference for developers, SACCOs, and fintech companies to self-host,
                configure, integrate, and deploy {businessName || "Mikopo"} using pre-built Docker
                containers from GitHub Container Registry.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1.5"
                >
                  <Code className="size-4" /> GitHub Repository{" "}
                  <ExternalLink className="size-3 ml-0.5 opacity-70" />
                </a>
              </Button>
              <Button size="sm" asChild>
                <a
                  href="#quickstart"
                  onClick={() => setActiveSection("quickstart")}
                  className="gap-1.5"
                >
                  <Zap className="size-4" /> Quick Deployment
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN DOCUMENTATION CONTENT */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:flex-row">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-20 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                className="pl-9 text-xs h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <nav className="flex flex-col space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Box className="size-4 text-primary" /> Image Tag
              </div>
              <p className="font-mono text-[11px] break-all bg-background/80 p-1.5 rounded border border-border">
                {ghcrImage}
              </p>
              <p className="text-[11px] leading-relaxed">
                Pre-built multi-arch Docker image ready to run in any Linux VPS, Docker Swarm, or
                Kubernetes.
              </p>
            </div>
          </div>
        </aside>

        {/* ACTIVE SECTION CONTENT */}
        <section className="min-w-0 flex-1 space-y-8">
          {/* 1. OVERVIEW & ARCHITECTURE */}
          {activeSection === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Workflow className="size-6 text-primary" /> Architecture & System Overview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  High-level topology, security layers, and data pipelines powering Mikopo.
                </p>
              </div>

              {/* ARCHITECTURE DIAGRAM (SVG / VISUAL FLOW) */}
              <Card className="overflow-hidden border-border/80 shadow-sm">
                <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Full-Stack Topology Diagram</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Production Tier
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Client requests, reverse proxy termination, application server, and external
                    Safaricom Daraja gateways.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {/* SVG DIAGRAM */}
                  <div className="w-full bg-zinc-950 p-6 rounded-xl border border-zinc-800 text-zinc-100 overflow-x-auto">
                    <div className="min-w-[620px] flex flex-col gap-6">
                      {/* Top: Users / Clients */}
                      <div className="flex justify-center items-center gap-8">
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-sm">
                          <Smartphone className="size-4 text-emerald-400" />
                          <span className="text-xs font-semibold">Borrower Mobile Web</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-sm">
                          <Globe className="size-4 text-blue-400" />
                          <span className="text-xs font-semibold">Admin / Staff Portal</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-sm">
                          <Users className="size-4 text-purple-400" />
                          <span className="text-xs font-semibold">Guarantor Verification</span>
                        </div>
                      </div>

                      {/* Arrow Down */}
                      <div className="flex justify-center items-center text-zinc-500 text-xs gap-2">
                        <span>HTTPS / TLS (Port 443)</span>
                        <ArrowRight className="size-4 rotate-90 text-primary" />
                      </div>

                      {/* Middle Layer: Nginx Reverse Proxy */}
                      <div className="flex justify-center">
                        <div className="w-4/5 flex items-center justify-between px-6 py-3 bg-zinc-900/90 border border-primary/40 rounded-xl shadow-md">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="size-5 text-primary" />
                            <div>
                              <div className="text-xs font-bold text-zinc-100">
                                Nginx / Caddy Reverse Proxy
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                SSL Termination • Rate Limiting • Compression • Static Caching
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary text-[10px]"
                          >
                            Port 80/443 → 3000
                          </Badge>
                        </div>
                      </div>

                      {/* Arrow Down */}
                      <div className="flex justify-center items-center text-zinc-500 text-xs">
                        <ArrowRight className="size-4 rotate-90 text-zinc-400" />
                      </div>

                      {/* Core Docker Container: Mikopo Application */}
                      <div className="p-5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-inner space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div className="flex items-center gap-2">
                            <Box className="size-5 text-emerald-400" />
                            <span className="text-sm font-bold text-white">
                              Docker Container:{" "}
                              <code className="text-xs font-mono text-emerald-400">mikopo_app</code>
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            Node.js 24 • TanStack Start • Vite SSR
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                            <div className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1">
                              <Zap className="size-3.5 text-amber-400" /> Lending Engine
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              Tier limits, late penalties, credit scores, auto-repayment schedule.
                            </p>
                          </div>
                          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                            <div className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1">
                              <Send className="size-3.5 text-emerald-400" /> Daraja Connector
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              STK Push (C2B), B2C Disbursement, callback webhook processing.
                            </p>
                          </div>
                          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                            <div className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1">
                              <Lock className="size-3.5 text-blue-400" /> Security & Auth
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              JWT sessions, Argon2/Bcrypt hash, RBAC permissions, audit log.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Database and Integrations Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl flex items-center gap-3">
                          <Database className="size-6 text-blue-400 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-zinc-100">
                              PostgreSQL 16 Engine
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Persistent Volume (
                              <code className="text-[10px] text-blue-300">postgres_data</code>) with
                              Prisma ORM
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl flex items-center gap-3">
                          <Smartphone className="size-6 text-emerald-400 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-zinc-100">
                              Safaricom Daraja API
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Encrypted credentials, B2C instant payout, STK push callbacks
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CORE CAPABILITIES GRID */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="size-4 text-primary" /> Automated Lending Cycle
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Progressive loan tiers from Starter to Platinum, customizable interest types
                    (flat/reducing), loan durations, and automated late penalty calculations.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smartphone className="size-4 text-emerald-500" /> M-Pesa Native Payout & STK
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Instant borrower disbursement via Daraja B2C and 1-click frictionless repayments
                    via automated M-Pesa STK push prompts with receipt generation.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="size-4 text-blue-500" /> Guarantor Approval Workflow
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Configurable guarantor requirements with automated status tracking, borrower
                    notifications, and admin review prior to disbursement.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="size-4 text-amber-500" /> Credit Scoring Algorithm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Dynamic credibility scoring engine evaluating on-time repayments, guarantor
                    reliability, borrowing frequency, and default penalties.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck className="size-4 text-purple-500" /> Enterprise RBAC Matrix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Granular staff permissions (Super Admin, Loan Officer, Support Agent,
                    Accountant) with comprehensive immutable audit logging.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Box className="size-4 text-primary" /> Zero-Dependency Docker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Packaged as a lightweight multi-stage Docker container with embedded Prisma
                    migrations, health checks, and low-latency SSR rendering.
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. QUICKSTART & DOCKER */}
          {activeSection === "quickstart" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Box className="size-6 text-primary" /> Quick Start Deployment Guide
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deploy Mikopo on any Linux VPS (Ubuntu, Debian, AWS, Hetzner, DigitalOcean,
                  Linode) in under 5 minutes.
                </p>
              </div>

              {/* STEP 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    1
                  </span>
                  <h3 className="text-base font-semibold text-foreground">
                    Prepare Server Directory & Clone Configuration
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-10">
                  Create a clean working directory on your server. You do not need to compile the
                  TypeScript source code; simply fetch the{" "}
                  <code className="font-mono text-foreground">docker-compose.yml</code> and{" "}
                  <code className="font-mono text-foreground">.env.example</code> files:
                </p>
                <div className="ml-10">
                  <CodeSnippet
                    code={`# Create deployment directory on your VPS
mkdir -p /opt/mikopo && cd /opt/mikopo

# Download the production docker-compose and environment template
curl -fsSL https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/.env.example -o .env`}
                  />
                </div>
              </div>

              {/* STEP 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    2
                  </span>
                  <h3 className="text-base font-semibold text-foreground">
                    Configure Environment Secrets
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-10">
                  Generate strong random secrets for JWT tokens and database credentials:
                </p>
                <div className="ml-10">
                  <CodeSnippet
                    code={`# Generate a secure 64-byte random string for your JWT secret
openssl rand -base64 48

# Edit your .env file
nano .env`}
                  />
                  <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Minimum required variables in <code className="font-mono">.env</code>:
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-1 font-mono text-[11.5px]">
                      <li>POSTGRES_PASSWORD=your_super_secure_db_password</li>
                      <li>JWT_SECRET=your_generated_jwt_secret_key</li>
                      <li>MPESA_SECURITY_CREDENTIAL=your_mpesa_encryption_key</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    3
                  </span>
                  <h3 className="text-base font-semibold text-foreground">
                    Pull Image & Launch Containers
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-10">
                  Docker will pull the optimized pre-built image from GitHub Container Registry,
                  start PostgreSQL, run database schema push, and launch the server on port 3000:
                </p>
                <div className="ml-10">
                  <CodeSnippet
                    code={`# Pull latest image from GHCR
docker compose pull

# Launch database and application in background
docker compose up -d

# Verify container health and logs
docker compose ps
docker compose logs -f app`}
                  />
                </div>
              </div>

              {/* STEP 4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    4
                  </span>
                  <h3 className="text-base font-semibold text-foreground">
                    Run One-Time Business Setup Wizard
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-10">
                  Navigate to{" "}
                  <code className="font-mono text-primary font-bold">
                    http://your-server-ip:3000/setup
                  </code>{" "}
                  (or your domain). The initialization wizard will guide you through:
                </p>
                <div className="ml-10 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div className="p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-500" /> Business Profile &
                      Branding
                    </div>
                    Enter your organization name, support phone, brand color theme, and upload logo.
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-500" /> Super Admin Account
                    </div>
                    Set up your primary administrator email and password with full system control.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PULLING FROM GHCR */}
          {activeSection === "ghcr" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Download className="size-6 text-primary" /> Pulling from GitHub Container
                  Registry (GHCR)
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  How to authenticate, pull, and pin versioned Docker images published from{" "}
                  <code className="font-mono">{githubRepoUrl}</code>.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Public & Authenticated Pull Instructions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    The package is hosted on GHCR under the{" "}
                    <code className="font-mono">{repoOwner}</code> namespace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-1">
                      Direct Docker Pull:
                    </h4>
                    <CodeSnippet code={`docker pull ${ghcrImage}`} />
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-1">
                      Pinning Specific Version Tags:
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      In production environments, we recommend pinning to a fixed semver release tag
                      instead of <code className="font-mono">latest</code>:
                    </p>
                    <CodeSnippet
                      code={`# Pull a specific release
docker pull ghcr.io/${repoOwner}/${repoName.toLowerCase()}:v1.2.0

# In your docker-compose.yml:
# image: ghcr.io/${repoOwner}/${repoName.toLowerCase()}:v1.2.0`}
                    />
                  </div>

                  <div className="p-3.5 bg-muted/40 rounded-lg border border-border text-xs space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Key className="size-4 text-amber-500" /> Private Repository Authentication
                      (Optional)
                    </div>
                    <p className="text-muted-foreground">
                      If pulling from a private organization repository or private package,
                      authenticate your VPS with a GitHub Personal Access Token (PAT) with{" "}
                      <code className="font-mono text-foreground">read:packages</code> scope:
                    </p>
                    <CodeSnippet
                      code={`echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u ${repoOwner} --password-stdin`}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4. DOCKER COMPOSE SETUP */}
          {activeSection === "docker-compose" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Layers className="size-6 text-primary" /> Production Docker Compose Reference
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete multi-container configuration for PostgreSQL 16 Alpine and the Mikopo
                  Application runtime.
                </p>
              </div>

              <CodeSnippet
                language="yaml"
                code={`services:
  postgres:
    image: postgres:16-alpine
    container_name: mikopo_postgres
    restart: always
    command: >
      postgres
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=768MB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=4MB
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-mikopo_secure_pass_2026}
      POSTGRES_DB: \${POSTGRES_DB:-mikopo}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-postgres} -d \${POSTGRES_DB:-mikopo}"]
      interval: 5s
      timeout: 5s
      retries: 6
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"

  app:
    image: ${ghcrImage}
    container_name: mikopo_app
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      NODE_OPTIONS: "--max-old-space-size=2048"
      DB_POOL_MAX: \${DB_POOL_MAX:-30}
      DB_POOL_MIN: \${DB_POOL_MIN:-3}
      SCHEDULER_INTERVAL_MINUTES: \${SCHEDULER_INTERVAL_MINUTES:-10}
      UPLOAD_DIR: /app/uploads
      DATABASE_URL: postgresql://\${POSTGRES_USER:-postgres}:\${POSTGRES_PASSWORD:-mikopo_secure_pass_2026}@postgres:5432/\${POSTGRES_DB:-mikopo}?schema=public
      JWT_SECRET: \${JWT_SECRET}
      MPESA_SECURITY_CREDENTIAL: \${MPESA_SECURITY_CREDENTIAL}
    volumes:
      - mikopo_uploads:/app/uploads
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/healthz || exit 1"]
      interval: 20s
      timeout: 5s
      start_period: 15s
      retries: 3

volumes:
  postgres_data:
  mikopo_uploads:`}
              />
            </div>
          )}

          {/* 5. ENVIRONMENT VARIABLES */}
          {activeSection === "environment" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Sliders className="size-6 text-primary" /> Environment Variables Reference
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Detailed dictionary of all configuration options available in{" "}
                  <code className="font-mono text-foreground">.env</code>.
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-foreground font-semibold border-b border-border/80">
                    <tr>
                      <th className="p-3">Variable</th>
                      <th className="p-3">Required</th>
                      <th className="p-3">Default</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">DATABASE_URL</td>
                      <td className="p-3">
                        <Badge variant="default" className="text-[10px]">
                          Yes
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">
                        PostgreSQL connection string with pooling parameters.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">JWT_SECRET</td>
                      <td className="p-3">
                        <Badge variant="default" className="text-[10px]">
                          Yes
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">
                        Cryptographic secret for signing auth session JWT tokens.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">
                        MPESA_SECURITY_CREDENTIAL
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-[10px]">
                          Recommended
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">
                        AES-256 key used to encrypt Daraja API credentials at rest in Postgres.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">PORT</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">3000</td>
                      <td className="p-3 text-muted-foreground">
                        Internal HTTP port the Node.js server binds to.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">UPLOAD_DIR</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">/app/uploads</td>
                      <td className="p-3 text-muted-foreground">
                        Directory where borrower ID cards, logos, and receipts are stored.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">
                        SCHEDULER_INTERVAL_MINUTES
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">10</td>
                      <td className="p-3 text-muted-foreground">
                        Frequency for running automated late penalty calculations and due reminders.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">
                        SMTP_HOST / SMTP_PORT
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">
                        SMTP mail server credentials for transactional email notifications.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-primary">
                        VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">
                        Web Push notifications keys for borrower status updates.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. M-PESA DARAJA INTEGRATION */}
          {activeSection === "mpesa" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Smartphone className="size-6 text-emerald-500" /> Safaricom M-Pesa Daraja
                  Integration
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete guide to setting up automated B2C Loan Disbursements and C2B/STK Push
                  Repayments.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-emerald-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Zap className="size-4" /> 1. B2C Payout (Disbursement)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>When an admin or loan officer approves a loan:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11.5px]">
                      <li>
                        Server calls Safaricom Daraja B2C API (
                        <code className="font-mono text-foreground">
                          /mpesa/b2c/v1/paymentrequest
                        </code>
                        ).
                      </li>
                      <li>
                        M-Pesa sends money directly to the borrower's registered phone number.
                      </li>
                      <li>
                        Safaricom sends the result to your{" "}
                        <code className="font-mono text-foreground">
                          /api/public/mpesa/b2c-result
                        </code>{" "}
                        webhook.
                      </li>
                      <li>
                        Loan state updates to{" "}
                        <code className="font-mono text-emerald-500">active</code> and calculates
                        repayment installments.
                      </li>
                    </ol>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Smartphone className="size-4" /> 2. STK Push (Repayment)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>When a borrower clicks "Repay via M-Pesa":</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11.5px]">
                      <li>Server triggers Daraja Express STK push prompt on borrower's phone.</li>
                      <li>Borrower enters M-Pesa PIN on their device.</li>
                      <li>
                        Safaricom posts payment confirmation to{" "}
                        <code className="font-mono text-foreground">
                          /api/public/mpesa/stk-callback
                        </code>
                        .
                      </li>
                      <li>
                        Payment receipt is generated and loan balance is credited automatically.
                      </li>
                    </ol>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Configuring Webhook Callbacks in Daraja Portal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ensure your domain is HTTPS-enabled so Safaricom's webhook servers can reach
                    your instance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <div className="p-3 bg-muted/40 rounded-lg font-mono text-[11.5px] space-y-2 text-foreground">
                    <div>
                      <strong>B2C Result URL:</strong>{" "}
                      <code className="text-primary">
                        https://yourdomain.com/api/public/mpesa/b2c-result
                      </code>
                    </div>
                    <div>
                      <strong>B2C Timeout URL:</strong>{" "}
                      <code className="text-primary">
                        https://yourdomain.com/api/public/mpesa/b2c-result
                      </code>
                    </div>
                    <div>
                      <strong>STK Callback URL:</strong>{" "}
                      <code className="text-primary">
                        https://yourdomain.com/api/public/mpesa/stk-callback
                      </code>
                    </div>
                  </div>
                  <p>
                    You can manage Daraja keys directly from the web interface at{" "}
                    <strong>Admin Settings → Daraja Credentials</strong>. Keys are stored encrypted
                    with AES-256 using your server's{" "}
                    <code className="font-mono text-foreground">MPESA_SECURITY_CREDENTIAL</code>.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 7. LENDING & GUARANTOR ENGINE */}
          {activeSection === "workflow" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Users className="size-6 text-primary" /> Lending Lifecycle & Guarantor Engine
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  End-to-end state machine powering loan requests, guarantor approvals,
                  disbursements, and credit growth.
                </p>
              </div>

              <div className="relative border-l-2 border-primary/40 ml-4 pl-6 space-y-6 text-xs">
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 size-3 rounded-full bg-primary ring-4 ring-background" />
                  <h4 className="font-bold text-foreground text-sm">1. Loan Application</h4>
                  <p className="text-muted-foreground mt-1">
                    Borrower chooses an unlocked loan tier, enters the desired principal amount and
                    duration. If the product requires guarantors, the borrower selects from their
                    pre-approved guarantors or invites new ones.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 size-3 rounded-full bg-primary ring-4 ring-background" />
                  <h4 className="font-bold text-foreground text-sm">2. Guarantor Confirmation</h4>
                  <p className="text-muted-foreground mt-1">
                    Guarantors receive notifications and review the guarantee pledge amount. Once
                    all requested guarantors accept, the loan status advances to{" "}
                    <code className="font-mono text-primary">pending_approval</code>.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 size-3 rounded-full bg-primary ring-4 ring-background" />
                  <h4 className="font-bold text-foreground text-sm">
                    3. Administrative Review & Approval
                  </h4>
                  <p className="text-muted-foreground mt-1">
                    Loan officers review the borrower's credit score, history, uploaded ID
                    documents, and guarantor commitments. Upon approval, the status moves to{" "}
                    <code className="font-mono text-emerald-500">approved</code>.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 size-3 rounded-full bg-primary ring-4 ring-background" />
                  <h4 className="font-bold text-foreground text-sm">
                    4. Disbursement & Active Servicing
                  </h4>
                  <p className="text-muted-foreground mt-1">
                    Automated Daraja B2C transfer dispatches funds to the borrower's M-Pesa account.
                    The loan shifts to <code className="font-mono text-emerald-500">active</code>,
                    and automated due date reminders are scheduled.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 size-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                  <h4 className="font-bold text-foreground text-sm">
                    5. Full Repayment & Tier Unlock
                  </h4>
                  <p className="text-muted-foreground mt-1">
                    Upon zeroing the balance, the loan status updates to{" "}
                    <code className="font-mono text-emerald-500">repaid</code>, the borrower's
                    credit score increases, and the next borrowing tier unlocks automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 8. NGINX & SSL HARDENING */}
          {activeSection === "nginx-ssl" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-6 text-primary" /> Nginx Reverse Proxy & SSL
                  Configuration
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Production-grade Nginx configuration with Let's Encrypt automated TLS, HTTP/2,
                  security headers, and WebSocket proxying.
                </p>
              </div>

              <CodeSnippet
                language="nginx"
                code={`server {
    listen 80;
    server_name mikopo.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mikopo.yourcompany.com;

    # SSL Certificates (managed via Certbot)
    ssl_certificate /etc/letsencrypt/live/mikopo.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mikopo.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client body limit for ID uploads & attachments
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}`}
              />

              <div className="p-3.5 bg-muted/40 rounded-lg border border-border text-xs space-y-2">
                <div className="font-semibold text-foreground">Obtaining Free SSL via Certbot:</div>
                <CodeSnippet
                  code={`sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mikopo.yourcompany.com`}
                />
              </div>
            </div>
          )}

          {/* 9. API & WEBHOOK REFERENCE */}
          {activeSection === "api" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Code className="size-6 text-primary" /> API & Webhook Specifications
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Public endpoints and webhook callback signatures for external integrations.
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="healthz" className="border rounded-lg px-4 bg-muted/20">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-emerald-500 font-mono text-[10px]">
                        GET
                      </Badge>
                      <span className="font-mono">/healthz</span>
                      <span className="text-muted-foreground font-normal ml-2">
                        — Container Health Check
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground pt-2 space-y-2">
                    <p>
                      Returns 200 OK when the database connection and Node server are fully ready.
                    </p>
                    <CodeSnippet
                      language="json"
                      code={`{ "status": "ok", "timestamp": "2026-08-31T12:00:00.000Z" }`}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="stk-callback" className="border rounded-lg px-4 bg-muted/20">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-500 font-mono text-[10px]">
                        POST
                      </Badge>
                      <span className="font-mono">/api/public/mpesa/stk-callback</span>
                      <span className="text-muted-foreground font-normal ml-2">
                        — M-Pesa STK Callback
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground pt-2 space-y-2">
                    <p>
                      Safaricom sends the result of borrower STK prompt requests to this endpoint.
                    </p>
                    <CodeSnippet
                      language="json"
                      code={`{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220261020362925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 5000.00 },
          { "Name": "MpesaReceiptNumber", "Value": "RHK45199X" },
          { "Name": "TransactionDate", "Value": 20260831120000 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}`}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="b2c-result" className="border rounded-lg px-4 bg-muted/20">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-purple-500 font-mono text-[10px]">
                        POST
                      </Badge>
                      <span className="font-mono">/api/public/mpesa/b2c-result</span>
                      <span className="text-muted-foreground font-normal ml-2">
                        — M-Pesa B2C Payout Result
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground pt-2 space-y-2">
                    <p>
                      Safaricom dispatches final B2C disbursement confirmation to this endpoint.
                    </p>
                    <CodeSnippet
                      language="json"
                      code={`{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "AG_20260831_00004",
    "ConversationID": "AG_20260831_00004",
    "TransactionID": "RHK998231",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "TransactionAmount", "Value": 10000.00 },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678 - John Doe" }
      ]
    }
  }
}`}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-muted/40 py-10 mt-auto">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-foreground">
              {businessName || "Mikopo"}
            </span>
            <span className="text-xs text-muted-foreground">Open-Source & Self-Hostable</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              GitHub ({repoOwner}/{repoName})
            </a>
            <a
              href="#quickstart"
              onClick={() => setActiveSection("quickstart")}
              className="hover:text-foreground hover:underline"
            >
              Docker Guide
            </a>
            <a href="/terms" className="hover:text-foreground hover:underline">
              Terms & Conditions
            </a>
            <a href="/privacy" className="hover:text-foreground hover:underline">
              Privacy Policy
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {businessName || "Mikopo"}. Image:{" "}
            <code className="font-mono text-[11px]">{ghcrImage}</code>
          </p>
        </div>
      </footer>
    </div>
  );
}
