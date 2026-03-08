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
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Users, Activity, Loader2, Eye, EyeOff, CheckCircle, XCircle, Shield, Globe, Zap, Info, Trash2, CalendarDays, Ban, Power, CreditCard } from "lucide-react";
import SubscriptionManager from "@/components/SubscriptionManager";
import { Badge } from "@/components/ui/badge";

interface Organization {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const { user, displayName, organizationName } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "disabled">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Details dialog
  const [detailsOrg, setDetailsOrg] = useState<Organization | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Fetch member count when details org changes
  useEffect(() => {
    if (!detailsOrg) { setMemberCount(null); return; }
    (async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", detailsOrg.id);
      setMemberCount(count ?? 0);
    })();
  }, [detailsOrg]);

  // Delete confirmation
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Toggle (disable/enable) confirmation
  const [toggleOrg, setToggleOrg] = useState<Organization | null>(null);
  const [togglePassword, setTogglePassword] = useState("");
  const [toggleReason, setToggleReason] = useState("");
  const [toggling, setToggling] = useState(false);
  const [showTogglePassword, setShowTogglePassword] = useState(false);

  const [form, setForm] = useState({
    org_name: "", org_email: "", admin_password: "",
  });

  const fetchOrgs = async () => {
    const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: true });
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
      setForm({ org_name: "", org_email: "", admin_password: "" });
      fetchOrgs();
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteOrg || !deletePassword) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-organization", {
      body: { organization_id: deleteOrg.id, password: deletePassword },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "فشل حذف الشركة");
    } else {
      toast.success("تم حذف الشركة بنجاح");
      setDeleteOrg(null);
      setDetailsOrg(null);
      setDeletePassword("");
      fetchOrgs();
    }
    setDeleting(false);
  };

  const handleToggle = async () => {
    if (!toggleOrg || !togglePassword) return;
    if (toggleOrg.is_active && !toggleReason.trim()) {
      toast.error("يرجى كتابة سبب التعطيل");
      return;
    }
    setToggling(true);
    const newStatus = !toggleOrg.is_active;
    const { data, error } = await supabase.functions.invoke("toggle-organization", {
      body: { organization_id: toggleOrg.id, password: togglePassword, is_active: newStatus, disable_reason: toggleReason.trim() || null },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "فشلت العملية");
    } else {
      toast.success(newStatus ? "تم تفعيل الشركة بنجاح" : "تم تعطيل الشركة بنجاح");
      setToggleOrg(null);
      setDetailsOrg(null);
      setTogglePassword("");
      setToggleReason("");
      fetchOrgs();
    }
    setToggling(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  };

  const stats = [
    { label: "إجمالي الشركات", value: orgs.length, icon: Building2, accent: "text-primary", bg: "bg-primary/10", filterKey: "all" as const },
    { label: "شركات نشطة", value: orgs.filter(o => o.is_active).length, icon: Activity, accent: "text-success", bg: "bg-success/10", filterKey: "active" as const },
    { label: "شركات معطلة", value: orgs.filter(o => !o.is_active).length, icon: XCircle, accent: "text-destructive", bg: "bg-destructive/10", filterKey: "disabled" as const },
  ];

  const filteredOrgs = filter === "all" ? orgs : filter === "active" ? orgs.filter(o => o.is_active) : orgs.filter(o => !o.is_active);
  const filterTitle = filter === "all" ? "الشركات المسجلة" : filter === "active" ? "الشركات النشطة" : "الشركات المعطلة";

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
              مرحباً، {displayName || organizationName || "مدير المنصة"}
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
                <div className="space-y-2">
                  <Label>اسم الشركة</Label>
                  <Input value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} placeholder="Star Media" dir="ltr" className="text-left" />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input value={form.org_email} onChange={e => setForm(f => ({ ...f, org_email: e.target.value }))} placeholder="info@company.com" dir="ltr" className="text-left" type="email" />
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
                <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                  بعد الإنشاء، أرسل البريد الإلكتروني وكلمة المرور لمسؤول الشركة لتسجيل الدخول.
                </p>
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
          <Card
            key={s.label}
            className={`glass-panel border-border/50 hover:border-primary/30 transition-colors cursor-pointer ${filter === s.filterKey ? "ring-2 ring-primary border-primary/40" : ""}`}
            onClick={() => setFilter(s.filterKey)}
          >
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
            {filterTitle}
          </h2>
          <span className="text-xs text-muted-foreground">{filteredOrgs.length} شركة</span>
        </div>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredOrgs.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {filter === "all" ? "لا توجد شركات بعد — ابدأ بإنشاء أول شركة" : filter === "active" ? "لا توجد شركات نشطة" : "لا توجد شركات معطلة"}
            </p>
            {filter === "all" && (
              <Button onClick={() => setDialogOpen(true)} variant="outline">
                <Plus className="ml-2 h-4 w-4" />
                إنشاء شركة
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredOrgs.map((org, i) => (
              <div key={org.id} className="glass-panel p-5 flex items-center justify-between hover:border-primary/20 transition-all group" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{org.name}</p>
                      {org.is_active ? (
                        <Badge className="bg-success/15 text-success border-success/30 text-[10px] px-1.5 py-0">نشطة</Badge>
                      ) : (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">معطلة</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground" dir="ltr">{org.email}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setDetailsOrg(org)}>
                  <Info className="h-4 w-4" />
                  تفاصيل الشركة
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!detailsOrg} onOpenChange={(open) => { if (!open) setDetailsOrg(null); }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              تفاصيل الشركة
            </DialogTitle>
          </DialogHeader>
          {detailsOrg && (
            <div className="space-y-5">
              <div className="glass-panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">اسم الشركة</span>
                  <span className="text-sm font-bold text-foreground">{detailsOrg.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">البريد الإلكتروني</span>
                  <span className="text-sm text-foreground" dir="ltr">{detailsOrg.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">تاريخ الانضمام</span>
                  <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(detailsOrg.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">عدد أعضاء الفريق</span>
                  <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {memberCount !== null ? memberCount : "..."}
                  </span>
                </div>
              </div>

              {/* Subscription management */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  إدارة الاشتراك
                </h3>
                <SubscriptionManager organizationId={detailsOrg.id} organizationName={detailsOrg.name} />
              </div>

              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setDeleteOrg(detailsOrg)}
              >
                <Trash2 className="h-4 w-4" />
                حذف الشركة نهائياً
              </Button>

              <Button
                variant="outline"
                className={`w-full gap-2 ${detailsOrg.is_active ? "border-destructive/50 text-destructive hover:bg-destructive/10" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                onClick={() => setToggleOrg(detailsOrg)}
              >
                {detailsOrg.is_active ? (
                  <><Ban className="h-4 w-4" /> تعطيل الشركة</>
                ) : (
                  <><Power className="h-4 w-4" /> تفعيل الشركة</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOrg} onOpenChange={(open) => { if (!open) { setDeleteOrg(null); setDeletePassword(""); } }}>
        <AlertDialogContent className="bg-card border-border" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الشركة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف شركة <strong className="text-foreground">{deleteOrg?.name}</strong> وجميع بياناتها وحسابات المستخدمين المرتبطة بها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>أدخل كلمة المرور الخاصة بك للتأكيد</Label>
            <div className="relative">
              <Input
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                type={showDeletePassword ? "text" : "password"}
                placeholder="••••••••••••"
                dir="ltr"
                className="text-left pr-10"
              />
              <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !deletePassword}>
              {deleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حذف نهائي
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle (Disable/Enable) Confirmation */}
      <AlertDialog open={!!toggleOrg} onOpenChange={(open) => { if (!open) { setToggleOrg(null); setTogglePassword(""); setToggleReason(""); } }}>
        <AlertDialogContent className="bg-card border-border" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${toggleOrg?.is_active ? "text-destructive" : "text-primary"}`}>
              {toggleOrg?.is_active ? <Ban className="h-5 w-5" /> : <Power className="h-5 w-5" />}
              {toggleOrg?.is_active ? "تأكيد تعطيل الشركة" : "تأكيد تفعيل الشركة"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {toggleOrg?.is_active
                ? <>سيتم تعطيل شركة <strong className="text-foreground">{toggleOrg?.name}</strong> ولن يتمكن أي مستخدم من تسجيل الدخول حتى يتم تفعيلها مرة أخرى.</>
                : <>سيتم إعادة تفعيل شركة <strong className="text-foreground">{toggleOrg?.name}</strong> وسيتمكن المستخدمون من تسجيل الدخول مجدداً.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {toggleOrg?.is_active && (
              <div className="space-y-2">
                <Label>سبب التعطيل <span className="text-destructive">*</span></Label>
                <textarea
                  value={toggleReason}
                  onChange={e => setToggleReason(e.target.value)}
                  placeholder="اكتب سبب تعطيل الشركة... (سيظهر هذا النص لمسؤول الشركة)"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  dir="rtl"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>أدخل كلمة المرور الخاصة بك للتأكيد</Label>
              <div className="relative">
                <Input
                  value={togglePassword}
                  onChange={e => setTogglePassword(e.target.value)}
                  type={showTogglePassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  dir="ltr"
                  className="text-left pr-10"
                />
                <button type="button" onClick={() => setShowTogglePassword(!showTogglePassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showTogglePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <Button
              variant={toggleOrg?.is_active ? "destructive" : "default"}
              onClick={handleToggle}
              disabled={toggling || !togglePassword || (toggleOrg?.is_active && !toggleReason.trim())}
            >
              {toggling && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {toggleOrg?.is_active ? "تعطيل" : "تفعيل"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
