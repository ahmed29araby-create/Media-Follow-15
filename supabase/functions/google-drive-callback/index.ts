import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // user ID
    const error = url.searchParams.get("error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    if (error) {
      return new Response(generateHTML("error", `Authorization denied: ${error}`), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !state) {
      return new Response(generateHTML("error", "Missing authorization code"), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Verify user is admin
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", state)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(generateHTML("error", "Admin access required"), {
        status: 403,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange code for tokens
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      return new Response(generateHTML("error", "Failed to get refresh token. Please try again."), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Get user info from Google to show which account is connected
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Store refresh token and connected email in admin_settings
    await serviceClient.from("admin_settings").upsert(
      { setting_key: "google_drive_refresh_token", setting_value: tokenData.refresh_token },
      { onConflict: "setting_key" }
    );

    await serviceClient.from("admin_settings").upsert(
      { setting_key: "google_drive_email", setting_value: userInfo.email || "Unknown" },
      { onConflict: "setting_key" }
    );

    return new Response(
      generateHTML("success", `Google Drive connected successfully as ${userInfo.email}!`),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new Response(generateHTML("error", `Error: ${err.message}`), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function generateHTML(status: "success" | "error", message: string): string {
  const color = status === "success" ? "#22c55e" : "#ef4444";
  const icon = status === "success" ? "✓" : "✗";
  return `<!DOCTYPE html>
<html>
<head><title>Google Drive - ${status === "success" ? "Connected" : "Error"}</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fff;">
  <div style="text-align:center;max-width:400px;padding:40px;">
    <div style="font-size:64px;color:${color};margin-bottom:16px;">${icon}</div>
    <h1 style="font-size:20px;margin-bottom:8px;">${message}</h1>
    <p style="color:#888;font-size:14px;">You can close this window and return to the app.</p>
    <script>setTimeout(() => window.close(), 3000);</script>
  </div>
</body>
</html>`;
}
