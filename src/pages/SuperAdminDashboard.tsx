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
import { Building2, Plus, Users, Activity, Loader2, Eye, EyeOff, CheckCircle, XCircle, Shield, Globe, Zap } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    org_name: "", org_email: "",
    admin_email: "", admin_password: "", admin_display_name: "",
  });

  const fetchOrgs = async () => {
    const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
    setOrgs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleCreate = async () => {
    if (form.admin_password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-organization", { body: form });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "فشل إنشاء الشركة");
    } else {
      toast.success("تم إنشاء الشركة بنجاح!");
      setDialogOpen(false);
      setForm({ org_name: "", org_email: "", admin_email: "", admin_password: "", admin_display_name: "" });
      fetchOrgs();
    }
    setCreating(false);
  };

  const stats = [
    { label: "إجمالي الشركات", value: orgs.length, icon: Building2, accent: "text-primary", bg: "bg-primary/10" },
    { label: "شركات نشطة", value: orgs.filter(o => o.is_active).length, icon: Activity, accent: "text-success", bg: "bg-success/10" },
    { label: "شركات معطلة", value: orgs.filter(o => !o.is_active).length, icon: XCircle, accent: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="p-6 space-y-8" dir="rtl">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary/20 via-primary/5 to-transparent border border-primary/20 p-8">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">مالك المنصة</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              مرحباً، {user?.user_metadata?.display_name || "مدير المنصة"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              لوحة التحكم الرئيسية للمنصة — إدارة الشركات والمسؤولين وجميع العمليات
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-5 w-5" />
                إنشاء شركة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-foreground">إنشاء شركة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="glass-panel p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> بيانات الشركة
                  </h3>
                  <div className="space-y-2">
                    <Label>اسم الشركة</Label>
                    <Input value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} placeholder="Star Media" dir="ltr" className="text-left" />
                  </div>
                  <div className="space-y-2">
                    <Label>بريد الشركة</Label>
                    <Input value={form.org_email} onChange={e => setForm(f => ({ ...f, org_email: e.target.value }))} placeholder="info@company.com" dir="ltr" className="text-left" type="email" />
                  </div>
                </div>
                <div className="glass-panel p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> بيانات المسؤول
                  </h3>
                  <div className="space-y-2">
                    <Label>اسم المسؤول</Label>
                    <Input value={form.admin_display_name} onChange={e => setForm(f => ({ ...f, admin_display_name: e.target.value }))} placeholder="أحمد محمد" />
                  </div>
                  <div className="space-y-2">
                    <Label>بريد المسؤول</Label>
                    <Input value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@company.com" dir="ltr" className="text-left" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور (12 حرف على الأقل)</Label>
                    <div className="relative">
                      <Input
                        value={form.admin_password}
                        onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  إنشاء الشركة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="glass-panel border-border/50 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.accent}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Organizations list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            الشركات المسجلة
          </h2>
          <span className="text-xs text-muted-foreground">{orgs.length} شركة</span>
        </div>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : orgs.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">لا توجد شركات بعد — ابدأ بإنشاء أول شركة</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline">
              <Plus className="ml-2 h-4 w-4" />
              إنشاء شركة
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {orgs.map((org, i) => (
              <div key={org.id} className="glass-panel p-5 flex items-center justify-between hover:border-primary/20 transition-all group" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{org.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {org.is_active ? (
                    <span className="status-approved"><CheckCircle className="h-3 w-3" /> نشط</span>
                  ) : (
                    <span className="status-rejected"><XCircle className="h-3 w-3" /> معطل</span>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString("ar")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
