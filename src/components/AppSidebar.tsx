import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  Zap,
  LayoutDashboard,
  Upload,
  FolderOpen,
  Shield,
  Users,
  Settings,
  LogOut,
  Building2,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const superAdminLinks = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/settings", label: "الإعدادات", icon: Settings },
  { to: "/privacy", label: "الخصوصية", icon: ShieldCheck },
];

const adminLinks = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/team", label: "إدارة الفريق", icon: Users },
  { to: "/moderation", label: "المراجعة", icon: Shield },
  { to: "/files", label: "جميع الملفات", icon: FolderOpen },
  { to: "/settings", label: "الإعدادات", icon: Settings },
  { to: "/privacy", label: "الخصوصية", icon: ShieldCheck },
];

const memberLinks = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/upload", label: "رفع ملفات", icon: Upload },
  { to: "/files", label: "ملفاتي", icon: FolderOpen },
  { to: "/privacy", label: "الخصوصية", icon: ShieldCheck },
];

export default function AppSidebar() {
  const { user, role, isSuperAdmin, isAdmin, signOut, organizationName } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const links = isSuperAdmin ? superAdminLinks : isAdmin ? adminLinks : memberLinks;

  const roleLabel = isSuperAdmin ? "مالك المنصة" : isAdmin ? "مسؤول الشركة" : "عضو فريق";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  return (
    <aside className="flex h-screen w-64 flex-col border-l border-border bg-sidebar" dir="rtl">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-border">
          <Zap className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">Media Follow</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {organizationName || roleLabel}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}

        {/* Notifications */}
        <Link
          to="/notifications"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            location.pathname === "/notifications"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Bell className="h-4 w-4" />
          الإشعارات
          {unreadCount > 0 && (
            <span className="mr-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Link>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
            {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {user?.user_metadata?.display_name || user?.email}
            </p>
            <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="ml-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </aside>
  );
}
