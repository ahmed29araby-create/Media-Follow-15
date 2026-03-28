import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OrganizationRequestPendingScreen from "@/components/auth/OrganizationRequestPendingScreen";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";

export default function RegisterOrganizationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    org_name: "",
    org_email: "",
    admin_password: "",
    confirm_password: "",
    referral_code: searchParams.get("ref") || "",
    whatsapp_phone: "",
  });

  const getFriendlyError = (error: any, data: any): string => {
    const msg = data?.error || error?.message || "";
    const lower = msg.toLowerCase();

     if (msg.includes("هذا البريد الإلكتروني مسجل بالفعل") || msg.includes("يوجد طلب قيد المراجعة بهذا البريد الإلكتروني بالفعل")) {
      return "هذا البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني آخر.";
    }
    if (msg.includes("البريد الإلكتروني غير صالح")) {
      return "البريد الإلكتروني غير صالح. تأكد من كتابته بشكل صحيح.";
    }
    if (msg.includes("كلمة المرور يجب أن تكون 12 حرف على الأقل")) {
      return "كلمة المرور يجب أن تكون 12 حرفًا على الأقل.";
    }

    if (lower.includes("already") || lower.includes("duplicate") || lower.includes("unique") || lower.includes("exists")) {
      return "هذا البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني آخر.";
    }
    if (lower.includes("password")) {
      return "كلمة المرور غير صالحة. يرجى التأكد منها والمحاولة مرة أخرى.";
    }
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to send")) {
      return "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.";
    }
    if (lower.includes("rate") || lower.includes("limit")) {
      return "محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.";
    }
    if (msg) {
      return msg;
    }
    return "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.admin_password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }

    if (form.admin_password !== form.confirm_password) {
      toast.error("كلمة المرور وتأكيد كلمة المرور غير متطابقتين");
      return;
    }


    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-organization-request", {
        body: {
          org_name: form.org_name.trim(),
          org_email: form.org_email.trim().toLowerCase(),
          admin_password: form.admin_password,
          referral_code: form.referral_code.trim() || undefined,
          whatsapp_phone: form.whatsapp_phone.trim() || undefined,
        },
      });

      if (error || data?.error) {
        toast.error(getFriendlyError(error, data));
      } else {
        setSuccess(true);
      }
    } catch {
      toast.error("تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <OrganizationRequestPendingScreen
        hasWhatsapp={Boolean(form.whatsapp_phone.trim())}
        onBack={() => navigate("/auth")}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative glass-panel w-full max-w-md p-8 animate-slide-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 glow-border">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Media Follow</h1>
            <p className="text-xs text-muted-foreground tracking-wider uppercase">Production Platform</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1" dir="rtl">إنشاء شركة جديدة</h2>
        <p className="text-sm text-muted-foreground mb-6" dir="rtl">أدخل بيانات الشركة لتقديم طلب الانضمام</p>

        <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="org_name">اسم الشركة</Label>
            <Input
              id="org_name"
              value={form.org_name}
              onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
              placeholder="Star Media"
              required
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org_email">البريد الإلكتروني</Label>
            <Input
              id="org_email"
              type="email"
              value={form.org_email}
              onChange={e => setForm(f => ({ ...f, org_email: e.target.value }))}
              placeholder="info@company.com"
              required
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_password">كلمة المرور (12 حرف على الأقل)</Label>
            <div className="relative">
              <Input
                id="admin_password"
                type={showPassword ? "text" : "password"}
                value={form.admin_password}
                onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
                placeholder="••••••••••••"
                required
                minLength={12}
                dir="ltr"
                className="text-left pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">تأكيد كلمة المرور</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="••••••••••••"
                required
                minLength={12}
                dir="ltr"
                className="text-left pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral_code">كود الإحالة (اختياري)</Label>
            <Input
              id="referral_code"
              value={form.referral_code}
              onChange={e => setForm(f => ({ ...f, referral_code: e.target.value }))}
              placeholder="كود الإحالة إن وُجد"
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_phone">رقم WhatsApp للتواصل (اختياري)</Label>
            <Input
              id="whatsapp_phone"
              type="tel"
              value={form.whatsapp_phone}
              onChange={e => setForm(f => ({ ...f, whatsapp_phone: e.target.value }))}
              placeholder="+20"
              dir="ltr"
              className="text-left"
            />
            <p className="text-xs text-muted-foreground">سنتواصل معك عبر هذا الرقم عند تفعيل الشركة</p>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            إرسال الطلب
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={() => navigate("/auth")}
            className="text-sm text-primary hover:underline w-full text-center"
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
