import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Gift, Send, CheckCircle, Sparkles, Zap, Crown } from "lucide-react";

const offers = [
  {
    id: 1,
    title: "🎉 عرض الانطلاقة",
    subtitle: "خصم 30% على أول اشتراك",
    description:
      "ابدأ رحلتك معنا واحصل على خصم 30% على أول اشتراك! فرصة رائعة لتجربة جميع مميزات المنصة بسعر مميز. العرض محدود المدة.",
    icon: Sparkles,
    color: "from-primary/20 to-primary/5",
    accent: "text-primary",
  },
  {
    id: 2,
    title: "🔥 عرض التجديد المبكر",
    subtitle: "شهر مجاني عند التجديد قبل انتهاء الاشتراك",
    description:
      "جدد اشتراكك قبل انتهائه واحصل على شهر إضافي مجانًا! لا تفوت هذا العرض الحصري لعملائنا الأوفياء. استمر بالاستفادة من كل المزايا بدون انقطاع.",
    icon: Zap,
    color: "from-orange-500/20 to-orange-500/5",
    accent: "text-orange-500",
  },
  {
    id: 3,
    title: "👑 عرض الباقة المميزة",
    subtitle: "ترقية مجانية لمدة شهرين",
    description:
      "احصل على ترقية مجانية لمدة شهرين عند الاشتراك في الباقة السنوية! وفر أكثر واستمتع بمساحة تخزين أكبر ومزايا حصرية لفريقك.",
    icon: Crown,
    color: "from-yellow-500/20 to-yellow-500/5",
    accent: "text-yellow-500",
  },
];

export default function OffersPage() {
  const { user } = useAuth();
  const [sending, setSending] = useState<number | null>(null);
  const [sentOffers, setSentOffers] = useState<number[]>([]);

  const handleSendOffer = async (offer: (typeof offers)[0]) => {
    if (!user) return;
    setSending(offer.id);

    try {
      // Get all active organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id");

      if (orgsError) throw orgsError;
      if (!orgs || orgs.length === 0) {
        toast.error("لا توجد شركات مسجلة حاليًا");
        setSending(null);
        return;
      }

      // Get admin profiles for all orgs
      const orgIds = orgs.map((o) => o.id);
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, organization_id")
        .in("organization_id", orgIds);

      if (profilesError) throw profilesError;

      // Filter to only admin users
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(adminRoles?.map((r) => r.user_id) ?? []);
      const targetAdmins = adminProfiles?.filter((p) => adminUserIds.has(p.user_id)) ?? [];

      if (targetAdmins.length === 0) {
        toast.error("لا يوجد مسؤولون لإرسال العرض لهم");
        setSending(null);
        return;
      }

      // Send notification to each admin
      const notifications = targetAdmins.map((admin) => ({
        user_id: admin.user_id,
        organization_id: admin.organization_id,
        title: `عرض جديد: ${offer.title}`,
        message: `${offer.subtitle}\n\n${offer.description}`,
        type: "offer",
      }));

      const { error: insertError } = await supabase.from("notifications").insert(notifications);

      if (insertError) throw insertError;

      setSentOffers((prev) => [...prev, offer.id]);
      toast.success(`تم إرسال "${offer.title}" إلى ${targetAdmins.length} شركة بنجاح`);
    } catch (err: any) {
      console.error(err);
      toast.error("حدث خطأ أثناء إرسال العرض");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">العروض</h1>
      </div>
      <p className="text-muted-foreground">
        اختر العرض المناسب وأرسله لجميع الشركات المتعاقدة. سيصلهم كإشعار فوري.
      </p>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => {
          const Icon = offer.icon;
          const isSent = sentOffers.includes(offer.id);
          return (
            <Card
              key={offer.id}
              className={`relative overflow-hidden border-border/50 transition-shadow hover:shadow-lg bg-gradient-to-br ${offer.color}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${offer.accent}`} />
                  <CardTitle className="text-lg">{offer.title}</CardTitle>
                </div>
                <p className={`text-sm font-semibold ${offer.accent}`}>{offer.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{offer.description}</p>
                <Button
                  className="w-full gap-2"
                  onClick={() => handleSendOffer(offer)}
                  disabled={sending !== null || isSent}
                  variant={isSent ? "secondary" : "default"}
                >
                  {sending === offer.id ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      جاري الإرسال...
                    </>
                  ) : isSent ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      تم الإرسال
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      إرسال العرض لجميع الشركات
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
