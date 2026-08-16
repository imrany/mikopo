import { LucideLoader } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export function LoadingPage({ title }: { title?: string }) {
  return (
    <div className="h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto flex flex-col w-full h-[80vh] items-center justify-center">
        <LucideLoader className="h-6 w-6 animate-spin text-primary" />
        {title && <p className="mt-4 text-sm text-muted-foreground">{title}</p>}
      </main>
    </div>
  );
}
