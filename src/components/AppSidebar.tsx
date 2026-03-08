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
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileMenuOpen]);

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) => {
    const active = location.pathname === to;

    const iconEl = (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Icon className="h-[18px] w-[18px]" />
      </div>
    );

    const content = (
      <Link
        to={to}
        className={cn(
          "relative flex items-center rounded-md transition-colors duration-200",
          active
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/5"
        )}
      >
        {iconEl}
        <span
          className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
          style={{
            width: open ? "140px" : "0px",
            opacity: open ? 1 : 0,
            marginRight: open ? "0px" : "0px",
          }}
        >
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all duration-300",
              open
                ? "ml-auto mr-2 h-5 w-5 text-[10px]"
                : "absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-[8px]"
            )}
          >
            {badge}
          </span>
        )}
      </Link>
    );

    if (!open) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
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
      className="fixed top-0 left-0 z-50 flex h-screen flex-col bg-sidebar border-r border-border/30 transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{ width: open ? "16rem" : "52px" }}
    >
      {/* Toggle button - fixed position, icon never moves */}
      <div className="flex h-14 items-center px-1.5">
        <button
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title={open ? "إغلاق القائمة" : "فتح القائمة"}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-1.5">
        {links.map((link) => (
          <NavItem key={link.to} to={link.to} icon={link.icon} label={link.label} />
        ))}
        <NavItem to="/notifications" icon={Bell} label="الإشعارات" badge={unreadCount} />
      </nav>

      <div className="relative border-t border-white/10 px-1.5 py-2" ref={profileMenuRef}>
        {/* Profile popover menu */}
        {profileMenuOpen && (
          <div className="absolute bottom-full left-1 mb-2 w-56 rounded-lg border border-border/40 bg-sidebar shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200 z-50">
            <div className="px-3 py-3 border-b border-white/10">
              <p className="text-sm font-medium text-white truncate">
                {isAdmin ? (organizationName || user?.user_metadata?.display_name || user?.email) : (user?.user_metadata?.display_name || user?.email)}
              </p>
              <p className="text-xs text-white/40 mt-0.5">{roleLabel}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => { setProfileMenuOpen(false); /* TODO: navigate to subscription */ }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                الاشتراك
              </button>
            </div>
            <div className="border-t border-white/10 p-1.5">
              <button
                onClick={() => { setProfileMenuOpen(false); signOut(); }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        )}

        {/* Profile trigger */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="flex w-full items-center rounded-md py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                  {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                </div>
              </div>
              <div
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
                style={{ width: open ? "140px" : "0px", opacity: open ? 1 : 0 }}
              >
                <p className="text-sm font-semibold text-white truncate text-left leading-9">
                  {isAdmin ? (organizationName || user?.user_metadata?.display_name || user?.email) : (user?.user_metadata?.display_name || user?.email)}
                </p>
              </div>
            </button>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="right" className="text-xs">
              {isAdmin ? (organizationName || user?.user_metadata?.display_name || user?.email) : (user?.user_metadata?.display_name || user?.email)}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
