import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { DEFAULT_PRIVACY_MARKDOWN } from "@/lib/default-policies";
import BackButton from "@/components/back-button";
import { useAppConfig } from "@/lib/config-context";

export const Route = createFileRoute("/privacy")({
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
    const title = `Privacy Policy — ${businessName}`;
    const description = `Data Protection and Privacy Policy for ${businessName}. Learn how personal and financial data is collected, processed, and protected.`;
    const heroImage = (loaderData as any)?.heroImageUrl || "/hero-image.png";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:site_name", content: businessName },
        { property: "og:type", content: "website" },
        { property: "og:image", content: heroImage },
        { property: "og:image:type", content: "image/png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: heroImage },
      ],
    };
  },
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { businessName, supportEmail, privacyContent: customPrivacy } = useAppConfig();

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="space-y-3">
          <BackButton label="Back to Home" size="sm" to="/" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
              <p className="text-sm text-muted-foreground">
                {businessName} · Data Protection & Privacy Governance Policy
              </p>
            </div>
          </div>
        </div>

        <Card className="border-border/80 shadow-soft">
          <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
            <CardTitle className="text-lg">Our Commitment to Your Privacy</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm leading-relaxed text-foreground/90">
            <MarkdownRenderer content={customPrivacy || DEFAULT_PRIVACY_MARKDOWN} />

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-1 text-foreground">
              <h3 className="font-semibold text-sm text-primary">Have Privacy Questions?</h3>
              <p className="text-xs text-muted-foreground">
                {supportEmail ? (
                  <>
                    Contact our Data Protection Officer at <strong>{supportEmail}</strong>.
                  </>
                ) : (
                  <>Contact our Data Protection Officer through customer support.</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
