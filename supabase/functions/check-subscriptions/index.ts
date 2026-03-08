import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();

  // 1. Get all active organizations with their latest subscription
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, is_active");

  if (!orgs) return new Response(JSON.stringify({ error: "No orgs" }), { headers: corsHeaders });

  for (const org of orgs) {
    // Get latest subscription for this org
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", org.id)
      .order("ends_at", { ascending: false })
      .limit(1);

    const sub = subs?.[0];
    if (!sub) continue;

    const endsAt = new Date(sub.ends_at);
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get admin user_id for this org (to send notifications)
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("organization_id", org.id);

    const adminUserIds = adminProfiles?.map((p) => p.user_id) ?? [];

    // Check if notification already sent today for this type
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const checkNotificationSent = async (type: string) => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("type", type)
        .gte("created_at", todayStart.toISOString());
      return (count ?? 0) > 0;
    };

    const formatDate = (d: Date) =>
      d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

    // Send reminder notifications
    if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
      const type = `sub_expiry_${daysLeft}d`;
      const alreadySent = await checkNotificationSent(type);
      if (!alreadySent) {
        const title =
          daysLeft === 1
            ? "⚠️ الاشتراك ينتهي غداً!"
            : `⚠️ الاشتراك ينتهي خلال ${daysLeft} أيام`;
        const message = `اشتراك شركة ${org.name} سينتهي بتاريخ ${formatDate(endsAt)}. يرجى تجديد الاشتراك لتجنب إيقاف الحساب.`;

        for (const userId of adminUserIds) {
          await supabase.from("notifications").insert({
            user_id: userId,
            organization_id: org.id,
            title,
            message,
            type,
          });
        }
      }
    }

    // Auto-disable expired organizations
    if (daysLeft <= 0 && org.is_active) {
      await supabase
        .from("organizations")
        .update({ is_active: false })
        .eq("id", org.id);

      // Send expiry notification
      const alreadySent = await checkNotificationSent("sub_expired");
      if (!alreadySent) {
        for (const userId of adminUserIds) {
          await supabase.from("notifications").insert({
            user_id: userId,
            organization_id: org.id,
            title: "🚫 تم إيقاف الحساب",
            message: `تم إيقاف حساب شركة ${org.name} بسبب انتهاء الاشتراك. يرجى تجديد الاشتراك لإعادة تفعيل الحساب.`,
            type: "sub_expired",
          });
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
});
