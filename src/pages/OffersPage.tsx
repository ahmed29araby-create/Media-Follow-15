import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Gift, Send, CheckCircle, Sparkles, Zap, Crown, Pencil, X, Check } from "lucide-react";

interface Offer {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  color: string;
  accent: string;
}

const defaultOffers: Offer[] = [
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
  const [offers, setOffers] = useState<Offer[]>(defaultOffers);
  const [sending, setSending] = useState<number | null>(null);
  const [sentOffers, setSentOffers] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subtitle: "", description: "" });

  const startEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setEditForm({ title: offer.title, subtitle: offer.subtitle, description: offer.description });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", subtitle: "", description: "" });
  };

  const saveEdit = () => {
    if (!editForm.title.trim() || !editForm.subtitle.trim() || !editForm.description.trim()) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }
    setOffers((prev) =>
      prev.map((o) =>
        o.id === editingId
          ? { ...o, title: editForm.title, subtitle: editForm.subtitle, description: editForm.description }
          : o
      )
    );
    toast.success("تم حفظ التعديلات");
    cancelEdit();
  };

  const handleSendOffer = async (offer: Offer) => {
    if (!user) return;
    setSending(offer.id);

    try {
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id");

      if (orgsError) throw orgsError;
      if (!orgs || orgs.length === 0) {
        toast.error("لا توجد شركات مسجلة حاليًا");
        setSending(null);
        return;
      }

      const orgIds = orgs.map((o) => o.id);
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, organization_id")
        .in("organization_id", orgIds);

      if (profilesError) throw profilesError;

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
        اختر العرض المناسب وأرسله لجميع الشركات المتعاقدة. يمكنك تعديل النصوص قبل الإرسال.
      </p>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => {
          const Icon = offer.icon;
          const isSent = sentOffers.includes(offer.id);
          const isEditing = editingId === offer.id;

          return (
            <Card
              key={offer.id}
              className={`relative overflow-hidden border-border/50 transition-shadow hover:shadow-lg bg-gradient-to-br ${offer.color}`}
            >
              <CardHeader className="pb-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="عنوان العرض"
                    />
                    <input
                      value={editForm.subtitle}
                      onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background/80 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="العنوان الفرعي"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${offer.accent}`} />
                        <CardTitle className="text-lg">{offer.title}</CardTitle>
                      </div>
                      <button
                        onClick={() => startEdit(offer)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
                        title="تعديل العرض"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className={`text-sm font-semibold ${offer.accent}`}>{offer.subtitle}</p>
                  </>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={4}
                      className="w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      placeholder="تفاصيل العرض"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1.5" onClick={saveEdit}>
                        <Check className="h-3.5 w-3.5" />
                        حفظ
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                        إلغاء
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
