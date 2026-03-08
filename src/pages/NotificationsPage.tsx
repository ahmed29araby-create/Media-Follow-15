import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, Film, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
  organization_id: string | null;
}

export default function NotificationsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [processingAppeal, setProcessingAppeal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetch_ = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications(data ?? []);
  };

  useEffect(() => { fetch_(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetch_())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetch_();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    fetch_();
  };

  const toggleExpand = (n: Notification) => {
    if (expandedId === n.id) {
      setExpandedId(null);
    } else {
      setExpandedId(n.id);
      if (!n.is_read && n.type !== "appeal") markRead(n.id);
    }
  };

  const handleAppealAction = async (notification: Notification, approve: boolean) => {
    if (!notification.organization_id) return;
    setProcessingAppeal(notification.id);
    
    try {
      await supabase.from("org_appeals" as any)
        .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq("organization_id", notification.organization_id)
        .eq("status", "pending");

      if (approve) {
        await supabase
          .from("organizations")
          .update({ is_active: true, disable_reason: null } as any)
          .eq("id", notification.organization_id);

        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("organization_id", notification.organization_id);
        
        if (orgProfiles) {
          for (const p of orgProfiles) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              title: "تم إعادة تفعيل الشركة",
              message: "تمت الموافقة على طلبك وتم إعادة تفعيل شركتك بنجاح.",
              type: "info",
              organization_id: notification.organization_id,
            });
          }
        }
        toast.success("تم قبول الطلب وإعادة تفعيل الشركة");
      } else {
        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("organization_id", notification.organization_id);
        
        if (orgProfiles) {
          for (const p of orgProfiles) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              title: "تم رفض طلب إعادة التفعيل",
              message: "تم رفض طلب إعادة تفعيل الشركة من قِبل إدارة المنصة.",
              type: "info",
              organization_id: notification.organization_id,
            });
          }
        }
        toast.success("تم رفض الطلب");
      }

      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      fetch_();
    } catch {
      toast.error("حدث خطأ أثناء معالجة الطلب");
    }
    setProcessingAppeal(null);
  };

  const getNotificationIcon = (type: string, isRead: boolean) => {
    if (type === "appeal") return <AlertTriangle className={`h-4 w-4 ${isRead ? "text-muted-foreground" : "text-warning"}`} />;
    if (type === "offer") return <Gift className={`h-4 w-4 ${isRead ? "text-muted-foreground" : "text-primary"}`} />;
    return <Film className={`h-4 w-4 ${isRead ? "text-muted-foreground" : "text-primary"}`} />;
  };

  const getNotificationBg = (type: string, isRead: boolean) => {
    if (type === "appeal" && !isRead) return "bg-warning/10";
    if (type === "offer" && !isRead) return "bg-primary/10";
    return isRead ? "bg-secondary" : "bg-primary/10";
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-3 pb-4 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>الإشعارات</h1>
          <p className="text-sm text-muted-foreground">جميع التحديثات والإشعارات</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="ml-2 h-4 w-4" />
            تعيين الكل كمقروء
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
          </div>
        ) : (
          notifications.map(n => {
            const isExpanded = expandedId === n.id;
            return (
              <div
                key={n.id}
                className={`glass-panel overflow-hidden transition-all ${n.is_read ? "opacity-60" : ""}`}
              >
                {/* Header row - always visible */}
                <button
                  onClick={() => toggleExpand(n)}
                  className="w-full flex items-center gap-3 p-4 text-right hover:bg-accent/5 transition-colors"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${getNotificationBg(n.type, n.is_read)}`}>
                    {getNotificationIcon(n.type, n.is_read)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleDateString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expandable detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line leading-relaxed">
                      {n.message}
                    </p>

                    {/* Appeal actions for super admin */}
                    {n.type === "appeal" && isSuperAdmin && !n.is_read && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1.5 text-xs"
                          disabled={processingAppeal === n.id}
                          onClick={(e) => { e.stopPropagation(); handleAppealAction(n, true); }}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          قبول وتفعيل الشركة
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 text-xs"
                          disabled={processingAppeal === n.id}
                          onClick={(e) => { e.stopPropagation(); handleAppealAction(n, false); }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
