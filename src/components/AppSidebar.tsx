import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Shield,
  Users,
  Settings,
  LogOut,
  Bell,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const superAdminLinks = [
  { to: "/dashboard", label: "لوحة تحكم الموقع", icon: Globe },
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
  const { user, role, isSuperAdmin, isAdmin, signOut } = useAuth();
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
    <aside className="flex h-screen w-64 flex-col border-l border-border/30 bg-sidebar" dir="rtl">
      <nav className="flex-1 p-3 pt-5 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
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
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
            location.pathname === "/notifications"
              ? "bg-white/10 text-white"
              : "text-white/70 hover:text-white hover:bg-white/5"
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

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
            {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user?.user_metadata?.display_name || user?.email}
            </p>
            <p className="text-[9px] text-white/40">{roleLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
        >
          <LogOut className="ml-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </aside>
  );
}
