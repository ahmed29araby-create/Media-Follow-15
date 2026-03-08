import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Mail, Eye, EyeOff, Building2 } from "lucide-react";

export default function PrivacyPage() {
  const { user, isAdmin, isSuperAdmin, organizationId } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);

  const [editOrgName, setEditOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        }
        setOrgLoading(false);
      });
  }, [organizationId]);

  const saveOrgInfo = async () => {
    if (!editOrgName.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    setSavingOrg(true);
    const { error } = await supabase.from("organizations").update({ name: editOrgName.trim() }).eq("id", organizationId!);
    if (error) toast.error(error.message);
    else {
      toast.success("تم تحديث اسم الشركة");
      setOrgName(editOrgName.trim());
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

  const PasswordInput = ({ value, onChange, placeholder, show, setShow }: {
    value: string; onChange: (v: string) => void; placeholder: string;
    show: boolean; setShow: (v: boolean) => void;
  }) => (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="text-left pl-10"
      />
      <button
        type="button"
        onMouseDown={() => setShow(true)}
        onMouseUp={() => setShow(false)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(true)}
        onTouchEnd={() => setShow(false)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground select-none"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="p-6 flex justify-center" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        {/* Company name & email centered at top */}
        {isOrgUser && !orgLoading && (
          <div className="text-center space-y-1 pb-4 border-b border-border">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{orgName}</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">{orgEmail}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Org Name Change */}
          {isOrgUser && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground flex items-center justify-end gap-2">
                تغيير اسم الشركة
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              </h3>
              <Input value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} placeholder="اسم الشركة" dir="ltr" className="text-left" />
              <div className="flex justify-start">
                <Button size="sm" onClick={saveOrgInfo} disabled={savingOrg}>
                  {savingOrg && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ التغييرات
                </Button>
              </div>
              <div className="border-b border-border pt-2" />
            </section>
          )}

          {/* Email Change */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center justify-end gap-2">
              تغيير البريد الإلكتروني
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            </h3>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="البريد الإلكتروني الجديد" dir="ltr" className="text-left" />
            <p className="text-xs text-muted-foreground text-right">سيتم إرسال رسالة تأكيد إلى البريد الجديد قبل التفعيل.</p>
            <div className="flex justify-start">
              <Button size="sm" onClick={handleEmailChange} disabled={emailChangeLoading}>
                {emailChangeLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تغيير البريد
              </Button>
            </div>
            <div className="border-b border-border pt-2" />
          </section>

          {/* Password Change */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center justify-end gap-2">
              تغيير كلمة المرور
            </h3>
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="كلمة المرور الحالية" show={showCurrent} setShow={setShowCurrent} />
            <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="كلمة المرور الجديدة" show={showNew} setShow={setShowNew} />
            <PasswordInput value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="كلمة المرور يجب أن تكون 12 حرف على الأقل" show={showConfirm} setShow={setShowConfirm} />
            <div className="flex justify-start">
              <Button size="sm" onClick={handlePasswordChange} disabled={passwordLoading}>
                {passwordLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تحديث كلمة المرور
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
