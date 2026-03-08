import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Eye, EyeOff, ShieldCheck, Building2, Pencil } from "lucide-react";

export default function PrivacyPage() {
  const { user, isAdmin, isSuperAdmin, organizationId } = useAuth();

  // Org display
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);

  // Org editing
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgEmail, setEditOrgEmail] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  // Email change (personal)
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isOrgUser = (isAdmin || isSuperAdmin) && organizationId;

  useEffect(() => {
    if (!organizationId) { setOrgLoading(false); return; }
    supabase.from("organizations").select("name, email").eq("id", organizationId).single()
      .then(({ data }) => {
        if (data) {
          setOrgName(data.name);
          setOrgEmail(data.email);
          setEditOrgName(data.name);
          setEditOrgEmail(data.email);
        }
        setOrgLoading(false);
      });
  }, [organizationId]);

  const saveOrgInfo = async () => {
    if (!editOrgName.trim() || !editOrgEmail.trim()) { toast.error("اسم الشركة والبريد مطلوبان"); return; }
    setSavingOrg(true);
    const { error } = await supabase.from("organizations").update({ name: editOrgName.trim(), email: editOrgEmail.trim() }).eq("id", organizationId!);
    if (error) toast.error(error.message);
    else {
      toast.success("تم تحديث بيانات الشركة");
      setOrgName(editOrgName.trim());
      setOrgEmail(editOrgEmail.trim());
    }
    setSavingOrg(false);
  };

  const handleEmailChange = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) { toast.error("أدخل البريد الإلكتروني الجديد"); return; }
    if (trimmed === user?.email?.toLowerCase()) { toast.error("البريد الجديد هو نفس البريد الحالي"); return; }
    setEmailChangeLoading(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (error) toast.error(error.message);
    else { toast.success("تم إرسال رسالة تأكيد إلى البريد الجديد. تحقق من بريدك لتأكيد التغيير."); setNewEmail(""); }
    setEmailChangeLoading(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 12) { toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل"); return; }
    if (newPassword !== confirmNewPassword) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setPasswordLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: currentPassword });
    if (signInError) { toast.error("كلمة المرور الحالية غير صحيحة"); setPasswordLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث كلمة المرور بنجاح"); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword(""); }
    setPasswordLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl space-y-6" dir="rtl">
      {/* Header with org info */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الخصوصية</h1>
        {isOrgUser && !orgLoading && (
          <div className="mt-2">
            <p className="text-lg font-semibold text-foreground">{orgName}</p>
            <p className="text-sm text-muted-foreground" dir="ltr">{orgEmail}</p>
          </div>
        )}
        {!isOrgUser && <p className="text-sm text-muted-foreground">تغيير البريد الإلكتروني وكلمة المرور</p>}
      </div>

      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">إعدادات الحساب</h2>
            <p className="text-xs text-muted-foreground">
              {isOrgUser ? "تغيير بيانات الشركة وكلمة المرور" : "تغيير البريد الإلكتروني أو كلمة المرور"}
            </p>
          </div>
        </div>

        {/* Org Name Change - only for org admins */}
        {isOrgUser && (
          <div className="space-y-3 p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              تغيير اسم الشركة
            </h3>
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">اسم الشركة الجديد</Label>
              <Input id="edit-org-name" value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} placeholder="اسم الشركة" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-org-email">البريد الإلكتروني للشركة</Label>
              <Input id="edit-org-email" type="email" value={editOrgEmail} onChange={(e) => setEditOrgEmail(e.target.value)} placeholder="company@example.com" dir="ltr" className="text-left" />
            </div>
            <Button size="sm" onClick={saveOrgInfo} disabled={savingOrg}>
              {savingOrg && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التغييرات
            </Button>
          </div>
        )}

        {/* Email Change */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            تغيير البريد الإلكتروني
          </h3>
          <p className="text-xs text-muted-foreground">
            البريد الحالي: <span className="text-foreground" dir="ltr">{user?.email}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-email">البريد الإلكتروني الجديد</Label>
            <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@gmail.com" dir="ltr" className="text-left" />
          </div>
          <p className="text-xs text-muted-foreground">سيتم إرسال رسالة تأكيد إلى البريد الجديد قبل التفعيل.</p>
          <Button size="sm" onClick={handleEmailChange} disabled={emailChangeLoading}>
            {emailChangeLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تغيير البريد
          </Button>
        </div>

        {/* Password Change */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            تغيير كلمة المرور
          </h3>
          <div className="space-y-2">
            <Label htmlFor="current-password">كلمة المرور الحالية</Label>
            <div className="relative">
              <Input id="current-password" type={showPasswords ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••••••" dir="ltr" className="text-left pr-10" />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password-privacy">كلمة المرور الجديدة</Label>
            <Input id="new-password-privacy" type={showPasswords ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••••••" minLength={12} dir="ltr" className="text-left" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password-privacy">تأكيد كلمة المرور الجديدة</Label>
            <Input id="confirm-new-password-privacy" type={showPasswords ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••••••" minLength={12} dir="ltr" className="text-left" />
          </div>
          <p className="text-xs text-muted-foreground">كلمة المرور يجب أن تكون 12 حرف على الأقل.</p>
          <Button size="sm" onClick={handlePasswordChange} disabled={passwordLoading}>
            {passwordLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تحديث كلمة المرور
          </Button>
        </div>
      </div>
    </div>
  );
}
