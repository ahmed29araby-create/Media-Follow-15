import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getClientCredentials() {
  let clientId = Deno.env.get("GOOGLE_CLIENT_ID")!.trim();
  let clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!.trim();
  if (clientId.startsWith("{")) {
    try { const p = JSON.parse(clientId); clientId = p?.web?.client_id || p?.installed?.client_id || clientId; } catch {}
  }
  if (clientSecret.startsWith("{")) {
    try { const p = JSON.parse(clientSecret); clientSecret = p?.web?.client_secret || p?.installed?.client_secret || clientSecret; } catch {}
  }
  return { clientId, clientSecret };
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();
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
  if (!data.access_token) throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId = "root"): Promise<string> {
  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
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
  const createData = await createRes.json();
  return createData.id;
}

async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileData: Blob,
  mimeType: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  const metadata = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([fileData], { type: mimeType }));

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
  return await res.json();
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileName = formData.get("file_name") as string || file?.name || "video.mp4";
    const quality = formData.get("quality") as string || "original";
    const folderNameOverride = formData.get("folder_name") as string;
    const organizationId = formData.get("organization_id") as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get refresh token from admin settings (try org-specific first, then global)
    let tokenQuery = serviceClient
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "google_drive_refresh_token");

    if (organizationId) {
      tokenQuery = tokenQuery.eq("organization_id", organizationId);
    } else {
      tokenQuery = tokenQuery.is("organization_id", null);
    }

    let { data: tokenData } = await tokenQuery.single();

    // Fallback to global token if org-specific not found
    if (!tokenData?.setting_value && organizationId) {
      const { data: globalToken } = await serviceClient
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "google_drive_refresh_token")
        .is("organization_id", null)
        .single();
      tokenData = globalToken;
    }

    if (!tokenData?.setting_value) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected. Admin must connect Google Drive first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get member folder name
    const memberFolder = folderNameOverride || "uploads";

    // Get access token and upload
    const accessToken = await getAccessToken(tokenData.setting_value);

    // Create WebsiteUploads folder, then member subfolder
    const websiteUploadsFolderId = await findOrCreateFolder(accessToken, "WebsiteUploads");
    const memberFolderId = await findOrCreateFolder(accessToken, memberFolder, websiteUploadsFolderId);

    const fileBlob = await file.arrayBuffer();
    const driveFile = await uploadFileToDrive(
      accessToken,
      memberFolderId,
      fileName,
      new Blob([fileBlob]),
      file.type || "video/mp4"
    );

    const driveLink = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
    const drivePath = `WebsiteUploads/${memberFolder}/${fileName}`;

    // Insert file record in DB
    const { data: fileRecord, error: dbError } = await serviceClient.from("files").insert({
      user_id: user.id,
      file_name: fileName,
      file_path: `${memberFolder}/${fileName}`,
      file_size: file.size,
      quality,
      status: "pending",
      drive_path: driveLink,
      organization_id: organizationId,
    }).select("id").single();

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `DB error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_id: fileRecord.id,
        drive_file_id: driveFile.id,
        drive_link: driveLink,
        drive_path: drivePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Upload to drive error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
