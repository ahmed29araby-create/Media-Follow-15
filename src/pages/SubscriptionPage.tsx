import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Clock, CheckCircle, XCircle, Upload, Loader2, CalendarDays, Phone, AlertCircle,
} from "lucide-react";
import PlanCards, { PLANS, type Plan } from "@/components/subscription/PlanCards";
import UseCreditsSection from "@/components/referral/UseCreditsSection";
import DiscountCodeInput from "@/components/referral/DiscountCodeInput";

interface Subscription {
  id: string;
  starts_at: string;
  ends_at: string;
  months: number;
  amount: number;
  payment_method: string;
  notes: string | null;
}

interface Payment {
  id: string;
  months: number;
  amount: number;
  sender_phone: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
}

export default function SubscriptionPage() {
  const { user, organizationId, organizationName, isAdmin } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [senderPhone, setSenderPhone] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [vodafoneNumber, setVodafoneNumber] = useState("01012345678");

  // Credit usage state
  const [creditApplied, setCreditApplied] = useState(false);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditIds, setCreditIds] = useState<string[]>([]);

  // Discount code state
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountCodeOrgId, setDiscountCodeOrgId] = useState("");

  const fetchData = async () => {
    if (!organizationId) return;
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
        .order("created_at", { ascending: false }),
    ]);
    setSubscription(subRes.data?.[0] ?? null);
    setPayments((payRes.data as Payment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.from("admin_settings").select("setting_value").eq("setting_key", "vodafone_cash_number").maybeSingle().then(({ data }) => {
      if (data) setVodafoneNumber(data.setting_value);
    });
  }, [organizationId]);

  const isActive = subscription && new Date(subscription.ends_at) > new Date();
  const daysLeft = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const hasPendingPayment = payments.some((p) => p.status === "pending");

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowPaymentForm(true);
    setTimeout(() => document.getElementById("payment-form")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const totalDiscount = (discountApplied ? discountAmount : 0) + (creditApplied ? creditAmount : 0);
  const finalPrice = selectedPlan ? Math.max(0, selectedPlan.price - totalDiscount) : 0;
  const isFullyCoveredByCredit = finalPrice === 0 && (creditApplied || discountApplied);

  const resetForm = () => {
    setSenderPhone("");
    setScreenshotFile(null);
    setShowPaymentForm(false);
    setSelectedPlan(null);
    setCreditApplied(false);
    setCreditAmount(0);
    setCreditIds([]);
    setDiscountApplied(false);
    setDiscountAmount(0);
    setDiscountCode("");
    setDiscountCodeOrgId("");
  };

  const handleSubmitPayment = async () => {
    if (!user || !organizationId || !selectedPlan) return;

    if (!isFullyCoveredByCredit) {
      if (!senderPhone.trim()) {
        toast.error("أدخل رقم الهاتف المُحوَّل منه");
        return;
      }
      if (!screenshotFile) {
        toast.error("ارفع صورة إيصال التحويل");
        return;
      }
    }

    setSubmitting(true);
    try {
      let screenshotPath: string | null = null;

      if (!isFullyCoveredByCredit && screenshotFile) {
        const ext = screenshotFile.name.split(".").pop();
        const path = `${organizationId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment_screenshots")
          .upload(path, screenshotFile);
        if (uploadErr) throw uploadErr;
        screenshotPath = path;
      }

      // Deduct referral credits if applied
      if (creditApplied && creditAmount > 0) {
        let remainingToDeduct = creditAmount;
        const { data: creditsData } = await supabase
          .from("referral_credits")
          .select("id, remaining")
          .eq("organization_id", organizationId)
          .gt("remaining", 0)
          .order("expires_at", { ascending: true });

        for (const c of (creditsData ?? [])) {
          if (remainingToDeduct <= 0) break;
          const deductFromThis = Math.min(Number(c.remaining), remainingToDeduct);
          await supabase
            .from("referral_credits")
            .update({ remaining: Number(c.remaining) - deductFromThis })
            .eq("id", c.id);
          remainingToDeduct -= deductFromThis;
        }
      }

      if (isFullyCoveredByCredit) {
        const startsAt = new Date();
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);
        await supabase.from("subscriptions").insert({
          organization_id: organizationId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          months: 1,
          amount: 0,
          payment_method: "referral_credit",
          notes: `تم الدفع بالكامل من الخصم/الرصيد — باقة ${selectedPlan.name} (${selectedPlan.price} جنيه)`,
        });
        await supabase.from("organizations").update({ is_active: true }).eq("id", organizationId);

        // If discount code was used, create referral and grant credit to code owner
        if (discountApplied && discountCode) {
          await grantCodeOwnerCredit(selectedPlan.price);
        }

        toast.success("تم تفعيل الاشتراك!");
      } else {
        const { error: insertErr } = await supabase.from("subscription_payments").insert({
          organization_id: organizationId,
          user_id: user.id,
          months: 1,
          amount: finalPrice,
          sender_phone: senderPhone.trim() || null,
          screenshot_path: screenshotPath,
          status: "pending",
          referral_code_used: discountApplied ? discountCode : null,
        });
        if (insertErr) throw insertErr;
        toast.success("تم إرسال طلب الاشتراك بنجاح! في انتظار الموافقة.");
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الإرسال");
    }
    setSubmitting(false);
  };

  const grantCodeOwnerCredit = async (originalPrice: number) => {
    try {
      // Get referral percentage for code owner
      const { data: pctSetting } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "referral_percentage")
        .is("organization_id", null)
        .maybeSingle();
      const percentage = Number(pctSetting?.setting_value ?? 50);

      const { data: expSetting } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "credit_expiry_months")
        .is("organization_id", null)
        .maybeSingle();
      const expiryMonths = Number(expSetting?.setting_value ?? 6);

      const codeOwnerOrgId = discountCodeOrgId;
      if (!codeOwnerOrgId) return;

      // Create referral record
      const { data: referral } = await supabase.from("referrals").insert({
        referrer_org_id: codeOwnerOrgId,
        referred_org_id: organizationId!,
      }).select("id").single();

      const creditAmt = Math.round(originalPrice * percentage / 100);
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + expiryMonths);

      await supabase.from("referral_credits").insert({
        organization_id: codeOwnerOrgId,
        amount: creditAmt,
        remaining: creditAmt,
        referral_id: referral?.id || null,
        source_description: `استخدام كود الخصم — اشتراك ${originalPrice} جنيه`,
        expires_at: expiresAt.toISOString(),
      });
    } catch (e) {
      console.error("Error granting code owner credit:", e);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          الاشتراك
        </h1>
        <p className="text-sm text-muted-foreground">
          إدارة اشتراك {organizationName || "الشركة"}
        </p>
      </div>

      {/* Current subscription status */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            حالة الاشتراك
            {isActive ? (
              <Badge className="bg-success/15 text-success border-success/30">نشط</Badge>
            ) : (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">غير نشط</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription && isActive ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">بداية الاشتراك</span>
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {formatDate(subscription.starts_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">نهاية الاشتراك</span>
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-destructive" />
                  {formatDate(subscription.ends_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المتبقي</span>
                <span className="font-bold text-primary">{daysLeft} يوم</span>
              </div>
              {subscription.notes && (
                <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-md mt-2">
                  {subscription.notes}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا يوجد اشتراك نشط حالياً</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending payment notice */}
      {hasPendingPayment && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm">
          <Clock className="h-5 w-5 text-warning shrink-0" />
          <span className="text-foreground">طلب اشتراك قيد المراجعة — في انتظار موافقة مالك المنصة</span>
        </div>
      )}

      {/* Plan cards */}
      <PlanCards
        selectedPlanId={selectedPlan?.id ?? null}
        onSelectPlan={handleSelectPlan}
        hasPendingPayment={hasPendingPayment}
        isAdmin={isAdmin ?? false}
      />

      {/* Payment form */}
      {showPaymentForm && selectedPlan && (
        <Card className="border-border/50" id="payment-form">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{isFullyCoveredByCredit ? "الدفع بالخصم/الرصيد" : "الدفع عبر فودافون كاش"}</span>
              <div className="flex items-center gap-2">
                {(discountApplied || creditApplied) && (
                  <Badge className="bg-success/15 text-success border-success/30 text-xs">
                    خصم {totalDiscount.toLocaleString()} ج
                  </Badge>
                )}
                <Badge variant="outline" className="text-primary border-primary/30">
                  {selectedPlan.name} — {totalDiscount > 0 ? `${finalPrice.toLocaleString()} جنيه` : `${selectedPlan.price.toLocaleString()} جنيه`}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Discount Code Input */}
            <DiscountCodeInput
              planPrice={selectedPlan.price}
              onDiscountApplied={(amount, code, orgId) => {
                setDiscountApplied(true);
                setDiscountAmount(amount);
                setDiscountCode(code);
                setDiscountCodeOrgId(orgId);
              }}
              onDiscountRemoved={() => {
                setDiscountApplied(false);
                setDiscountAmount(0);
                setDiscountCode("");
                setDiscountCodeOrgId("");
              }}
              applied={discountApplied}
              appliedCode={discountCode}
              discountAmount={discountAmount}
            />

            {/* Use Credits Section */}
            <UseCreditsSection
              planPrice={selectedPlan.price - (discountApplied ? discountAmount : 0)}
              onCreditApplied={(amount, ids) => {
                setCreditApplied(true);
                setCreditAmount(amount);
                setCreditIds(ids);
              }}
              onCreditRemoved={() => {
                setCreditApplied(false);
                setCreditAmount(0);
                setCreditIds([]);
              }}
              applied={creditApplied}
            />

            {!isFullyCoveredByCredit && (
              <>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">خطوات الدفع:</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>
                      حوّل مبلغ <strong className="text-foreground">{finalPrice.toLocaleString()} جنيه</strong> إلى رقم فودافون كاش:
                    </li>
                    <li className="flex items-center gap-2 mr-4">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="font-mono font-bold text-foreground text-lg" dir="ltr">{vodafoneNumber}</span>
                    </li>
                    <li>بعد التحويل، أدخل رقم الهاتف المُحوَّل منه وارفع صورة الإيصال</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label>رقم الهاتف المُحوَّل منه</Label>
                  <Input
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                <div className="space-y-2">
                  <Label>صورة إيصال التحويل</Label>
                  <label className="block cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 p-4 hover:border-primary/30 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {screenshotFile ? screenshotFile.name : "اختر صورة"}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button onClick={handleSubmitPayment} disabled={submitting} className="flex-1 gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isFullyCoveredByCredit ? "تفعيل الباقة" : "إرسال طلب الاشتراك"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">سجل طلبات الدفع</h2>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {p.months} شهر — {p.amount} جنيه
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                </div>
                {p.status === "pending" ? (
                  <Badge className="bg-warning/15 text-warning border-warning/30">في الانتظار</Badge>
                ) : p.status === "approved" ? (
                  <Badge className="bg-success/15 text-success border-success/30">تمت الموافقة</Badge>
                ) : (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30">مرفوض</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
