import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Copy, Gift, Users, Wallet, Loader2 } from "lucide-react";

interface ReferralInfo {
  code: string;
  totalCredits: number;
  availableCredits: number;
  referralCount: number;
  ownerPercentage: number;
  userPercentage: number;
}

export default function ReferralCard() {
  const { organizationId } = useAuth();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    fetchReferralInfo();
  }, [organizationId]);

  const fetchReferralInfo = async () => {
    if (!organizationId) return;

    const [codeRes, creditsRes, referralsRes, settingsRes] = await Promise.all([
      supabase.from("referral_codes").select("code").eq("organization_id", organizationId).maybeSingle(),
      supabase.from("referral_credits").select("amount, remaining, expires_at").eq("organization_id", organizationId),
      supabase.from("referrals").select("id").eq("referrer_org_id", organizationId),
      supabase.from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["referral_percentage", "user_discount_percentage"])
        .is("organization_id", null),
    ]);

    const now = new Date();
    const activeCredits = (creditsRes.data ?? []).filter(c => new Date(c.expires_at) > now);
    const totalCredits = activeCredits.reduce((sum, c) => sum + Number(c.amount), 0);
    const availableCredits = activeCredits.reduce((sum, c) => sum + Number(c.remaining), 0);

    // Extract percentages from settings
    const ownerPercentage = Number(settingsRes.data?.find(s => s.setting_key === "referral_percentage")?.setting_value || "50");
    const userPercentage = Number(settingsRes.data?.find(s => s.setting_key === "user_discount_percentage")?.setting_value || "25");

    setInfo({
      code: codeRes.data?.code ?? "",
      totalCredits,
      availableCredits,
      referralCount: referralsRes.data?.length ?? 0,
      ownerPercentage,
      userPercentage,
    });
    setLoading(false);
  };

  const copyCode = () => {
    if (!info?.code) return;
    navigator.clipboard.writeText(info.code);
    toast.success("تم نسخ كود الخصم!");
  };

  if (loading) {
    return (
      <div className="glass-panel p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!info?.code) return null;

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Gift className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">شارك الموقع واحصل على خصم!</h2>
          <p className="text-xs text-muted-foreground">شارك كود الخصم مع الآخرين واحصلوا على خصم معاً</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">كيف يعمل نظام الإحالة؟</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>شارك كود الخصم الخاص بك مع الآخرين</li>
          <li>عندما يستخدم شخص الكود عند الاشتراك، يحصل على خصم فوري</li>
          <li>وأنت تحصل على رصيد بنسبة من قيمة اشتراكه</li>
          <li>استخدم رصيدك للحصول على خصم على باقتك القادمة</li>
        </ol>
      </div>

      {/* Discount code */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">كود الخصم الخاص بك</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-center text-lg font-mono font-bold text-foreground tracking-widest" dir="ltr">
            {info.code}
          </div>
          <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5 shrink-0">
            <Copy className="h-3.5 w-3.5" />
            نسخ
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background border border-border/50 rounded-lg p-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs">استخدامات ناجحة</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{info.referralCount}</p>
        </div>
        <div className="bg-background border border-border/50 rounded-lg p-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span className="text-xs">رصيدك المتاح</span>
          </div>
          <p className="text-2xl font-bold text-primary">{info.availableCredits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">جنيه</span></p>
        </div>
      </div>

      {info.availableCredits > 0 && (
        <Badge className="bg-success/15 text-success border-success/30 text-xs">
          لديك رصيد {info.availableCredits.toLocaleString()} جنيه — يمكنك استخدامه عند الاشتراك في أي باقة
        </Badge>
      )}
    </div>
  );
}
