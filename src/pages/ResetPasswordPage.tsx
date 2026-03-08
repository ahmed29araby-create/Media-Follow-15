import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from the redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          setHasSession(true);
          setChecking(false);
        } else if (event === "SIGNED_IN" && session) {
          // Recovery links sometimes fire SIGNED_IN instead
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          if (hashParams.get("type") === "recovery") {
            setHasSession(true);
          }
          setChecking(false);
        }
      }
    );

    // Also check if we already have a session (e.g. page loaded with recovery token)
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setHasSession(true);
        setChecking(false);
      });
    }, 2000); // Give onAuthStateChange time to fire first

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async () => {
    if (password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("تم تحديث كلمة المرور بنجاح!");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <p className="text-foreground font-semibold">تم تحديث كلمة المرور بنجاح!</p>
          <p className="text-sm text-muted-foreground">جاري التحويل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative glass-panel w-full max-w-md p-8 animate-slide-in" dir="rtl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 glow-border">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Media Follow</h1>
            <p className="text-xs text-muted-foreground tracking-wider uppercase">Production Platform</p>
          </div>
        </div>

        {!hasSession ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              الرابط غير صالح أو منتهي الصلاحية. جرّب طلب إعادة تعيين كلمة المرور مرة أخرى.
            </p>
            <Button onClick={() => navigate("/auth", { replace: true })} className="w-full">
              الرجوع لتسجيل الدخول
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-1">إعادة تعيين كلمة المرور</h2>
            <p className="text-sm text-muted-foreground mb-6">أدخل كلمة المرور الجديدة (12 حرف على الأقل)</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    minLength={12}
                    required
                    dir="ltr"
                    className="text-left pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={12}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>

              <Button className="w-full h-11" onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تحديث كلمة المرور
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
