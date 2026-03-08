import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard, CalendarDays, Loader2, CheckCircle, XCircle, Clock,
  Gift, Image as ImageIcon, Phone, ExternalLink,
} from "lucide-react";

const PLAN_PRICE = 400;

interface SubscriptionInfo {
  id: string;
  starts_at: string;
  ends_at: string;
  months: number;
  amount: number;
  payment_method: string;
  notes: string | null;
}

interface PaymentRequest {
  id: string;
  organization_id: string;
  months: number;
  amount: number;
  sender_phone: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
}

interface SubscriptionManagerProps {
  organizationId: string;
  organizationName: string;
}

export default function SubscriptionManager({ organizationId, organizationName }: SubscriptionManagerProps) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Grant free subscription dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantMonths, setGrantMonths] = useState("1");
  const [granting, setGranting] = useState(false);
  const [grantPassword, setGrantPassword] = useState("");

  // Cancel confirmation
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Screenshot viewer
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const fetchData = async () => {
    const [subRes, payRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("subscription_payments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setSubscription(subRes.data?.[0] ?? null);
    setPendingPayments((payRes.data as PaymentRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const isActive = subscription && new Date(subscription.ends_at) > new Date();
  const daysLeft = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  const verifyPassword = async (password: string): Promise<boolean> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser?.email) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    });
    return !error;
  };

  const handleGrantFree = async () => {
    if (!user) return;
    if (!grantPassword) { toast.error("يرجى إدخال كلمة المرور"); return; }
    setGranting(true);

    const valid = await verifyPassword(grantPassword);
    if (!valid) { toast.error("كلمة المرور غير صحيحة"); setGranting(false); return; }

    const months = parseInt(grantMonths);

    let error: any = null;

    const startsAt = new Date();
    const startsAtIso = startsAt.toISOString();
    const endsAt = new Date(startsAt.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    // Always replace current subscription duration (never add to old duration)
    const { error: closeActiveErr } = await supabase
      .from("subscriptions")
      .update({ ends_at: startsAtIso })
      .eq("organization_id", organizationId)
      .gte("ends_at", startsAtIso);

    if (closeActiveErr) {
      error = closeActiveErr;
    } else {
      const { error: insertErr } = await supabase.from("subscriptions").insert({
        organization_id: organizationId,
        starts_at: startsAtIso,
        ends_at: endsAt.toISOString(),
        months,
        amount: 0,
        granted_by: user.id,
        payment_method: "free_grant",
        notes: `تم دفع الاشتراك من صاحب الموقع لمدة ${months} شهر`,
      });
      error = insertErr;
    }

    // Re-activate org
    await supabase.from("organizations").update({ is_active: true }).eq("id", organizationId);

    if (error) {
      toast.error(error.message);
    } else {
      // Send notification to org members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", organizationId);
      if (profiles) {
        for (const p of profiles) {
          await supabase.from("notifications").insert({
            user_id: p.user_id,
            organization_id: organizationId,
            title: "🎁 تم تجديد الاشتراك مجاناً",
            message: `تم تجديد اشتراك ${organizationName} مجاناً من صاحب الموقع لمدة ${months} شهر.`,
            type: "sub_free_grant",
          });
        }
      }
      toast.success(`تم تحديث الاشتراك المجاني لمدة ${months} شهر`);
      setGrantOpen(false);
      setGrantPassword("");
      fetchData();
    }
    setGranting(false);
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    if (!cancelPassword) { toast.error("يرجى إدخال كلمة المرور"); return; }
    setCancelling(true);

    const valid = await verifyPassword(cancelPassword);
    if (!valid) { toast.error("كلمة المرور غير صحيحة"); setCancelling(false); return; }

      const { error } = await supabase
        .from("subscriptions")
        .update({ ends_at: new Date().toISOString(), notes: `⛔ تم إلغاء الاشتراك يدوياً` })
        .eq("id", subscription.id);

    await supabase.from("organizations").update({ is_active: false }).eq("id", organizationId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إلغاء الاشتراك بنجاح");
      setCancelOpen(false);
      setCancelPassword("");
      fetchData();
    }
    setCancelling(false);
  };

  const handleApprovePayment = async (payment: PaymentRequest) => {
    let subError: any = null;
    const note = `تم الدفع عبر فودافون كاش — رقم المرسل: ${payment.sender_phone || "غير محدد"}`;

    if (subscription && new Date(subscription.ends_at) > new Date()) {
      // Extend existing active subscription
      const newEnd = new Date(subscription.ends_at);
      newEnd.setMonth(newEnd.getMonth() + payment.months);
      const totalMonths = subscription.months + payment.months;
      const { error } = await supabase
        .from("subscriptions")
        .update({
          ends_at: newEnd.toISOString(),
          months: totalMonths,
          amount: Number(subscription.amount) + payment.amount,
          notes: `تم دفع الاشتراك عبر فودافون كاش لمدة ${totalMonths} شهر — رقم المرسل: ${payment.sender_phone || "غير محدد"}`,
        })
        .eq("id", subscription.id);
      subError = error;
    } else {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + payment.months);
      const { error } = await supabase.from("subscriptions").insert({
        organization_id: payment.organization_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        months: payment.months,
        amount: payment.amount,
        granted_by: user?.id,
        payment_method: "vodafone_cash",
        notes: note,
      });
      subError = error;
    }

    await supabase
      .from("subscription_payments")
      .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", payment.id);

    // Re-activate org
    await supabase.from("organizations").update({ is_active: true }).eq("id", payment.organization_id);

    if (subError) {
      toast.error("حدث خطأ أثناء الموافقة");
    } else {
      // Send notification to org members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", payment.organization_id);
      if (profiles) {
        for (const p of profiles) {
          await supabase.from("notifications").insert({
            user_id: p.user_id,
            organization_id: payment.organization_id,
            title: "✅ تم تجديد الاشتراك",
            message: `تم الموافقة على طلب الاشتراك وتفعيل الحساب لمدة ${payment.months} شهر.`,
            type: "sub_approved",
          });
        }
      }
      toast.success("تم تفعيل الاشتراك بنجاح");
      fetchData();
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    const { error } = await supabase
      .from("subscription_payments")
      .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) {
      toast.error("حدث خطأ");
    } else {
      toast.success("تم رفض طلب الدفع");
      fetchData();
    }
  };

  const viewScreenshot = async (path: string) => {
    setViewingScreenshot(path);
    const { data } = await supabase.storage.from("payment_screenshots").createSignedUrl(path, 300);
    setScreenshotUrl(data?.signedUrl ?? null);
  };

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Current subscription */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">حالة الاشتراك</span>
          {isActive ? (
            <Badge className="bg-success/15 text-success border-success/30">نشط</Badge>
          ) : (
            <Badge className="bg-destructive/15 text-destructive border-destructive/30">غير نشط</Badge>
          )}
        </div>
        {subscription && isActive && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">من</span>
              <span className="font-medium text-foreground">{formatDate(subscription.starts_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">إلى</span>
              <span className="font-medium text-foreground">{formatDate(subscription.ends_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">المتبقي</span>
              <span className="font-bold text-primary">{daysLeft} يوم</span>
            </div>
            {subscription.notes && (
              <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-md">{subscription.notes}</p>
            )}
          </>
        )}
      </div>

      {/* Pending payments */}
      {pendingPayments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            طلبات دفع في الانتظار
          </h3>
          {pendingPayments.map((p) => (
            <div key={p.id} className="glass-panel p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.months} شهر — {p.amount} جنيه</span>
                <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
              </div>
              {p.sender_phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{p.sender_phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {p.screenshot_path && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => viewScreenshot(p.screenshot_path!)}>
                    <ImageIcon className="h-3.5 w-3.5" />
                    عرض الإيصال
                  </Button>
                )}
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleApprovePayment(p)}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  موافقة
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={() => handleRejectPayment(p.id)}>
                  <XCircle className="h-3.5 w-3.5" />
                  رفض
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full gap-2" onClick={() => setGrantOpen(true)}>
          <Gift className="h-4 w-4" />
          {isActive ? "تجديد الاشتراك (مجاني)" : "دفع اشتراك الشركة (مجاني)"}
        </Button>
        {isActive && (
          <Button variant="destructive" className="w-full gap-2" onClick={() => setCancelOpen(true)}>
            <XCircle className="h-4 w-4" />
            إلغاء الاشتراك
          </Button>
        )}
      </div>

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground">دفع اشتراك مجاني</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم تفعيل اشتراك <strong className="text-foreground">{organizationName}</strong> مجاناً من صاحب الموقع.
            </p>
            <div className="space-y-2">
              <Label>عدد الأشهر</Label>
              <Select value={grantMonths} onValueChange={setGrantMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? "شهر" : m <= 10 ? "أشهر" : "شهر"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور (تأكيد)</Label>
              <Input type="password" value={grantPassword} onChange={(e) => setGrantPassword(e.target.value)} placeholder="أدخل كلمة مرور حسابك" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGrantOpen(false); setGrantPassword(""); }}>إلغاء</Button>
            <Button onClick={handleGrantFree} disabled={granting || !grantPassword}>
              {granting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تفعيل الاشتراك
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelOpen} onOpenChange={(open) => { if (!open) { setCancelOpen(false); setCancelPassword(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground">تأكيد إلغاء الاشتراك</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم إلغاء اشتراك <strong className="text-foreground">{organizationName}</strong> وإيقاف الحساب. أدخل كلمة المرور للتأكيد.
            </p>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={cancelPassword} onChange={(e) => setCancelPassword(e.target.value)} placeholder="أدخل كلمة مرور حسابك" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelPassword(""); }}>إلغاء</Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelling || !cancelPassword}>
              {cancelling && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot viewer */}
      <Dialog open={!!viewingScreenshot} onOpenChange={(open) => { if (!open) { setViewingScreenshot(null); setScreenshotUrl(null); } }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">إيصال التحويل</DialogTitle>
          </DialogHeader>
          {screenshotUrl ? (
            <img src={screenshotUrl} alt="إيصال التحويل" className="w-full rounded-lg" />
          ) : (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
