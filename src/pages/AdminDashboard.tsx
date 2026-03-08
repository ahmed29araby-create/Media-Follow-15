import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload, Users, Clock, CheckCircle, Film, DollarSign, Plus, Eye, EyeOff,
  Loader2, FolderOpen, UserPlus, BarChart3,
} from "lucide-react";

export default function AdminDashboard() {
  const { organizationId, organizationName, user } = useAuth();
  const [stats, setStats] = useState({ pendingFiles: 0, pendingUsers: 0, totalFiles: 0, approvedFiles: 0, teamMembers: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  // Add member dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    display_name: "", email: "", password: "",
    folder_name: "", price_per_video: "",
  });

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

  const handleCreateMember = async () => {
    if (form.password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }
    if (!form.display_name || !form.email) {
      toast.error("الاسم والبريد الإلكتروني مطلوبان");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-member", {
      body: {
        email: form.email,
        password: form.password,
        display_name: form.display_name,
        folder_name: form.folder_name || "uploads",
        price_per_video: parseFloat(form.price_per_video) || 0,
      },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "فشل إنشاء العميل");
    } else {
      toast.success("تم إنشاء حساب العميل بنجاح!");
      setDialogOpen(false);
      setForm({ display_name: "", email: "", password: "", folder_name: "", price_per_video: "" });
    }
    setCreating(false);
  };

  const cards = [
    { label: "أعضاء الفريق", value: stats.teamMembers, icon: Users, accent: "text-primary", bg: "bg-primary/10" },
    { label: "رفع قيد المراجعة", value: stats.pendingFiles, icon: Clock, accent: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الملفات", value: stats.totalFiles, icon: Film, accent: "text-muted-foreground", bg: "bg-secondary" },
    { label: "تمت الموافقة", value: stats.approvedFiles, icon: CheckCircle, accent: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header with quick action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة تحكم {organizationName}</h1>
          <p className="text-sm text-muted-foreground">نظرة عامة على سير العمل</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" />
              إضافة حساب عميل
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                إضافة حساب عميل جديد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم العميل</Label>
                <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="محمد أحمد" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@gmail.com" type="email" dir="ltr" className="text-left" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور (12 حرف على الأقل)</Label>
                <div className="relative">
                  <Input
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    dir="ltr" className="text-left pr-10"
                    minLength={12}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><FolderOpen className="h-3 w-3" /> اسم المجلد</Label>
                  <Input value={form.folder_name} onChange={e => setForm(f => ({ ...f, folder_name: e.target.value }))} placeholder="uploads" dir="ltr" className="text-left" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> سعر الفيديو</Label>
                  <Input value={form.price_per_video} onChange={e => setForm(f => ({ ...f, price_per_video: e.target.value }))} placeholder="250" type="number" dir="ltr" className="text-left" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                بعد الإنشاء، أعطِ العميل البريد الإلكتروني وكلمة المرور لتسجيل الدخول. يمكنه تغيير كلمة المرور لاحقاً من صفحة الخصوصية.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreateMember} disabled={creating}>
                {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إنشاء الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
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
