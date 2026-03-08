import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  signOut: () => Promise<void>;
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
  signOut: async () => {},
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

  const fetchUserData = async (userId: string) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("account_status, organization_id").eq("user_id", userId).single(),
      ]);

      // Determine highest role
      const roles = rolesRes.data?.map((r) => r.role) ?? [];
      if (roles.includes("super_admin")) setRole("super_admin");
      else if (roles.includes("admin")) setRole("admin");
      else if (roles.includes("member")) setRole("member");
      else setRole(null);

      setAccountStatus(profileRes.data?.account_status ?? null);
      const orgId = profileRes.data?.organization_id ?? null;
      setOrganizationId(orgId);

      // Fetch org name if exists
      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single();
        setOrganizationName(orgData?.name ?? null);
      } else {
        setOrganizationName(null);
      }
    } catch {
      setRole(null);
      setAccountStatus(null);
      setOrganizationId(null);
      setOrganizationName(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            await fetchUserData(session.user.id);
            if (mounted) setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setAccountStatus(null);
          setOrganizationId(null);
          setOrganizationName(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
