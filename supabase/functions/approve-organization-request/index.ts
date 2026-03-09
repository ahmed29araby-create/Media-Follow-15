import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();
    if (!roleCheck) throw new Error("Unauthorized: super_admin only");

    const { request_id, action } = await req.json();

    if (!request_id || !action) {
      throw new Error("Missing required fields");
    }

    // Get the request
    const { data: request, error: reqError } = await adminClient
      .from("org_registration_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqError || !request) throw new Error("Request not found");
    if (request.status !== "pending") throw new Error("Request already processed");

    if (action === "reject") {
      await adminClient
        .from("org_registration_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq("id", request_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve - create the organization
    if (action === "approve") {
      // Create organization
      const { data: org, error: orgError } = await adminClient
        .from("organizations")
        .insert({ name: request.org_name, email: request.org_email })
        .select()
        .single();
      if (orgError) throw orgError;

      // Create admin user
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: request.org_email,
        password: request.admin_password,
        email_confirm: true,
        user_metadata: {
          display_name: request.org_name,
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

      // Generate referral code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      await adminClient.from("referral_codes").insert({
        organization_id: org.id,
        code,
      });

      // If referred, link referral
      if (request.referral_code) {
        const { data: referrerCode } = await adminClient
          .from("referral_codes")
          .select("organization_id")
          .eq("code", request.referral_code)
          .maybeSingle();
        
        if (referrerCode) {
          await adminClient.from("referrals").insert({
            referrer_org_id: referrerCode.organization_id,
            referred_org_id: org.id,
          });
        }
      }

      // Update request status
      await adminClient
        .from("org_registration_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq("id", request_id);

      return new Response(JSON.stringify({ success: true, organization: org }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
