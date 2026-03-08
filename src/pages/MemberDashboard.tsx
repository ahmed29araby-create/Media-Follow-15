import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Clock, CheckCircle, XCircle, DollarSign, Film, FolderOpen } from "lucide-react";

export default function MemberDashboard() {
  const { user, organizationName } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0, earnings: 0, pricePerVideo: 0 });
  const [folderName, setFolderName] = useState("uploads");

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [filesRes, settingsRes] = await Promise.all([
        supabase.from("files").select("status").eq("user_id", user.id),
        supabase.from("member_settings").select("price_per_video, folder_name").eq("user_id", user.id).single(),
      ]);

      const files = filesRes.data ?? [];
      const price = Number(settingsRes.data?.price_per_video ?? 0);
      const approved = files.filter(f => f.status === "approved").length;

      setFolderName(settingsRes.data?.folder_name ?? "uploads");
      setStats({
        pending: files.filter(f => f.status === "pending").length,
        approved,
        rejected: files.filter(f => f.status === "rejected").length,
        total: files.length,
        earnings: approved * price,
        pricePerVideo: price,
      });
    };
    fetchStats();
  }, [user]);

  const cards = [
    { label: "إجمالي الرفع", value: stats.total, icon: Upload, accent: "text-primary" },
    { label: "قيد المراجعة", value: stats.pending, icon: Clock, accent: "text-warning" },
    { label: "تمت الموافقة", value: stats.approved, icon: CheckCircle, accent: "text-success" },
    { label: "مرفوض", value: stats.rejected, icon: XCircle, accent: "text-destructive" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">{organizationName && `${organizationName} • `}نظرة عامة على نشاطك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="glass-panel border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 ${card.accent}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Earnings & Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">إجمالي الأرباح</p>
              <p className="text-2xl font-bold text-primary">{stats.earnings.toLocaleString()} جنيه</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>سعر الفيديو</span>
              <span className="text-foreground font-medium">{stats.pricePerVideo} جنيه</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>فيديوهات معتمدة</span>
              <span className="text-foreground font-medium">{stats.approved}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold text-foreground">
              <span>الإجمالي</span>
              <span className="text-primary">{stats.earnings.toLocaleString()} جنيه</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <FolderOpen className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">مجلد العمل</p>
              <p className="text-lg font-bold text-foreground" dir="ltr">{folderName}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            جميع الملفات التي ترفعها ستظهر في هذا المجلد
          </p>
        </div>
      </div>
    </div>
  );
}
