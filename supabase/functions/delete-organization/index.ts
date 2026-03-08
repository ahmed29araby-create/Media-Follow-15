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

    const { organization_id, password } = await req.json();
    if (!organization_id || !password) throw new Error("Missing required fields");

    // Verify password by signing in
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (signInError) throw new Error("كلمة المرور غير صحيحة");

    // Get all users belonging to this organization
    const { data: orgProfiles } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("organization_id", organization_id);

    // Delete related data in order: notifications, change_requests, files, member_settings, admin_settings, profiles, user_roles, then org
    await adminClient.from("notifications").delete().eq("organization_id", organization_id);
    await adminClient.from("change_requests").delete().eq("organization_id", organization_id);
    await adminClient.from("files").delete().eq("organization_id", organization_id);
    await adminClient.from("member_settings").delete().eq("organization_id", organization_id);
    await adminClient.from("admin_settings").delete().eq("organization_id", organization_id);

    // Delete user roles and profiles for org users
    if (orgProfiles && orgProfiles.length > 0) {
      const userIds = orgProfiles.map(p => p.user_id);
      for (const uid of userIds) {
        await adminClient.from("user_roles").delete().eq("user_id", uid);
        await adminClient.from("profiles").delete().eq("user_id", uid);
        // Delete the auth user
        await adminClient.auth.admin.deleteUser(uid);
      }
    }

    // Finally delete the organization
    const { error: deleteOrgError } = await adminClient
      .from("organizations")
      .delete()
      .eq("id", organization_id);
    if (deleteOrgError) throw deleteOrgError;

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
