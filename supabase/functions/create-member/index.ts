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

    // Verify calling user is admin
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
      .in("role", ["admin", "super_admin"])
      .limit(1);
    if (!roleCheck?.length) throw new Error("Unauthorized: admin only");

    // Get admin's organization
    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!adminProfile?.organization_id) throw new Error("Admin has no organization");

    const { email, password, display_name, folder_name, price_per_video } = await req.json();

    if (!email || !password || !display_name) throw new Error("Missing required fields");
    if (password.length < 12) throw new Error("Password must be at least 12 characters");

    // Create member user
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name,
        organization_id: adminProfile.organization_id,
        account_status: "approved",
      },
    });
    if (userError) throw userError;

    // Assign member role
    await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "member" });

    // Create member settings
    await adminClient.from("member_settings").insert({
      user_id: newUser.user.id,
      organization_id: adminProfile.organization_id,
      folder_name: folder_name || "uploads",
      price_per_video: price_per_video || 0,
    });

    // Notify member
    await adminClient.from("notifications").insert({
      user_id: newUser.user.id,
      organization_id: adminProfile.organization_id,
      title: "مرحباً بك في الفريق!",
      message: `تم إنشاء حسابك بنجاح. مجلد العمل: ${folder_name || "uploads"}`,
      type: "info",
    });

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
