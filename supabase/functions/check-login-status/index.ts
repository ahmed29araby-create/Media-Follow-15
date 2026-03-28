import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SUPER_ADMIN_EMAIL = "ahmed29araby@gmail.com";
const DEFAULT_SUPER_ADMIN_PASSWORD = "ahmedaraby29624367";

const getSuperAdminCredentials = () => ({
  email: String(Deno.env.get("SUPER_ADMIN_EMAIL") ?? DEFAULT_SUPER_ADMIN_EMAIL)
    .trim()
    .toLowerCase(),
  password: String(Deno.env.get("SUPER_ADMIN_PASSWORD") ?? DEFAULT_SUPER_ADMIN_PASSWORD),
});

const ensureSuperAdminAccount = async (
  adminClient: ReturnType<typeof createClient>,
  email: string,
  password: string,
) => {
  const { data: listedUsers, error: listUsersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listUsersError) throw listUsersError;

  let targetUser = listedUsers.users.find((user) => user.email?.toLowerCase() === email);

  if (!targetUser) {
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email, account_status: "approved" },
    });

    if (createUserError) throw createUserError;
    targetUser = newUser.user;
  } else {
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(targetUser.user_metadata ?? {}),
        display_name: email,
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
        email,
        display_name: email,
        account_status: "approved",
      })
      .eq("user_id", targetUser.id);

    if (profileUpdateError) throw profileUpdateError;
  } else {
    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      user_id: targetUser.id,
      email,
      display_name: email,
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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Server is not configured correctly");
    }

    const { email, password } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const superAdminCredentials = getSuperAdminCredentials();

    if (
      normalizedEmail === superAdminCredentials.email
      && normalizedPassword === superAdminCredentials.password
    ) {
      await ensureSuperAdminAccount(adminClient, normalizedEmail, normalizedPassword);

      return new Response(JSON.stringify({ status: "super_admin_ready" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (normalizedEmail === superAdminCredentials.email) {
      return new Response(JSON.stringify({ status: "wrong_password" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: existingProfile }, { data: existingOrganization }, { data: request }] = await Promise.all([
      adminClient.from("profiles").select("user_id").eq("email", normalizedEmail).limit(1).maybeSingle(),
      adminClient.from("organizations").select("id").eq("email", normalizedEmail).limit(1).maybeSingle(),
      adminClient
        .from("org_registration_requests")
        .select("status, whatsapp_phone, admin_password")
        .eq("org_email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (existingProfile || existingOrganization) {
      return new Response(JSON.stringify({ status: "wrong_password" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!request) {
      return new Response(JSON.stringify({ status: "email_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.admin_password !== normalizedPassword) {
      return new Response(JSON.stringify({ status: "wrong_password" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: request.status,
        hasWhatsapp: Boolean(request.whatsapp_phone?.trim()),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});