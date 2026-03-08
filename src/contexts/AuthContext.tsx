import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "super_admin" | "admin" | "member" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
  accountStatus: string | null;
  organizationId: string | null;
  organizationName: string | null;
  isOrgActive: boolean;
  displayName: string | null;
  signOut: () => Promise<void>;
  refreshOrgData: () => Promise<void>;
  refreshDisplayName: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  isMember: false,
  accountStatus: null,
  organizationId: null,
  organizationName: null,
  isOrgActive: true,
  displayName: null,
  signOut: async () => {},
  refreshOrgData: async () => {},
  refreshDisplayName: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isOrgActive, setIsOrgActive] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const sessionInitializedRef = useRef(false);

  const fetchUserData = async (userId: string) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("account_status, organization_id, display_name").eq("user_id", userId).single(),
      ]);

      // Determine highest role
      const roles = rolesRes.data?.map((r) => r.role) ?? [];
      if (roles.includes("super_admin")) setRole("super_admin");
      else if (roles.includes("admin")) setRole("admin");
      else if (roles.includes("member")) setRole("member");
      else setRole(null);

      setAccountStatus(profileRes.data?.account_status ?? null);
      setDisplayName(profileRes.data?.display_name ?? null);
      const orgId = profileRes.data?.organization_id ?? null;
      setOrganizationId(orgId);

      // Fetch org name if exists
      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name, is_active")
          .eq("id", orgId)
          .single();
        setOrganizationName(orgData?.name ?? null);
        setIsOrgActive(orgData?.is_active ?? true);
      } else {
        setOrganizationName(null);
        setIsOrgActive(true);
      }
    } catch {
      setRole(null);
      setAccountStatus(null);
      setDisplayName(null);
      setOrganizationId(null);
      setOrganizationName(null);
      setIsOrgActive(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setAccountStatus(null);
        setDisplayName(null);
        setOrganizationId(null);
        setOrganizationName(null);
        setLoading(false);
        return;
      }

      void fetchUserData(nextUser.id).finally(() => {
        if (mounted) setLoading(false);
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!sessionInitializedRef.current && event === "INITIAL_SESSION") return;
        if (!sessionInitializedRef.current) sessionInitializedRef.current = true;
        applySession(nextSession);
      }
    );

    void supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        sessionInitializedRef.current = true;
        applySession(initialSession);
      })
      .catch(() => {
        sessionInitializedRef.current = true;
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRole(null);
        setAccountStatus(null);
        setDisplayName(null);
        setOrganizationId(null);
        setOrganizationName(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshOrgData = async () => {
    if (!organizationId) return;
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name, is_active")
      .eq("id", organizationId)
      .single();
    if (orgData) {
      setOrganizationName(orgData.name);
      setIsOrgActive(orgData.is_active);
    }
  };

  const refreshDisplayName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();
    if (data) setDisplayName(data.display_name);
  };

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "super_admin";
  const isMember = role === "member";

  return (
    <AuthContext.Provider
      value={{
        user, session, loading, role,
        isSuperAdmin, isAdmin, isMember,
        accountStatus, organizationId, organizationName,
        isOrgActive, displayName,
        signOut, refreshOrgData, refreshDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
