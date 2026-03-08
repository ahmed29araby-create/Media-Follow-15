import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  // Realtime
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

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإشعارات</h1>
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
          notifications.map(n => (
            <div
              key={n.id}
              className={`glass-panel p-4 flex items-start gap-3 animate-slide-in cursor-pointer transition-opacity ${n.is_read ? "opacity-60" : ""}`}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${n.is_read ? "bg-secondary" : "bg-primary/10"}`}>
                <Film className={`h-4 w-4 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleDateString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
