import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { org_name, org_email, admin_password, referral_code, whatsapp_phone } = await req.json();
    const normalizedEmail = String(org_email ?? "").trim().toLowerCase();
    const normalizedOrgName = String(org_name ?? "").trim();

    if (!normalizedOrgName || !normalizedEmail || !admin_password) {
      throw new Error("جميع الحقول المطلوبة يجب ملؤها");
    }

    if (admin_password.length < 12) {
      throw new Error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("البريد الإلكتروني غير صالح");
    }

    // Check if email already exists in organizations
    const { data: existingOrg } = await adminClient
      .from("organizations")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingOrg) {
      throw new Error("هذا البريد الإلكتروني مسجل بالفعل");
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      throw new Error("هذا البريد الإلكتروني مستخدم بالفعل على المنصة");
    }

    // Check if there's already a pending request with this email
    const { data: existingRequest } = await adminClient
      .from("org_registration_requests")
      .select("id")
      .eq("org_email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      throw new Error("يوجد طلب قيد المراجعة بهذا البريد الإلكتروني بالفعل");
    }

    // Insert the registration request
    const { error: insertError } = await adminClient
      .from("org_registration_requests")
      .insert({
          org_name: normalizedOrgName,
          org_email: normalizedEmail,
        admin_password,
        referral_code: referral_code || null,
        whatsapp_phone: whatsapp_phone || null,
      });

    if (insertError) throw insertError;

    // Notify super admins
    const { data: superAdmins } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (superAdmins) {
      for (const sa of superAdmins) {
        await adminClient.from("notifications").insert({
          user_id: sa.user_id,
          title: "طلب تسجيل شركة جديدة",
            message: `شركة "${normalizedOrgName}" تطلب الانضمام للمنصة. البريد: ${normalizedEmail}${whatsapp_phone ? ` | واتساب: ${whatsapp_phone}` : ""}`,
          type: "org_request",
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
