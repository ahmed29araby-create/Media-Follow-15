import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FolderOpen, Loader2, Link2, Unlink, Mail, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [driveFolderPath, setDriveFolderPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const [folderRes, emailRes] = await Promise.all([
        supabase
          .from("admin_settings")
          .select("setting_value")
          .eq("setting_key", "drive_folder_path")
          .single(),
        supabase
          .from("admin_settings")
          .select("setting_value")
          .eq("setting_key", "google_drive_email")
          .single(),
      ]);
      if (folderRes.data) setDriveFolderPath(folderRes.data.setting_value);
      if (emailRes.data) setConnectedEmail(emailRes.data.setting_value);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
    setSaving(false);
  };

  const connectDrive = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Open Google OAuth in a popup
      const popup = window.open(data.auth_url, "google-drive-auth", "width=500,height=700,scrollbars=yes");

      // Poll for popup close and refresh settings
      const interval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(interval);
          // Re-fetch connected email
          const { data: emailData } = await supabase
            .from("admin_settings")
            .select("setting_value")
            .eq("setting_key", "google_drive_email")
            .single();
          if (emailData) {
            setConnectedEmail(emailData.setting_value);
            toast.success("Google Drive connected successfully!");
          }
          setConnecting(false);
        }
      }, 1000);
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
      setConnecting(false);
    }
  };

  const disconnectDrive = async () => {
    setDisconnecting(true);
    try {
      // Remove refresh token and email from settings
      await Promise.all([
        supabase.from("admin_settings").delete().eq("setting_key", "google_drive_refresh_token"),
        supabase.from("admin_settings").delete().eq("setting_key", "google_drive_email"),
      ]);
      setConnectedEmail(null);
      toast.success("Google Drive disconnected");
    } catch (err: any) {
      toast.error(err.message);
    }
    setDisconnecting(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure Google Drive integration</p>
      </div>

      {/* Google Drive Connection */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Google Drive Connection</h2>
            <p className="text-xs text-muted-foreground">Connect your Google Drive account for file sync</p>
          </div>
        </div>

        {connectedEmail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Connected</p>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground truncate">{connectedEmail}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={connectDrive} disabled={connecting} variant="outline" size="sm">
                {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Switch Account
              </Button>
              <Button onClick={disconnectDrive} disabled={disconnecting} variant="destructive" size="sm">
                {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Unlink className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground">
                Connect your Google Drive account to enable automatic file synchronization.
                All approved uploads will be saved to your Google Drive.
              </p>
            </div>
            <Button onClick={connectDrive} disabled={connecting}>
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Connect Google Drive
            </Button>
          </div>
        )}
      </div>

      {/* Folder Path Setting */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FolderOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Upload Destination</h2>
            <p className="text-xs text-muted-foreground">Set the folder path for approved files</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Drive Folder Path
          </Label>
          <Input
            value={driveFolderPath}
            onChange={(e) => setDriveFolderPath(e.target.value)}
            placeholder="/Production/Uploads/2026"
          />
          <p className="text-xs text-muted-foreground">
            Approved files will be synced to this folder path
          </p>
        </div>

        <Button onClick={() => saveSetting("drive_folder_path", driveFolderPath)} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
