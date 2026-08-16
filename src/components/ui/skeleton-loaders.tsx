import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { motion } from "framer-motion";

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <motion.div
      className="w-full space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between py-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="rounded-md border p-4 space-y-4 bg-card">
        <div className="grid grid-cols-6 gap-4 border-b pb-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid grid-cols-6 gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border shadow-soft">
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="flex justify-end pt-2">
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Hero card / Active loan card skeleton */}
      <Card className="border p-6 shadow-soft space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </Card>

      {/* Grid skeleton */}
      <CardGridSkeleton count={3} />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 space-y-4 border">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full rounded-md" />
          </Card>
          <TableSkeleton rows={4} cols={4} />
        </div>
        <div className="space-y-6">
          <Card className="p-6 space-y-4 border">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function TicketSkeleton() {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4 border space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex justify-between items-center text-xs pt-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </motion.div>
  );
}

export function TestimonialsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-border/70 bg-gradient-surface p-6 space-y-4 shadow-soft">
          <div className="flex justify-between items-center">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, s) => (
                <Skeleton key={s} className="size-4 rounded-full" />
              ))}
            </div>
            <Skeleton className="size-6 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-2 flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function HomepageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col animate-pulse">
      {/* Hero Skeleton */}
      <section className="relative overflow-hidden bg-gradient-hero py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4 bg-primary-foreground/20 rounded-lg" />
            <Skeleton className="h-6 w-full bg-primary-foreground/15 rounded-md" />
            <Skeleton className="h-6 w-5/6 bg-primary-foreground/15 rounded-md" />
            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 w-44 bg-gold/30 rounded-xl" />
              <Skeleton className="h-12 w-32 bg-primary-foreground/20 rounded-xl" />
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-6 pt-4 border-t border-primary-foreground/10">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-7 w-16 bg-gold/30 rounded" />
                  <Skeleton className="h-3 w-20 bg-primary-foreground/20 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <Skeleton className="h-[340px] sm:h-[400px] w-full bg-primary-foreground/15 rounded-3xl" />
          </div>
        </div>
      </section>

      {/* Tiers Skeleton */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-6xl px-4 space-y-8">
          <div className="space-y-2 max-w-xl">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4 border">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-full rounded-full" />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Skeleton */}
      <section className="py-16 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 space-y-8">
          <div className="space-y-2 max-w-xl">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-full" />
          </div>
          <CardGridSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
