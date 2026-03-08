import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
  if (!data.access_token) {
    throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function findOrCreateFolder(accessToken: string, folderPath: string): Promise<string> {
  const parts = folderPath.split("/").filter(Boolean);
  let parentId = "root";

  for (const part of parts) {
    const query = `name='${part}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      });
      const createData = await createRes.json();
      parentId = createData.id;
    }
  }

  return parentId;
}

async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileData: Blob
): Promise<{ id: string; name: string }> {
  const metadata = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileData);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
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
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
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

    const { file_id } = await req.json();
    if (!file_id) {
      return new Response(JSON.stringify({ error: "file_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get file record
    const { data: fileRecord, error: fileError } = await serviceClient
      .from("files")
      .select("*")
      .eq("id", file_id)
      .single();

    if (fileError || !fileRecord) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!fileRecord.storage_path) {
      return new Response(JSON.stringify({ error: "No storage path for this file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get refresh token from admin settings
    const { data: tokenData } = await serviceClient
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "google_drive_refresh_token")
      .single();

    if (!tokenData?.setting_value) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected. Please connect Google Drive from Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get drive folder path
    const { data: settingData } = await serviceClient
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "drive_folder_path")
      .single();

    const driveFolderPath = settingData?.setting_value || "/Uploads";

    // Download file from storage
    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from("pending_uploads")
      .download(fileRecord.storage_path);

    if (downloadError || !fileBlob) {
      return new Response(
        JSON.stringify({ error: `Failed to download: ${downloadError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token using refresh token
    const accessToken = await getAccessTokenFromRefreshToken(tokenData.setting_value);
    const folderId = await findOrCreateFolder(accessToken, driveFolderPath);
    const driveFile = await uploadFileToDrive(accessToken, folderId, fileRecord.file_name, fileBlob);

    // Update file record
    await serviceClient
      .from("files")
      .update({
        drive_path: `${driveFolderPath}/${fileRecord.file_name}`,
        status: "approved",
      })
      .eq("id", file_id);

    return new Response(
      JSON.stringify({
        success: true,
        drive_file_id: driveFile.id,
        drive_path: `${driveFolderPath}/${fileRecord.file_name}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
