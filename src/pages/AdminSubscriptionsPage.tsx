import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard, Loader2, CheckCircle, XCircle, Clock,
  Phone, Image as ImageIcon, Building2,
} from "lucide-react";

interface PaymentRequest {
  id: string;
  organization_id: string;
  user_id: string;
  months: number;
  amount: number;
  sender_phone: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
}

interface OrgInfo {
  id: string;
  name: string;
}

export default function AdminSubscriptionsPage() {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [orgs, setOrgs] = useState<Record<string, OrgInfo>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  // Screenshot viewer
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(false);

  const fetchData = async () => {
    const [payRes, orgRes] = await Promise.all([
      supabase
        .from("subscription_payments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name"),
    ]);

    setPayments((payRes.data ?? []) as PaymentRequest[]);
    const orgMap: Record<string, OrgInfo> = {};
    (orgRes.data ?? []).forEach((o: any) => { orgMap[o.id] = o; });
    setOrgs(orgMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (payment: PaymentRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + payment.months);

    const [subRes, payRes] = await Promise.all([
      supabase.from("subscriptions").insert({
        organization_id: payment.organization_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        months: payment.months,
        amount: payment.amount,
        granted_by: user?.id,
        payment_method: "vodafone_cash",
        notes: `تم الدفع عبر فودافون كاش — رقم المرسل: ${payment.sender_phone || "غير محدد"}`,
      }),
      supabase
        .from("subscription_payments")
        .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", payment.id),
    ]);

    // Re-activate org
    await supabase.from("organizations").update({ is_active: true }).eq("id", payment.organization_id);

    // Send notification to org admin
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

    if (subRes.error || payRes.error) {
      toast.error("حدث خطأ أثناء الموافقة");
    } else {
      toast.success("تم تفعيل الاشتراك بنجاح");
      fetchData();
    }
  };

  const handleReject = async (payment: PaymentRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("subscription_payments")
      .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", payment.id);

    // Send rejection notification
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("organization_id", payment.organization_id);

    if (profiles) {
      for (const p of profiles) {
        await supabase.from("notifications").insert({
          user_id: p.user_id,
          organization_id: payment.organization_id,
          title: "❌ تم رفض طلب الاشتراك",
          message: "تم رفض طلب الاشتراك. يرجى التأكد من التحويل وإعادة المحاولة.",
          type: "sub_rejected",
        });
      }
    }

    toast.success("تم رفض طلب الدفع");
    fetchData();
  };

  const viewScreenshot = async (path: string) => {
    setViewingScreenshot(true);
    const { data } = await supabase.storage.from("payment_screenshots").createSignedUrl(path, 300);
    setScreenshotUrl(data?.signedUrl ?? null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto" dir="rtl">
      <div className="text-center space-y-1 pb-4 border-b border-border">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
          اشتراكات الشركات
        </h1>
        <p className="text-sm text-muted-foreground">مراجعة وإدارة طلبات الاشتراك</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "pending", label: "في الانتظار", count: pendingCount },
          { key: "approved", label: "مقبولة", count: payments.filter(p => p.status === "approved").length },
          { key: "rejected", label: "مرفوضة", count: payments.filter(p => p.status === "rejected").length },
          { key: "all", label: "الكل", count: payments.length },
        ] as const).map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className="gap-1.5"
          >
            {f.label}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mr-1">{f.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Payments list */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات اشتراك</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="glass-panel p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{orgs[p.organization_id]?.name || "شركة"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                  </div>
                </div>
                {p.status === "pending" ? (
                  <Badge className="bg-warning/15 text-warning border-warning/30">في الانتظار</Badge>
                ) : p.status === "approved" ? (
                  <Badge className="bg-success/15 text-success border-success/30">تمت الموافقة</Badge>
                ) : (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30">مرفوض</Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{p.months} شهر — <strong className="text-foreground">{p.amount} جنيه</strong></span>
                {p.sender_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span dir="ltr">{p.sender_phone}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {p.screenshot_path && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => viewScreenshot(p.screenshot_path!)}>
                    <ImageIcon className="h-3.5 w-3.5" />
                    عرض الإيصال
                  </Button>
                )}
                {p.status === "pending" && (
                  <>
                    <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleApprove(p)}>
                      <CheckCircle className="h-3.5 w-3.5" />
                      موافقة وتفعيل
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={() => handleReject(p)}>
                      <XCircle className="h-3.5 w-3.5" />
                      رفض
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot viewer */}
      <Dialog open={viewingScreenshot} onOpenChange={(open) => { if (!open) { setViewingScreenshot(false); setScreenshotUrl(null); } }}>
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
