import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BellRing,
  Gift,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  LayoutDashboard,
  Camera,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { BrandMark } from "@/components/brand-mark";
import { NewsletterForm } from "@/components/newsletter-form";
import { TestimonialsCarousel } from "@/components/testimonials-carousel";
import { BorrowerGuide } from "@/components/borrower-guide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
const heroImg = "/hero-image.png";
import { useAuth } from "@/lib/auth-context";
import { useSetupStatus } from "@/lib/use-setup-status";
import { getPublicBusinessConfig, getSetupStatus } from "@/lib/account.functions";
import { getMyLoanCenter, listPublicLoanProducts } from "@/lib/loans.functions";
import { adminSaveLandingContent } from "@/lib/admin.functions";
import { formatKes } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableLandingText } from "@/components/editable-landing-text";
import { AdminLandingBar, LandingViewMode } from "@/components/admin-landing-bar";
import { useAppConfig } from "@/lib/config-context";
import { useUrlBooleanState } from "@/lib/use-url-search-state";

// Staff-only components lazy-loaded: anonymous/borrower visitors — the vast
// majority of traffic — never download this JS. Cuts initial bundle size
// for the public landing page.
const AdminGuide = lazy(() =>
  import("@/components/admin-guide").then((m) => ({ default: m.AdminGuide })),
);
const HeroImageEditor = lazy(() =>
  import("@/components/hero-image-editor").then((m) => ({ default: m.HeroImageEditor })),
);

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: async () => {
    const status = await getSetupStatus();
    if (status.needsSetup) {
      throw redirect({ to: "/setup" });
    }
  },
  loader: async () => {
    try {
      // Fetch config AND public loan products together server-side, instead
      // of letting products fire as a second client-side round-trip after
      // hydration. This is the main fix for slow initial load: previously
      // listPublicLoanProducts only started once the component mounted.
      const [config, products] = await Promise.all([
        getPublicBusinessConfig(),
        listPublicLoanProducts().catch(() => []),
      ]);
      return { ...config, products };
    } catch {
      return {
        businessName: process.env["BUSINESS_NAME"] || "",
        businessLocation: "",
        supportPhone: "",
        supportEmail: "",
        logoUrl: "",
        termsContent: "",
        privacyContent: "",
        products: [] as any[],
      };
    }
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || process.env["BUSINESS_NAME"] || "";
    const location = loaderData?.businessLocation || "";
    const title = businessName
      ? `${businessName} — Instant M-Pesa Micro-Loans & Peer Guarantor Credit`
      : "";
    const description = businessName
      ? `Apply for instant M-Pesa loan approvals with ${businessName}${location ? ` in ${location}` : ""}. Credibility-based credit limits, digital guarantor backing, and automated STK Push repayments.`
      : "";
    const heroImage = loaderData?.heroImageUrl || "/hero-image.png";

    const jsonLd = businessName
      ? {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": ["FinancialService", "LoanOrCredit"],
              "@id":
                "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app/#financial-service",
              name: businessName,
              legalName: businessName,
              description,
              url: "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app",
              logo: {
                "@type": "ImageObject",
                url: "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app/pwa-icon.png",
                width: 512,
                height: 512,
              },
              image: {
                "@type": "ImageObject",
                url: "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app/hero-image.png",
                width: 1200,
                height: 630,
              },
              address: {
                "@type": "PostalAddress",
                addressLocality: location || "Nairobi",
                addressCountry: "KE",
              },
              telephone: loaderData?.supportPhone || undefined,
              email: loaderData?.supportEmail || undefined,
              currenciesAccepted: "KES",
              paymentAccepted: ["M-Pesa", "Mobile Money"],
              priceRange: "KES 500 - KES 100,000",
              areaServed: {
                "@type": "Country",
                name: "Kenya",
              },
              potentialAction: {
                "@type": "Action",
                name: "Apply for M-Pesa Micro-Loan",
                target:
                  "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app/auth?mode=register",
              },
            },
            {
              "@type": "WebSite",
              "@id":
                "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app/#website",
              url: "https://ais-pre-yucgftzwvw73wtc4g4wdi4-464215410896.europe-west1.run.app",
              name: businessName,
              description,
              inLanguage: "en-KE",
            },
          ],
        }
      : null;

    return {
      meta: [
        ...(title ? [{ title }] : [{ title: "" }]),
        ...(description ? [{ name: "description", content: description }] : []),
        {
          name: "keywords",
          content:
            "M-Pesa loans, online microloans Kenya, fast mobile loans, guarantor microfinance, Daraja STK Push, Nairobi instant credit, peer credit score",
        },
        ...(title ? [{ property: "og:title", content: title }] : []),
        ...(description ? [{ property: "og:description", content: description }] : []),
        { property: "og:type", content: "website" },
        ...(businessName ? [{ property: "og:site_name", content: businessName }] : []),
        { property: "og:locale", content: "en_KE" },
        { property: "og:image", content: heroImage },
        { property: "og:image:secure_url", content: heroImage },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        ...(businessName
          ? [{ property: "og:image:alt", content: `${businessName} Microloans` }]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(title ? [{ name: "twitter:title", content: title }] : []),
        ...(description ? [{ name: "twitter:description", content: description }] : []),
        { name: "twitter:image", content: heroImage },
        ...(businessName
          ? [{ name: "twitter:image:alt", content: `${businessName} Microloans` }]
          : []),
      ],
      ...(jsonLd
        ? {
            scripts: [
              {
                type: "application/ld+json",
                children: JSON.stringify(jsonLd),
              },
            ],
          }
        : {}),
    };
  },
  component: Landing,
});

const steps = [
  {
    icon: BadgeCheck,
    title: "Register & verify identity",
    body: "Sign up with your National ID number and active M-Pesa phone number to unlock your starter credit limit.",
  },
  {
    icon: Users,
    title: "Invite 2 guarantors",
    body: "Nominate two registered borrowers to guarantee your application. They approve in-app instantly.",
  },
  {
    icon: Banknote,
    title: "Receive M-Pesa payout",
    body: "Once approved by the loan officer, funds land directly in your M-Pesa mobile wallet in under 60 seconds.",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Credibility Scoring",
    body: "Every on-time repayment awards credibility points (+10 pts) and expands your loan limit automatically.",
  },
  {
    icon: Smartphone,
    title: "1-Tap Repayments",
    body: "Repay loans effortlessly with an automated M-Pesa STK prompt sent straight to your phone screen.",
  },
  {
    icon: Gift,
    title: "Referral Cash Rewards",
    body: "Share your personal referral code. Earn cash bonuses and extra score points when invitees settle loans.",
  },
  {
    icon: LayoutDashboard,
    title: "User Control",
    body: "Loan applications, manage loan product tiers with a simple, user-friendly interface.",
  },
  {
    icon: BellRing,
    title: "Automated SMS Nudges",
    body: "Timely SMS and email reminders before due dates help keep default rates minimal across all credit tiers.",
  },
  {
    icon: Users,
    title: "Digital Guarantors Network",
    body: "Zero paper forms. Guarantors confirm requests digitally from their own mobile dashboards.",
  },
];

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// Used for content that depends on auth state resolving async (session/isStaff).
// Because the hero's entrance animation plays on mount — before auth has necessarily
// resolved — anything gated on session/isStaff needs its OWN enter animation via
// AnimatePresence, otherwise it just pops in once `loading` flips to false.
const authRevealVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

function Landing() {
  const { needsSetup } = useSetupStatus();
  const { session, profile, isStaff, loading, token } = useAuth();
  const { config, businessName, lockLandingEditMode, updateConfigOptimistic, notifyConfigChanged } =
    useAppConfig();
  const loaderData = Route.useLoaderData();

  const getProductsFn = useServerFn(listPublicLoanProducts);
  const centerFn = useServerFn(getMyLoanCenter);
  const saveLandingContentFn = useServerFn(adminSaveLandingContent);

  const { data: loanCenterData } = useQuery({
    queryKey: ["my-loan-center-dashboard", token],
    queryFn: () => centerFn({ headers: { authorization: `Bearer ${token}` } }),
    enabled: Boolean(token),
  });

  const [contentMap, setContentMap] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<LandingViewMode>("public");
  const [isHeroEditorOpen, setIsHeroEditorOpen] = useUrlBooleanState("editHeroImage");

  const currentHeroImageUrl = contentMap["hero_image_url"] || heroImg;

  useEffect(() => {
    if (config?.landingContent) {
      try {
        const parsed = JSON.parse(config.landingContent);
        setContentMap(parsed);
        setHasUnsavedChanges(false);
      } catch {
        setContentMap({});
      }
    }
  }, [config?.landingContent]);

  const handleTextChange = (id: string, newText: string) => {
    setContentMap((prev) => {
      const next = { ...prev, [id]: newText };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleHeroImageSave = async (newUrl: string) => {
    const nextMap = { ...contentMap, hero_image_url: newUrl };
    setContentMap(nextMap);
    const jsonStr = JSON.stringify(nextMap);
    // Instant optimistic update + cross-tab broadcast
    updateConfigOptimistic({ landingContent: jsonStr });
    notifyConfigChanged({ landingContent: jsonStr });

    if (token && isStaff) {
      try {
        await saveLandingContentFn({
          data: { landingContent: jsonStr },
          headers: { authorization: `Bearer ${token}` },
        });
        setHasUnsavedChanges(false);
      } catch (e) {
        console.warn("[Landing Hero] Immediate save fallback to debounce:", e);
        setHasUnsavedChanges(true);
      }
    } else {
      setHasUnsavedChanges(true);
    }
  };

  const handleHeroLivePreview = (previewUrl: string) => {
    setContentMap((prev) => ({ ...prev, hero_image_url: previewUrl }));
  };

  // Seeded with the loader's server-fetched products so there's no
  // client-side waterfall on first paint; useQuery only re-fetches after
  // staleTime or on invalidation from here on.
  const { data: dbProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ["public-loan-products"],
    queryFn: () => getProductsFn(),
    initialData: loaderData?.products,
    staleTime: 5 * 60 * 1000,
  });

  // Define the active, operational pipeline statuses that block a new loan
  const blockingStatuses = [
    "pending_guarantors",
    "pending_approval",
    "approved",
    "disbursing",
    "active",
    "defaulted",
  ];

  const activeOrPendingLoan = (loanCenterData?.loans ?? []).find((l: any) =>
    blockingStatuses.includes(l.status),
  );

  const latestLoan: any = activeOrPendingLoan || loanCenterData?.loans?.[0];
  const hasActiveOrPendingOrRejectedLoan =
    latestLoan && blockingStatuses.includes(latestLoan.status);

  const displayTiers = dbProducts && dbProducts.length > 0 ? dbProducts : null;

  const isLoggedIn = !!session;
  const isStaffUser = !!isStaff;
  const editableIsStaff = isStaffUser && !lockLandingEditMode;
  const isBorrower = isLoggedIn && !isStaffUser;

  // Every branch checks isLoggedIn explicitly, so a signed-out visitor can
  // never render staff/borrower UI. Also: while `loading` is still true,
  // `session` is null, so isLoggedIn is false and showPublicUI is true —
  // meaning the public marketing page renders immediately without waiting
  // for auth to resolve. Once auth resolves, these flip to the correct
  // staff/borrower view if applicable. This is what replaces the old
  // full-page `if (loading) return <HomepageSkeleton />` block.
  const showStaffUI =
    isLoggedIn &&
    isStaffUser &&
    (!lockLandingEditMode ? viewMode === "staff" || viewMode === "all" : true);

  const showBorrowerUI =
    isLoggedIn &&
    (isStaffUser
      ? !lockLandingEditMode && (viewMode === "borrower" || viewMode === "all")
      : isBorrower);

  const showPublicUI = isLoggedIn
    ? isStaffUser && !lockLandingEditMode && (viewMode === "public" || viewMode === "all")
    : true;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminLandingBar
        hasUnsavedChanges={hasUnsavedChanges}
        contentMap={contentMap}
        onSaved={() => setHasUnsavedChanges(false)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lockLandingEditMode={lockLandingEditMode}
      />
      <SiteHeader />

      <main className="flex-1">
        {/* LOGGED IN USER ROLE-SPECIFIC GUIDES AT TOP */}
        {showStaffUI && (
          <section className="mx-auto max-w-6xl px-4 pt-8 pb-4">
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
              <AdminGuide
                businessName={businessName}
                contentMap={contentMap}
                onChange={handleTextChange}
                isStaff={editableIsStaff}
              />
            </Suspense>
          </section>
        )}

        {showBorrowerUI && (
          <section className="mx-auto max-w-6xl px-4 pt-8 pb-4">
            <BorrowerGuide
              first_name={profile?.first_name || ""}
              loan_limit={Number(profile?.loan_limit || 1000)}
              credibility_score={profile?.credibility_score || 300}
              is_earning_points_frozen={profile?.is_earning_points_frozen || false}
              businessName={businessName}
              hasActiveOrPendingOrRejectedLoan={hasActiveOrPendingOrRejectedLoan}
              contentMap={contentMap}
              onChange={handleTextChange}
              isStaff={editableIsStaff}
            />
          </section>
        )}

        {showPublicUI && (
          <>
            {/* HERO MARKETING SECTION WITH FRAMER MOTION ANIMATIONS */}
            <section className="relative overflow-hidden bg-gradient-hero">
              <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <motion.h1
                    variants={itemVariants}
                    className="text-4xl font-bold leading-tight text-primary-foreground sm:text-5xl font-display"
                  >
                    <EditableLandingText
                      id="hero_title"
                      defaultText="Fair, Fast Loans Backed by People You Trust"
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </motion.h1>

                  <motion.div
                    variants={itemVariants}
                    className="max-w-xl text-base leading-relaxed text-primary-foreground/85 sm:text-lg"
                  >
                    <EditableLandingText
                      id="hero_subtitle"
                      defaultText={`Build your credibility score with ${businessName}, invite digital guarantors, and receive instant payouts directly to your M-Pesa wallet with zero hidden fees.`}
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      multiline
                      as="p"
                    />
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {!loading && (
                      <motion.div
                        variants={authRevealVariants}
                        className="flex flex-wrap gap-3 pt-2"
                      >
                        {needsSetup ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="onDark" size="xl" asChild>
                                <Link to="/setup">Set up business</Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Launch initial onboarding to configure business identity, colors, and
                              admin details
                            </TooltipContent>
                          </Tooltip>
                        ) : isLoggedIn ? (
                          isStaffUser ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="gold" size="xl" asChild>
                                  <Link to="/admin">
                                    <ShieldCheck className="mr-2 size-4" />
                                    Open Admin Console
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                Access the administrator management dashboard for loans,
                                disbursement queues, and settings
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="gold" size="xl" asChild>
                                  <Link to="/loans">
                                    <Banknote className="mr-2 size-4" />
                                    Apply for Loan
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                Explore current loan tiers, review your limit, and submit a loan
                                request
                              </TooltipContent>
                            </Tooltip>
                          )
                        ) : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="gold" size="xl" asChild>
                                  <Link to="/auth" search={{ mode: "register" }}>
                                    Open Borrower Account
                                    <ArrowRight className="ml-1 size-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                Create your borrower profile using your National ID and M-Pesa
                                mobile number
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="onDark" size="xl" asChild>
                                  <Link to="/auth">Sign In</Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                Sign in to your borrower, agent, or administrator account
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    className="mt-10 grid max-w-md grid-cols-3 gap-6"
                  >
                    {[
                      {
                        valId: "hero_stat1_val",
                        lblId: "hero_stat1_lbl",
                        defVal: "60s",
                        defLbl: "To disburse",
                      },
                      {
                        valId: "hero_stat2_val",
                        lblId: "hero_stat2_lbl",
                        defVal: "2",
                        defLbl: "Guarantors",
                      },
                      {
                        valId: "hero_stat3_val",
                        lblId: "hero_stat3_lbl",
                        defVal: "KES",
                        defLbl: "Multi-currency ready",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.valId}
                        className="font-display text-2xl text-gold font-semibold"
                      >
                        <dt className="font-semibold text-gold font-display text-2xl">
                          <EditableLandingText
                            id={stat.valId}
                            defaultText={stat.defVal}
                            contentMap={contentMap}
                            onChange={handleTextChange}
                            isStaff={editableIsStaff}
                            as="span"
                          />
                        </dt>
                        <dd className="text-primary-foreground/70 text-xs mt-1">
                          <EditableLandingText
                            id={stat.lblId}
                            defaultText={stat.defLbl}
                            contentMap={contentMap}
                            onChange={handleTextChange}
                            isStaff={editableIsStaff}
                            as="span"
                          />
                        </dd>
                      </div>
                    ))}
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                  className="relative group"
                >
                  {editableIsStaff && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIsHeroEditorOpen(true)}
                          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-background/90 hover:bg-background px-3.5 py-2 text-xs font-semibold text-foreground shadow-lift backdrop-blur-xs border border-border/80 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Camera className="size-4 text-primary animate-pulse" />
                          <span>Change Hero Image</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Click to upload an image or choose from curated fintech presets
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="overflow-hidden rounded-3xl shadow-lift ring-1 ring-primary-foreground/15">
                    <img
                      key={currentHeroImageUrl}
                      src={currentHeroImageUrl}
                      alt="Kenyan M-Pesa lending application"
                      width={1600}
                      height={1200}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = heroImg;
                      }}
                    />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <Card className="absolute -bottom-6 left-4 w-64 border-0 shadow-lift bg-background/95 backdrop-blur-xs">
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className="flex size-10 items-center justify-center rounded-full bg-success/15">
                          <Banknote className="size-5 text-success" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">
                            <EditableLandingText
                              id="hero_badge_title"
                              defaultText="Disbursed · KES 12,500"
                              contentMap={contentMap}
                              onChange={handleTextChange}
                              isStaff={editableIsStaff}
                              as="span"
                            />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <EditableLandingText
                              id="hero_badge_subtitle"
                              defaultText="B2C to 2547•••••234"
                              contentMap={contentMap}
                              onChange={handleTextChange}
                              isStaff={editableIsStaff}
                              as="span"
                            />
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* THREE STEPS TO FUNDED */}
            <section id="how-it-works" className="border-t border-border/60 bg-muted/30 py-20">
              <div className="mx-auto max-w-6xl px-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="max-w-2xl"
                >
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    <EditableLandingText
                      id="steps_section_title"
                      defaultText="Three Simple Steps to Get Funded"
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    <EditableLandingText
                      id="steps_section_subtitle"
                      defaultText="Designed for fast, mobile-first borrowing anywhere in Kenya."
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </p>
                </motion.div>

                <ol className="mt-12 grid gap-6 md:grid-cols-3">
                  {steps.map((step, index) => {
                    const titleKey = `step_${index + 1}_title`;
                    const bodyKey = `step_${index + 1}_body`;
                    return (
                      <motion.li
                        key={step.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <Card className="h-full border-border/70 bg-background shadow-soft hover:shadow-lift transition-all">
                          <CardHeader className="pb-3">
                            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <step.icon className="size-6" />
                            </span>
                            <CardTitle className="pt-3 text-lg font-semibold">
                              <span className="text-muted-foreground">{index + 1}. </span>
                              <EditableLandingText
                                id={titleKey}
                                defaultText={step.title}
                                contentMap={contentMap}
                                onChange={handleTextChange}
                                isStaff={editableIsStaff}
                                as="span"
                              />
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            <EditableLandingText
                              id={bodyKey}
                              defaultText={step.body}
                              contentMap={contentMap}
                              onChange={handleTextChange}
                              isStaff={editableIsStaff}
                              multiline
                              as="span"
                            />
                          </CardContent>
                        </Card>
                      </motion.li>
                    );
                  })}
                </ol>
              </div>
            </section>

            {/* CREDIBILITY SCORING & DYNAMIC REAL LOAN TIERS FROM DATABASE */}
            <section id="credibility" className="border-t border-border/60 bg-background py-20">
              <div className="mx-auto max-w-6xl px-4">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="max-w-2xl"
                >
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    <EditableLandingText
                      id="cred_section_title"
                      defaultText="Start Small. Repay On-Time. Unlock Higher Limits."
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    <EditableLandingText
                      id="cred_section_subtitle"
                      defaultText={`Build an official credibility rating on ${businessName}. On-time repayments unlock bigger credit limits and lower interest rates.`}
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      multiline
                      as="span"
                    />
                  </p>
                </motion.div>

                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={staggerContainer}
                  className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
                >
                  {isProductsLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <Card key={idx} className="h-full border-border/70 p-5 space-y-4 shadow-soft">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                      </Card>
                    ))
                  ) : !displayTiers || displayTiers.length === 0 ? (
                    <div className="col-span-full py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-card p-8">
                      <p className="text-sm font-semibold text-foreground">No loan tiers</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No loan product tiers are currently configured or active.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const maxTierAmount = Math.max(
                        ...displayTiers.map(
                          (t: { max_amount: number }) => Number(t.max_amount) || 0,
                        ),
                        1,
                      );

                      return displayTiers.map(
                        (
                          tier: {
                            name: string;
                            max_amount: number;
                            min_credibility: number;
                            interest_rate: number;
                            penalty_rate?: number | null;
                            custom_penalty_amount?: number | null;
                            term_days: number;
                          },
                          idx: number,
                        ) => {
                          const widthPct = Math.min(
                            100,
                            Math.max(15, (Number(tier.max_amount) / maxTierAmount) * 100),
                          );

                          const hasPenalty =
                            (tier.custom_penalty_amount !== null &&
                              tier.custom_penalty_amount !== undefined &&
                              Number(tier.custom_penalty_amount) > 0) ||
                            (tier.penalty_rate !== null &&
                              tier.penalty_rate !== undefined &&
                              Number(tier.penalty_rate) > 0);

                          return (
                            <motion.div
                              key={`${tier.name}-${idx}`}
                              initial={{ opacity: 0, y: 20 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.4, delay: idx * 0.08 }}
                            >
                              <Card className="h-full border-border/70 shadow-soft hover:shadow-lift transition-all">
                                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        {tier.name}
                                      </p>
                                      <span className="text-[11px] text-muted-foreground font-medium">
                                        {tier.term_days}d
                                      </span>
                                    </div>
                                    <p className="mt-3 font-display text-xl font-bold text-primary">
                                      {formatKes(tier.max_amount)}{" "}
                                      <span className="text-xs text-primary font-light">Limit</span>
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                                      {tier.min_credibility} pts min
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      {Math.round(tier.interest_rate * 100)}% interest rate
                                    </p>
                                    {/*{hasPenalty ? (
                                      <p className="mt-0.5 text-[10px] text-destructive/80 font-medium">
                                        Default fee:{" "}
                                        {tier.custom_penalty_amount
                                          ? `${formatKes(tier.custom_penalty_amount)}/24h`
                                          : `${Math.round((tier.penalty_rate ?? 0.25) * 100)}% interest/24h`}
                                      </p>
                                    ) : (
                                      <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">
                                        No penalty fee
                                      </p>
                                    )}*/}
                                  </div>
                                  <motion.div
                                    className="h-1.5 rounded-full bg-gradient-brand"
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${widthPct}%` }}
                                    viewport={{ once: true }}
                                    transition={{
                                      duration: 0.6,
                                      delay: 0.2 + idx * 0.1,
                                      ease: "easeOut",
                                    }}
                                    aria-hidden
                                  />
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        },
                      );
                    })()
                  )}
                </motion.div>
              </div>
            </section>

            {/* BUSINESS FEATURES GRID */}
            <section id="features" className="border-t border-border/60 bg-muted/20 py-20">
              <div className="mx-auto max-w-6xl px-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="max-w-2xl"
                >
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    <EditableLandingText
                      id="features_section_title"
                      defaultText={`Why Borrowers Choose ${businessName}`}
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    <EditableLandingText
                      id="features_section_subtitle"
                      defaultText="A modern, secure lending platform built specifically for Kenyan borrowers and lending operations."
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      multiline
                      as="span"
                    />
                  </p>
                </motion.div>

                <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {features.map((feature, idx) => {
                    const titleKey = `feature_${idx + 1}_title`;
                    const bodyKey = `feature_${idx + 1}_body`;
                    return (
                      <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: idx * 0.08 }}
                      >
                        <Card className="h-full border-border/70 bg-background shadow-soft hover:shadow-lift transition-all">
                          <CardHeader className="pb-2">
                            <span className="p-2.5 rounded-xl bg-primary/10 text-primary w-fit">
                              <feature.icon className="size-5" />
                            </span>
                            <CardTitle className="pt-3 text-base font-semibold">
                              <EditableLandingText
                                id={titleKey}
                                defaultText={feature.title}
                                contentMap={contentMap}
                                onChange={handleTextChange}
                                isStaff={editableIsStaff}
                                as="span"
                              />
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            <EditableLandingText
                              id={bodyKey}
                              defaultText={feature.body}
                              contentMap={contentMap}
                              onChange={handleTextChange}
                              isStaff={editableIsStaff}
                              multiline
                              as="span"
                            />
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* TESTIMONIALS CAROUSEL */}
            <section id="testimonials" className="border-t border-border/60 bg-background py-20">
              <div className="mx-auto max-w-6xl px-4 space-y-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="max-w-2xl"
                >
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    <EditableLandingText
                      id="testimonials_title"
                      defaultText="Trusted by Borrowers Across Kenya"
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      as="span"
                    />
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    <EditableLandingText
                      id="testimonials_subtitle"
                      defaultText={`Read real stories from borrowers who grew their credit limits and expanded their businesses with ${businessName}.`}
                      contentMap={contentMap}
                      onChange={handleTextChange}
                      isStaff={editableIsStaff}
                      multiline
                      as="span"
                    />
                  </p>
                </motion.div>

                <TestimonialsCarousel />
              </div>
            </section>

            {/* CALL TO ACTION BANNER */}
            <section className="mx-auto max-w-6xl px-4 pb-24">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="rounded-3xl bg-gradient-hero px-6 py-14 shadow-lift sm:px-12 text-center text-primary-foreground space-y-6"
              >
                <h2 className="text-3xl font-bold sm:text-4xl font-display">
                  <EditableLandingText
                    id="cta_title"
                    defaultText="Ready to Get Your First Loan?"
                    contentMap={contentMap}
                    onChange={handleTextChange}
                    isStaff={editableIsStaff}
                    as="span"
                  />
                </h2>
                <p className="mx-auto max-w-xl text-primary-foreground/85 text-sm sm:text-base">
                  <EditableLandingText
                    id="cta_subtitle"
                    defaultText="Register in under 2 minutes with your National ID and M-Pesa phone number. No physical paperwork required."
                    contentMap={contentMap}
                    onChange={handleTextChange}
                    isStaff={editableIsStaff}
                    multiline
                    as="span"
                  />
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="gold" size="xl" asChild>
                        <Link to="/auth" search={{ mode: "register" }}>
                          Open a Borrower Account
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Create your borrower profile using your National ID and M-Pesa phone number
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="onDark" size="xl" asChild>
                        <Link to="/auth">Sign In</Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Log in to access your dashboard, payments, or loan requests
                    </TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>
            </section>

            {/* NEWSLETTER */}
            <section className="mx-auto max-w-6xl px-4 pb-12">
              <NewsletterForm />
            </section>
          </>
        )}
      </main>

      {/* Hero Image Editor Modal (Accessible to Admins & Agents) — lazy
          loaded and only rendered once actually opened, so anonymous
          visitors never pay for this bundle. */}
      {isHeroEditorOpen && (
        <Suspense fallback={null}>
          <HeroImageEditor
            isOpen={isHeroEditorOpen}
            onOpenChange={setIsHeroEditorOpen}
            currentImage={currentHeroImageUrl}
            defaultImage={heroImg}
            onSave={handleHeroImageSave}
            onReset={() => handleHeroImageSave("")}
            onLivePreview={handleHeroLivePreview}
          />
        </Suspense>
      )}

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-muted/40 py-10 mt-auto">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <BrandMark />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground hover:underline">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link to="/credibility" className="hover:text-foreground hover:underline">
              Credibility
            </Link>
            <Link to="/referrals" className="hover:text-foreground hover:underline">
              Referrals
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {businessName}. Powered by Safaricom M-Pesa integration.
          </p>
        </div>
      </footer>
    </div>
  );
}
