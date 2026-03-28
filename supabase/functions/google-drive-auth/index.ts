import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OAuthState = {
  userId: string;
  organizationId?: string;
  origin?: string;
};

function normalizeOrigin(origin: string | null): string | undefined {
  if (!origin) return undefined;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isAllowedHost =
      isLocalhost || host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
    const isAllowedProtocol = parsed.protocol === "https:" || (isLocalhost && parsed.protocol === "http:");

    if (!isAllowedHost || !isAllowedProtocol) return undefined;

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
}

function encodeState(state: OAuthState): string {
  return btoa(JSON.stringify(state));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization_id from profiles
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const organizationId = profileData?.organization_id;

    let clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
    // Handle case where user pasted full JSON credentials
    if (clientId && clientId.startsWith("{")) {
      try {
        const parsed = JSON.parse(clientId);
        clientId = parsed?.web?.client_id || parsed?.installed?.client_id || clientId;
      } catch {
        /* not JSON, use as-is */
      }
    }
    console.log("Using client ID prefix:", clientId?.substring(0, 10));
    if (!clientId || !clientId.includes(".apps.googleusercontent.com")) {
      return new Response(JSON.stringify({ error: "Google Client ID not configured correctly" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;
    const origin = normalizeOrigin(req.headers.get("origin"));
    const state = encodeState({ userId: user.id, organizationId, origin });

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
