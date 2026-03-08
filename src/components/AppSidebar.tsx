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
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

interface AppSidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ open, onToggle }: AppSidebarProps) {
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

  const sidebarWidth = open ? "w-64" : "w-[52px]";

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) => {
    const active = location.pathname === to;
    const content = (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
          open ? "" : "justify-center px-0",
          active
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/5"
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {open && <span className="truncate">{label}</span>}
        {open && badge != null && badge > 0 && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {badge}
          </span>
        )}
        {!open && badge != null && badge > 0 && (
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            {badge}
          </span>
        )}
      </Link>
    );

    if (!open) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="relative">{content}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-50 flex h-screen flex-col bg-sidebar border-r border-border/30 transition-all duration-300 ease-in-out",
        sidebarWidth
      )}
    >
      {/* Toggle button */}
      <div className={cn("flex items-center p-2 pt-3", open ? "justify-start px-3" : "justify-center")}>
        <button
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title={open ? "إغلاق القائمة" : "فتح القائمة"}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto", open ? "p-3" : "px-1.5 py-3")}>
        {links.map((link) => (
          <NavItem key={link.to} to={link.to} icon={link.icon} label={link.label} />
        ))}
        <NavItem to="/notifications" icon={Bell} label="الإشعارات" badge={unreadCount} />
      </nav>

      <div className={cn("border-t border-white/10", open ? "p-3" : "p-1.5")}>
        {/* Profile */}
        {open ? (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white shrink-0">
              {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {isAdmin ? (organizationName || user?.user_metadata?.display_name || user?.email) : (user?.user_metadata?.display_name || user?.email)}
              </p>
              <p className="text-[9px] text-white/40">{roleLabel}</p>
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-2 mb-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                  {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {isAdmin ? (organizationName || user?.user_metadata?.display_name || user?.email) : (user?.user_metadata?.display_name || user?.email)}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Sign out */}
        {open ? (
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            تسجيل الخروج
          </button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="flex w-full justify-center items-center rounded-md py-2.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              تسجيل الخروج
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
