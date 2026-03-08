import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle, Film, Building2 } from "lucide-react";

export default function AdminDashboard() {
  const { organizationId, organizationName } = useAuth();
  const [stats, setStats] = useState({ pendingFiles: 0, pendingUsers: 0, totalFiles: 0, approvedFiles: 0, teamMembers: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    const fetchStats = async () => {
      const [files, users, memberSettings] = await Promise.all([
        supabase.from("files").select("status"),
        supabase.from("profiles").select("account_status").eq("organization_id", organizationId),
        supabase.from("member_settings").select("price_per_video").eq("organization_id", organizationId),
      ]);

      const approvedCount = files.data?.filter((f) => f.status === "approved").length ?? 0;
      const avgPrice = memberSettings.data?.length
        ? memberSettings.data.reduce((sum, m) => sum + Number(m.price_per_video), 0) / memberSettings.data.length
        : 0;

      setStats({
        pendingFiles: files.data?.filter((f) => f.status === "pending").length ?? 0,
        totalFiles: files.data?.length ?? 0,
        approvedFiles: approvedCount,
        pendingUsers: users.data?.filter((u) => u.account_status === "pending").length ?? 0,
        teamMembers: users.data?.filter((u) => u.account_status === "approved").length ?? 0,
        totalEarnings: approvedCount * avgPrice,
      });
      setLoading(false);
    };
    fetchStats();
  }, [organizationId]);

  const cards = [
    { label: "أعضاء الفريق", value: stats.teamMembers, icon: Users, accent: "text-primary", bg: "bg-primary/10" },
    { label: "رفع قيد المراجعة", value: stats.pendingFiles, icon: Clock, accent: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الملفات", value: stats.totalFiles, icon: Film, accent: "text-muted-foreground", bg: "bg-secondary" },
    { label: "تمت الموافقة", value: stats.approvedFiles, icon: CheckCircle, accent: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="p-6 space-y-8" dir="rtl">
      {/* Hero header - same style as SuperAdmin */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary/20 via-primary/5 to-transparent border border-primary/20 p-8">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="relative space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">لوحة تحكم الشركة</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">لوحة تحكم {organizationName}</h1>
          <p className="text-sm text-muted-foreground max-w-md">نظرة عامة على سير العمل</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="glass-panel border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{loading ? "—" : card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
