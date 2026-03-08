import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hashParams.get("type");

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsRecoverySession(type === "recovery" && !!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
      setIsRecoverySession(currentType === "recovery" && !!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

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
      toast.success("تم تحديث كلمة المرور بنجاح");
      navigate("/dashboard", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm" dir="rtl">
        <h1 className="mb-2 text-xl font-bold text-foreground">إعادة تعيين كلمة المرور</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isRecoverySession
            ? "اكتب كلمة المرور الجديدة لتأمين حسابك."
            : "افتح الرابط الذي وصلك على البريد الإلكتروني ثم أعد المحاولة."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="toggle password visibility"
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

          <Button type="submit" className="w-full" disabled={loading || !isRecoverySession}>
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تحديث كلمة المرور
          </Button>
        </form>
      </div>
    </div>
  );
}
