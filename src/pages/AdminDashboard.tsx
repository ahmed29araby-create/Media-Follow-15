import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Users, Clock, CheckCircle, Film, DollarSign } from "lucide-react";

export default function AdminDashboard() {
  const { organizationId, organizationName } = useAuth();
  const [stats, setStats] = useState({ pendingFiles: 0, pendingUsers: 0, totalFiles: 0, approvedFiles: 0, teamMembers: 0, totalEarnings: 0 });

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
    };
    fetchStats();
  }, [organizationId]);

  const cards = [
    { label: "رفع قيد المراجعة", value: stats.pendingFiles, icon: Clock, accent: "text-warning" },
    { label: "أعضاء الفريق", value: stats.teamMembers, icon: Users, accent: "text-primary" },
    { label: "إجمالي الملفات", value: stats.totalFiles, icon: Film, accent: "text-muted-foreground" },
    { label: "تمت الموافقة", value: stats.approvedFiles, icon: CheckCircle, accent: "text-success" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة تحكم {organizationName}</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على سير العمل</p>
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
    </div>
  );
}
