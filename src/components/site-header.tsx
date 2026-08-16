import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  FlaskConical,
  LayoutDashboard,
  HelpCircle,
  LogOut,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notification-center";
import { UserSupportDialog } from "@/components/user-support-sheet";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { getDarajaEnvironment } from "@/lib/admin.functions";
import { useSetupStatus } from "@/lib/use-setup-status";

export function SiteHeader() {
  const {
    session,
    profile,
    isStaff,
    isAdmin,
    hasPermission,
    canAccessUserFeatures,
    loading,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const envFn = useServerFn(getDarajaEnvironment);
  const { needsSetup } = useSetupStatus();

  const canHandleSupport = isAdmin || hasPermission("handle_user_requests");

  const envQuery = useQuery({
    queryKey: ["daraja-env"],
    queryFn: () => envFn(),
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const isSandbox = envQuery.data?.environment === "sandbox";
  const scrollIntoView = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  const navItemClass = (active: boolean) => (active ? "text-primary font-medium" : "");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          {isSandbox && (
            <Badge
              variant="outline"
              className="border-warning/40 bg-warning/10 text-warning-foreground"
            >
              <FlaskConical className="mr-1 size-3" />
              Sandbox
            </Badge>
          )}
        </div>

        {!needsSetup && !loading && (
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {session ? (
              <>
                {canAccessUserFeatures && (
                  <>
                    <Link
                      to="/loans"
                      className={
                        path === "/loans"
                          ? "transition-colors text-primary underline underline-offset-3"
                          : "transition-colors hover:text-primary"
                      }
                    >
                      Request a loan
                    </Link>
                    <Link
                      to="/credibility"
                      className={
                        path === "/credibility"
                          ? "transition-colors text-primary underline underline-offset-3"
                          : "transition-colors hover:text-primary"
                      }
                    >
                      Credibility
                    </Link>
                    <Link
                      to="/referrals"
                      className={
                        path === "/referrals"
                          ? "transition-colors text-primary underline underline-offset-3"
                          : "transition-colors hover:text-primary"
                      }
                    >
                      Referrals
                    </Link>
                  </>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="link"
                  onClick={() => scrollIntoView("how-it-works")}
                  className={
                    path === "/#how-it-works"
                      ? "transition-colors text-primary underline underline-offset-3"
                      : "transition-colors text-muted-foreground hover:text-primary"
                  }
                >
                  How it works
                </Button>
                <Button
                  variant="link"
                  onClick={() => scrollIntoView("credibility")}
                  className={
                    path === "/#credibility"
                      ? "transition-colors text-primary underline underline-offset-3"
                      : "transition-colors text-muted-foreground hover:text-primary"
                  }
                >
                  Credibility
                </Button>
                <Button
                  variant="link"
                  onClick={() => scrollIntoView("testimonials")}
                  className={
                    path === "/#testimonials"
                      ? "transition-colors text-primary underline underline-offset-3"
                      : "transition-colors text-muted-foreground hover:text-primary"
                  }
                >
                  Testimonials
                </Button>
              </>
            )}
          </nav>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ) : session ? (
            <>
              {/* Support: full icon button on desktop; folded into the
                  account dropdown below on mobile. Kept visible here (not
                  hidden) still requires md check so it doesn't duplicate. */}
              {!canHandleSupport && (
                <UserSupportDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden size-9 md:inline-flex"
                      title="Support & Help"
                    >
                      <HelpCircle className="size-6 text-foreground hover:text-primary transition-colors" />
                    </Button>
                  }
                />
              )}

              {/* Notifications: kept visible at all sizes — see note below
                  on why this one isn't folded into the dropdown. */}
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-gradient-brand text-xs text-primary-foreground">
                        {initials(profile?.first_name, profile?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-28 truncate sm:inline">
                      {profile?.first_name || "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{profile?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Nav links + Support — visible here only on mobile, since
                      the inline `nav` and the standalone Support button above
                      already cover these on md+ screens. */}
                  <div className="md:hidden">
                    {canAccessUserFeatures && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => navigate({ to: "/loans" })}
                          className={navItemClass(path === "/loans")}
                        >
                          <Wallet className="mr-2 size-4" /> Request a loan
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => navigate({ to: "/credibility" })}
                          className={navItemClass(path === "/credibility")}
                        >
                          <Award className="mr-2 size-4" /> Credibility
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => navigate({ to: "/referrals" })}
                          className={navItemClass(path === "/referrals")}
                        >
                          <Users className="mr-2 size-4" /> Referrals
                        </DropdownMenuItem>
                      </>
                    )}
                    {!canHandleSupport && (
                      <UserSupportDialog
                        trigger={
                          // preventDefault stops Radix's DropdownMenu from
                          // closing/restoring focus before the nested Dialog
                          // has a chance to open — standard recipe for
                          // Dialog-inside-DropdownMenu.
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <HelpCircle className="mr-2 size-4" /> Support & Help
                          </DropdownMenuItem>
                        }
                      />
                    )}
                    <DropdownMenuSeparator />
                  </div>

                  {canAccessUserFeatures && (
                    <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
                      <LayoutDashboard className="mr-2 size-4" /> Dashboard
                    </DropdownMenuItem>
                  )}
                  {isStaff && (
                    <DropdownMenuItem onSelect={() => navigate({ to: "/admin" })}>
                      <ShieldCheck className="mr-2 size-4" /> Admin console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => navigate({ to: "/account" })}>
                    <User className="mr-2 size-4" /> Account & Security
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {needsSetup ? (
                <Button variant="hero" asChild>
                  <Link to="/setup">Set up your business</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/auth">Sign in</Link>
                  </Button>
                  <Button variant="hero" asChild>
                    <Link to="/auth" search={{ mode: "register" }}>
                      Get started
                    </Link>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
