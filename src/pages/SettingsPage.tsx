import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FolderOpen, Loader2, Link2, Unlink, Mail, CheckCircle2, Phone } from "lucide-react";
import ReferralCard from "@/components/referral/ReferralCard";

export default function SettingsPage() {
  const { organizationId, organizationName, isSuperAdmin } = useAuth();
  const [driveFolderPath, setDriveFolderPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Vodafone Cash number (super admin only)
  const [vodafoneNumber, setVodafoneNumber] = useState("");
  const [savingVodafone, setSavingVodafone] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const [folderRes, emailRes] = await Promise.all([
        supabase.from("admin_settings").select("setting_value").eq("setting_key", "drive_folder_path").maybeSingle(),
        supabase.from("admin_settings").select("setting_value").eq("setting_key", "google_drive_email").maybeSingle(),
      ]);
      if (folderRes.data) setDriveFolderPath(folderRes.data.setting_value);
      if (emailRes.data) setConnectedEmail(emailRes.data.setting_value);

      if (isSuperAdmin) {
        const vodRes = await supabase.from("admin_settings").select("setting_value").eq("setting_key", "vodafone_cash_number").maybeSingle();
        if (vodRes.data) setVodafoneNumber(vodRes.data.setting_value);
      }
      setLoading(false);
    };
    fetchSettings();

    // Handle Google Drive callback redirect
    const params = new URLSearchParams(window.location.search);
    const gdStatus = params.get("google_drive");
    if (gdStatus === "connected") {
      const email = params.get("gd_message");
      if (email) setConnectedEmail(email);
      toast.success("تم ربط Google Drive بنجاح!");
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("google_drive");
      url.searchParams.delete("gd_message");
      window.history.replaceState({}, "", url.toString());
      setConnecting(false);
    } else if (gdStatus === "error") {
      toast.error(params.get("gd_message") || "فشل ربط Google Drive");
      const url = new URL(window.location.href);
      url.searchParams.delete("google_drive");
      url.searchParams.delete("gd_message");
      window.history.replaceState({}, "", url.toString());
      setConnecting(false);
    }
  }, [organizationId, isSuperAdmin]);

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

  const saveVodafoneNumber = async () => {
    if (!vodafoneNumber.trim()) { toast.error("أدخل رقم فودافون كاش"); return; }
    setSavingVodafone(true);
    const { error } = await supabase.from("admin_settings").upsert(
      { setting_key: "vodafone_cash_number", setting_value: vodafoneNumber.trim(), organization_id: null },
      { onConflict: "setting_key" }
    );
    if (error) toast.error(error.message);
    else toast.success("تم حفظ رقم فودافون كاش");
    setSavingVodafone(false);
  };

  const connectDrive = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const popup = window.open(data.auth_url, "google-drive-auth", "width=500,height=700,scrollbars=yes");

      // Listen for message from popup
      const onMessage = async (event: MessageEvent) => {
        if (event.data?.type !== "google-drive-callback") return;
        window.removeEventListener("message", onMessage);
        clearInterval(fallback);
        if (event.data.status === "connected" && event.data.email) {
          setConnectedEmail(event.data.email);
          toast.success("تم ربط Google Drive بنجاح!");
        } else {
          toast.error(event.data.email || "فشل الاتصال");
        }
        setConnecting(false);
      };
      window.addEventListener("message", onMessage);

      // Fallback: poll popup closed
      const fallback = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(fallback);
          window.removeEventListener("message", onMessage);
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

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-1 pb-4 border-b border-border">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إعدادات الشركة والتكامل</p>
      </div>

      {/* Vodafone Cash Number - Super Admin only */}
      {isSuperAdmin && (
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-4 w-4 text-primary" /></div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">رقم فودافون كاش للاشتراكات</h2>
              <p className="text-xs text-muted-foreground">الرقم اللي هيحول عليه العملاء فلوس الاشتراك</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />رقم فودافون كاش</Label>
            <Input value={vodafoneNumber} onChange={e => setVodafoneNumber(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" className="text-left" />
          </div>
          <Button onClick={saveVodafoneNumber} disabled={savingVodafone}>
            {savingVodafone && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            حفظ الرقم
          </Button>
        </div>
      )}

      {/* Google Drive Settings */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Link2 className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">اتصال Google Drive</h2>
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

      {!isSuperAdmin && (
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
      )}

      {/* Referral Card - for org admins */}
      {!isSuperAdmin && <ReferralCard />}
    </div>
  );
}
