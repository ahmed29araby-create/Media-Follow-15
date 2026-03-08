import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FolderOpen, Loader2, Link2, Unlink, Mail, CheckCircle2, Building2, Pencil } from "lucide-react";

export default function SettingsPage() {
  const { organizationId, organizationName } = useAuth();
  const [driveFolderPath, setDriveFolderPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Org editing
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const [folderRes, emailRes] = await Promise.all([
        supabase.from("admin_settings").select("setting_value").eq("setting_key", "drive_folder_path").maybeSingle(),
        supabase.from("admin_settings").select("setting_value").eq("setting_key", "google_drive_email").maybeSingle(),
      ]);
      if (folderRes.data) setDriveFolderPath(folderRes.data.setting_value);
      if (emailRes.data) setConnectedEmail(emailRes.data.setting_value);

      // Fetch org info
      if (organizationId) {
        const { data: orgData } = await supabase.from("organizations").select("name, email").eq("id", organizationId).single();
        if (orgData) {
          setOrgName(orgData.name);
          setOrgEmail(orgData.email);
        }
      }

      setLoading(false);
    };
    fetchSettings();
  }, [organizationId]);

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    const { error } = await supabase.from("admin_settings").upsert(
      { setting_key: key, setting_value: value, organization_id: organizationId },
      { onConflict: "setting_key" }
    );
    if (error) toast.error(error.message);
    else toast.success("تم حفظ الإعدادات");
    setSaving(false);
  };

  const connectDrive = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const popup = window.open(data.auth_url, "google-drive-auth", "width=500,height=700,scrollbars=yes");
      const interval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(interval);
          const { data: emailData } = await supabase.from("admin_settings").select("setting_value").eq("setting_key", "google_drive_email").maybeSingle();
          if (emailData) { setConnectedEmail(emailData.setting_value); toast.success("تم ربط Google Drive بنجاح!"); }
          setConnecting(false);
        }
      }, 1000);
    } catch (err: any) {
      toast.error(`فشل الاتصال: ${err.message}`);
      setConnecting(false);
    }
  };

  const disconnectDrive = async () => {
    setDisconnecting(true);
    await Promise.all([
      supabase.from("admin_settings").delete().eq("setting_key", "google_drive_refresh_token"),
      supabase.from("admin_settings").delete().eq("setting_key", "google_drive_email"),
    ]);
    setConnectedEmail(null);
    toast.success("تم فصل Google Drive");
    setDisconnecting(false);
  };

  const saveOrgInfo = async () => {
    if (!orgName.trim() || !orgEmail.trim()) {
      toast.error("اسم الشركة والبريد الإلكتروني مطلوبان");
      return;
    }
    setSavingOrg(true);
    const { error } = await supabase.from("organizations").update({ name: orgName.trim(), email: orgEmail.trim() }).eq("id", organizationId!);
    if (error) toast.error(error.message);
    else toast.success("تم تحديث بيانات الشركة");
    setSavingOrg(false);
  };

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 max-w-2xl space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إعدادات الشركة والتكامل</p>
      </div>

      {/* Company Info */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">بيانات الشركة</h2>
            <p className="text-xs text-muted-foreground">تعديل اسم الشركة والبريد الإلكتروني</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5 text-muted-foreground" />اسم الشركة</Label>
          <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="اسم الشركة" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />البريد الإلكتروني</Label>
          <Input value={orgEmail} onChange={e => setOrgEmail(e.target.value)} placeholder="company@example.com" type="email" dir="ltr" className="text-left" />
        </div>
        <Button onClick={saveOrgInfo} disabled={savingOrg}>{savingOrg && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ التغييرات</Button>
      </div>

      {/* Google Drive Settings */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Link2 className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">اتصال Google Drive</h2>
            <p className="text-xs text-muted-foreground">ربط حساب Google Drive لمزامنة الملفات</p>
          </div>
        </div>

        {connectedEmail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">متصل</p>
                <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" /><p className="text-xs text-muted-foreground truncate" dir="ltr">{connectedEmail}</p></div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={connectDrive} disabled={connecting} variant="outline" size="sm">{connecting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تغيير الحساب</Button>
              <Button onClick={disconnectDrive} disabled={disconnecting} variant="destructive" size="sm">{disconnecting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}<Unlink className="ml-2 h-4 w-4" />فصل</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground">ربط حساب Google Drive لتمكين مزامنة الملفات تلقائياً.</p>
            </div>
            <Button onClick={connectDrive} disabled={connecting}>{connecting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Link2 className="ml-2 h-4 w-4" />}ربط Google Drive</Button>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><FolderOpen className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">مسار الحفظ</h2>
            <p className="text-xs text-muted-foreground">تحديد مسار المجلد للملفات المعتمدة</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />مسار المجلد</Label>
          <Input value={driveFolderPath} onChange={e => setDriveFolderPath(e.target.value)} placeholder="/Production/Uploads/2026" dir="ltr" className="text-left" />
        </div>
        <Button onClick={() => saveSetting("drive_folder_path", driveFolderPath)} disabled={saving}>{saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ الإعدادات</Button>
      </div>
    </div>
  );
}
