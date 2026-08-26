import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthProfile } from "@/lib/account.functions";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  id_number: string | null;
  referral_code: string;
  referred_by: string | null;
  credibility_score: number;
  is_earning_points_frozen?: boolean;
  loan_limit: number;
  status: "pending" | "active" | "suspended";
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export type Role = "super_admin" | "staff" | "user";

export interface AuthSession {
  token: string;
  userId: string;
}

const AUTH_TOKEN_KEY = "mikopo_auth_token";
const CACHED_IDENTITY_KEY = "mikopo_cached_identity";
const AUTH_COOKIE_NAME = "mikopo_auth_token";

export function canAccessUserFeatures(roles: Role[], permissions: string[]): boolean {
  if (roles.includes("super_admin")) {
    return false;
  }
  if (roles.includes("staff")) {
    const restrictedPermissions = [
      "approve_loans",
      "manage_users",
      "manage_tiers",
      "manage_phone_requests",
      "manage_settings",
    ];
    const hasOtherAgentRoles = permissions.some((p) => restrictedPermissions.includes(p));
    if (hasOtherAgentRoles) {
      return false;
    }
    return true;
  }
  return true;
}

interface AuthValue {
  session: AuthSession | null;
  token: string | null;
  profile: Profile | null;
  roles: Role[];
  permissions: string[];
  isInitialAdmin: boolean;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  canAccessUserFeatures: boolean;
  hasPermission: (perm: string) => boolean;
  setAuthSession: (token: string, userId: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Clears every trace of a cached identity: token, cookie, and the offline
 * snapshot. Must run on sign-out and on any invalid-token path — leaving
 * the snapshot behind after clearing the token is what previously let a
 * signed-out visitor inherit a stale user's roles on the next page load.
 */
function clearStoredIdentity() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CACHED_IDENTITY_KEY);
  }
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isInitialAdmin, setIsInitialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const lastActivityRef = useRef<number>(typeof Date !== "undefined" ? Date.now() : 0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, []);

  const loadIdentity = useCallback(async (authToken: string) => {
    try {
      if (typeof document !== "undefined") {
        document.cookie = `${AUTH_COOKIE_NAME}=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
      }
      const data = await getAuthProfile({
        data: { token: authToken },
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (data) {
        const newProfile = data.profile as Profile;
        setProfile((prev) => {
          if (prev && JSON.stringify(prev) === JSON.stringify(newProfile)) {
            return prev;
          }
          return newProfile;
        });

        const newRoles = (data.roles as Role[]) || [];
        setRoles((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newRoles)) {
            return prev;
          }
          return newRoles;
        });

        const newPermissions = data.permissions || [];
        setPermissions((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newPermissions)) {
            return prev;
          }
          return newPermissions;
        });

        const newIsInitialAdmin = Boolean(data.isInitialAdmin);
        setIsInitialAdmin((prev) => (prev === newIsInitialAdmin ? prev : newIsInitialAdmin));

        // Save identity snapshot to localStorage for instant offline access.
        // Only ever read back inside the savedToken branch of the mount
        // effect below, or in the genuinely-offline branch of this
        // function's catch — never when there is no token.
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(
              CACHED_IDENTITY_KEY,
              JSON.stringify({
                profile: newProfile,
                roles: newRoles,
                permissions: newPermissions,
                isInitialAdmin: newIsInitialAdmin,
                savedAt: Date.now(),
              }),
            );
          } catch (e) {
            console.warn("[AuthContext] Failed to cache identity:", e);
          }
        }
      } else {
        // Server explicitly returned null/unauthorized for this token.
        // Only trust this while online, to avoid acting on a flaky
        // connection's false negative.
        if (typeof navigator !== "undefined" && navigator.onLine) {
          setSession(null);
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setIsInitialAdmin(false);
          clearStoredIdentity();
        }
      }
    } catch {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      if (isOffline) {
        // Genuinely offline: fall back to the last-known cached identity so
        // the UI doesn't blank out mid-flight. Safe because it does NOT
        // touch `session` — the user still holds whatever token got them
        // here, we just can't re-verify it right now.
        if (typeof localStorage !== "undefined") {
          const cached = localStorage.getItem(CACHED_IDENTITY_KEY);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.profile) setProfile(parsed.profile);
              if (parsed.roles) setRoles(parsed.roles);
              if (parsed.permissions) setPermissions(parsed.permissions);
              if (parsed.isInitialAdmin !== undefined) setIsInitialAdmin(parsed.isInitialAdmin);
            } catch (e) {
              console.warn("[AuthContext] Failed to parse cached identity:", e);
            }
          }
        }
        return;
      }

      // Online and the request still failed — treat as unauthorized rather
      // than silently keeping stale elevated roles/permissions around.
      setSession(null);
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setIsInitialAdmin(false);
      clearStoredIdentity();
    }
  }, []);

  useEffect(() => {
    const savedToken =
      typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;

    // No token on this device: nothing to authenticate, so we must NOT
    // restore any cached identity snapshot. This is the actual fix for
    // signed-out visitors seeing staff/borrower UI — the old code restored
    // the cache unconditionally, before this check even existed.
    if (!savedToken) {
      setLoading(false);
      return;
    }

    try {
      const base64Url = savedToken.split(".")[1];
      if (!base64Url) throw new Error("Malformed token");
      let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const payload = JSON.parse(atob(base64));
      if (!payload?.sub) throw new Error("Token missing subject");

      // Safe to pre-populate from cache now — loadIdentity() below is
      // about to validate this exact token with the server.
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem(CACHED_IDENTITY_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.profile) setProfile(parsed.profile);
            if (parsed.roles) setRoles(parsed.roles);
            if (parsed.permissions) setPermissions(parsed.permissions);
            if (parsed.isInitialAdmin !== undefined) setIsInitialAdmin(parsed.isInitialAdmin);
          } catch (e) {
            console.warn("[AuthContext] Failed to restore identity from cache:", e);
          }
        }
      }

      if (typeof document !== "undefined") {
        document.cookie = `${AUTH_COOKIE_NAME}=${savedToken}; path=/; max-age=2592000; SameSite=Lax`;
      }
      setSession({ token: savedToken, userId: payload.sub });
      void loadIdentity(savedToken).finally(() => setLoading(false));
    } catch {
      clearStoredIdentity();
      setLoading(false);
    }
  }, [loadIdentity]);

  const setAuthSession = useCallback(
    (token: string, userId: string) => {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      if (typeof document !== "undefined") {
        document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=2592000; SameSite=Lax`;
      }
      setSession({ token, userId });
      void loadIdentity(token);
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
    },
    [loadIdentity, queryClient],
  );

  const refresh = useCallback(async () => {
    const token =
      session?.token ||
      (typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
    if (token) {
      await loadIdentity(token);
    }
  }, [session?.token, loadIdentity]);

  useEffect(() => {
    if (typeof window === "undefined" || !session?.token) return;

    const interval = setInterval(() => {
      const idleTimeMs = Date.now() - lastActivityRef.current;
      const IDLE_THRESHOLD_MS = 30000;
      const isIdle = idleTimeMs >= IDLE_THRESHOLD_MS;
      const isHidden = typeof document !== "undefined" && document.hidden;

      if (isIdle || isHidden) {
        void refresh();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [session?.token, refresh]);

  const signOut = useCallback(async () => {
    // Clears the token, cookie, AND the cached identity snapshot. Leaving
    // the snapshot behind (the old bug) is what let a signed-out visitor
    // inherit the previous user's roles on the next page load.
    clearStoredIdentity();
    setSession(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    setIsInitialAdmin(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  const hasPermission = useCallback(
    (perm: string) => {
      if (roles.includes("super_admin")) return true;
      return permissions.includes(perm);
    },
    [roles, permissions],
  );

  const value = useMemo<AuthValue>(
    () => ({
      session,
      token: session?.token ?? null,
      profile,
      roles,
      permissions,
      isInitialAdmin,
      loading,
      // Gated on `session` too, so role state can never read as "staff"
      // without a live session backing it (defense in depth).
      isStaff: Boolean(session) && (roles.includes("super_admin") || roles.includes("staff")),
      isAdmin: Boolean(session) && roles.includes("super_admin"),
      canAccessUserFeatures: Boolean(session) && canAccessUserFeatures(roles, permissions),
      hasPermission,
      setAuthSession,
      refresh,
      signOut,
    }),
    [
      session,
      profile,
      roles,
      permissions,
      isInitialAdmin,
      loading,
      hasPermission,
      setAuthSession,
      refresh,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
