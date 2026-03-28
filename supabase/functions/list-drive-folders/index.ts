import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractGoogleOAuthValue(rawValue: string | undefined, field: "client_id" | "client_secret"): string | null {
  const value = rawValue?.trim();
  if (!value) return null;
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      const extracted = parsed?.web?.[field] || parsed?.installed?.[field] || parsed?.[field];
      if (typeof extracted === "string" && extracted.trim()) return extracted.trim();
    } catch { /* not JSON */ }
  }
  return value;
}

async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const clientId = extractGoogleOAuthValue(Deno.env.get("GOOGLE_CLIENT_ID"), "client_id");
  const clientSecret = extractGoogleOAuthValue(Deno.env.get("GOOGLE_CLIENT_SECRET"), "client_secret");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("Failed to refresh access token");
  return data.access_token;
}

async function findFolderId(accessToken: string, folderPath: string): Promise<string | null> {
  const parts = folderPath.split("/").filter(Boolean);
  let parentId = "root";

  for (const part of parts) {
    const query = `name='${part}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (!data.files?.length) return null;
    parentId = data.files[0].id;
  }
  return parentId;
}

async function listSubfolders(accessToken: string, parentId: string): Promise<{ id: string; name: string }[]> {
  const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files ?? [];
}

async function createFolder(accessToken: string, parentId: string, folderName: string): Promise<{ id: string; name: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await serviceClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await serviceClient
      .from("profiles").select("organization_id").eq("user_id", user.id).single();
    const orgId = profileData?.organization_id;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list"; // "list" or "create"

    // Get refresh token
    const { data: tokenData } = await serviceClient
      .from("admin_settings").select("setting_value")
      .eq("setting_key", "google_drive_refresh_token").eq("organization_id", orgId).single();

    if (!tokenData?.setting_value) {
      return new Response(JSON.stringify({ error: "Google Drive غير متصل. اذهب للإعدادات لربط Google Drive." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get base folder path
    const { data: folderSetting } = await serviceClient
      .from("admin_settings").select("setting_value")
      .eq("setting_key", "drive_folder_path").eq("organization_id", orgId).single();

    const basePath = folderSetting?.setting_value || "/Uploads";
    const accessToken = await getAccessTokenFromRefreshToken(tokenData.setting_value);
    const baseFolderId = await findFolderId(accessToken, basePath);

    if (!baseFolderId) {
      return new Response(JSON.stringify({ error: "المجلد الأساسي غير موجود على Drive", folders: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const folderName = body.folder_name?.trim();
      if (!folderName) {
        return new Response(JSON.stringify({ error: "اسم المجلد مطلوب" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const newFolder = await createFolder(accessToken, baseFolderId, folderName);
      const folders = await listSubfolders(accessToken, baseFolderId);
      return new Response(JSON.stringify({ success: true, new_folder: newFolder, folders }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: list subfolders
    const folders = await listSubfolders(accessToken, baseFolderId);
    return new Response(JSON.stringify({ folders, base_path: basePath }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
