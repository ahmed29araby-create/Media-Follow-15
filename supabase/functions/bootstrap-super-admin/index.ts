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

    const { email, password, secret_key } = await req.json();

    // Simple secret to prevent unauthorized bootstrapping
    if (secret_key !== "bootstrap-media-follow-2026") {
      throw new Error("Unauthorized");
    }

    if (!email || !password) throw new Error("Email and password required");

    const normalizedEmail = email.trim().toLowerCase();

    const { data: listedUsers, error: listUsersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listUsersError) throw listUsersError;

    let targetUser = listedUsers.users.find((user) => user.email?.toLowerCase() === normalizedEmail);

    if (!targetUser) {
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: normalizedEmail, account_status: "approved" },
      });
      if (userError) throw userError;
      targetUser = newUser.user;
    } else {
      const { error: updateUserError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(targetUser.user_metadata ?? {}),
          display_name: normalizedEmail,
          account_status: "approved",
        },
      });
      if (updateUserError) throw updateUserError;
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existingProfile?.id) {
      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({
          email: normalizedEmail,
          display_name: normalizedEmail,
          account_status: "approved",
        })
        .eq("user_id", targetUser.id);
      if (profileUpdateError) throw profileUpdateError;
    } else {
      const { error: profileInsertError } = await adminClient.from("profiles").insert({
        user_id: targetUser.id,
        email: normalizedEmail,
        display_name: normalizedEmail,
        account_status: "approved",
      });
      if (profileInsertError) throw profileInsertError;
    }

    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!existingRole?.id) {
      const { error: roleInsertError } = await adminClient.from("user_roles").insert({
        user_id: targetUser.id,
        role: "super_admin",
      });
      if (roleInsertError) throw roleInsertError;
    }

    return new Response(JSON.stringify({ success: true, user_id: targetUser.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
