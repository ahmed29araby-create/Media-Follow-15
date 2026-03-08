import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OAuthState = {
  userId: string;
  origin?: string;
};

function parseOAuthState(rawState: string): OAuthState | null {
  // Try base64 JSON first (new format)
  try {
    const decoded = JSON.parse(atob(rawState));
    if (decoded && typeof decoded.userId === "string") {
      return { userId: decoded.userId, origin: typeof decoded.origin === "string" ? decoded.origin : undefined };
    }
  } catch { /* not base64 JSON */ }

  // Fallback: raw user ID (old format)
  if (rawState.match(/^[0-9a-f-]{36}$/i)) {
    return { userId: rawState };
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const parsedState = state ? parseOAuthState(state) : null;
    const userId = parsedState?.userId;
    const appOrigin = parsedState?.origin;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Helper: redirect back to app settings with status
    const redirectToApp = (status: string, message?: string) => {
      if (appOrigin) {
        const target = new URL("/settings", appOrigin);
        target.searchParams.set("google_drive", status);
        if (message) target.searchParams.set("gd_message", message);
        return new Response(null, {
          status: 302,
          headers: { Location: target.toString() },
        });
      }
      // Fallback: simple close-window HTML
      const color = status === "connected" ? "#22c55e" : "#ef4444";
      const icon = status === "connected" ? "✓" : "✗";
      const safeMsg = (message || "").replace(/[<>"'&]/g, "");
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Drive</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fff"><div style="text-align:center"><div style="font-size:64px;color:${color}">${icon}</div><h1 style="font-size:18px">${safeMsg}</h1><p style="color:#888;font-size:14px">يمكنك إغلاق هذه النافذة والعودة للتطبيق</p></div><script>setTimeout(()=>window.close(),2000)</script></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    };

    if (error) {
      return redirectToApp("error", `Authorization denied: ${error}`);
    }

    if (!code || !state || !userId) {
      return redirectToApp("error", "Missing authorization code");
    }

    // Verify user is admin
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return redirectToApp("error", "Admin access required");
    }

    // Extract client credentials
    let clientId = Deno.env.get("GOOGLE_CLIENT_ID")!.trim();
    let clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!.trim();
    if (clientId.startsWith("{")) {
      try { const p = JSON.parse(clientId); clientId = p?.web?.client_id || p?.installed?.client_id || clientId; } catch {}
    }
    if (clientSecret.startsWith("{")) {
      try { const p = JSON.parse(clientSecret); clientSecret = p?.web?.client_secret || p?.installed?.client_secret || clientSecret; } catch {}
    }
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
      console.error("Token response:", JSON.stringify(tokenData));
      return redirectToApp("error", "Failed to get refresh token");
    }

    // Get user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const connectedEmail = userInfo.email || "Unknown";

    // Store refresh token and email
    await serviceClient.from("admin_settings").upsert(
      { setting_key: "google_drive_refresh_token", setting_value: tokenData.refresh_token },
      { onConflict: "setting_key" },
    );
    await serviceClient.from("admin_settings").upsert(
      { setting_key: "google_drive_email", setting_value: connectedEmail },
      { onConflict: "setting_key" },
    );

    return redirectToApp("connected", connectedEmail);
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fff"><div style="text-align:center"><div style="font-size:64px;color:#ef4444">✗</div><h1 style="font-size:18px">Error: ${(err.message || "").replace(/[<>"'&]/g, "")}</h1></div><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
