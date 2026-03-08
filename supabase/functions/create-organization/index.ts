import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify calling user is super_admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: roleCheck } = await createClient(supabaseUrl, serviceRoleKey)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();
    if (!roleCheck) throw new Error("Unauthorized: super_admin only");

    const { org_name, org_email, admin_password, referral_code } = await req.json();

    if (!org_name || !org_email || !admin_password) {
      throw new Error("Missing required fields");
    }
    if (admin_password.length < 12) throw new Error("Password must be at least 12 characters");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Create organization
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({ name: org_name, email: org_email })
      .select()
      .single();
    if (orgError) throw orgError;

    // Create admin user using org email and org name as display name
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email: org_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        display_name: org_name,
        organization_id: org.id,
        account_status: "approved",
      },
    });
    if (userError) throw userError;

    // Assign admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role: "admin" });
    if (roleError) throw roleError;

    // Generate referral code for the new org
    const code = generateCode();
    await adminClient.from("referral_codes").insert({
      organization_id: org.id,
      code,
    });

    // If this org was referred, create the referral link
    if (referral_code) {
      const { data: referrerCode } = await adminClient
        .from("referral_codes")
        .select("organization_id")
        .eq("code", referral_code)
        .maybeSingle();
      
      if (referrerCode) {
        await adminClient.from("referrals").insert({
          referrer_org_id: referrerCode.organization_id,
          referred_org_id: org.id,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, organization: org }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
