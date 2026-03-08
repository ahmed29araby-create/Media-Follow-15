import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (isSignUp && password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { display_name: displayName || normalizedEmail.split("@")[0] },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(
          error.message === "User already registered"
            ? "الحساب موجود بالفعل، جرّب تسجيل الدخول بنفس البريد"
            : error.message
        );
      } else {
        toast.success("تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد الحساب.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const { data: { session } } = await supabase.auth.getSession();
        const alreadySignedIn = session?.user?.email?.toLowerCase() === normalizedEmail;

        if (alreadySignedIn) {
          toast.success("أنت مسجل دخول بالفعل");
          navigate("/dashboard", { replace: true });
        } else {
          toast.error(
            error.message === "Invalid login credentials"
              ? "بيانات الدخول غير صحيحة (راجع البريد وكلمة المرور)"
              : error.message
          );
        }
      } else {
        navigate("/dashboard", { replace: true });
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative glass-panel w-full max-w-md p-8 animate-slide-in">
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

        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isSignUp ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isSignUp ? "أدخل بياناتك لإنشاء حساب" : "أدخل بياناتك للمتابعة"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="displayName">الاسم الكامل</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                required
                dir="rtl"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="company@gmail.com"
              required
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={isSignUp ? 12 : undefined}
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
            <p className="text-xs text-muted-foreground">
              {isSignUp ? "يجب أن تكون 12 حرف على الأقل" : ""}
            </p>
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSignUp ? "إنشاء حساب" : "تسجيل الدخول"}
          </Button>
        </form>

        <div className="mt-6">
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب جديد"}
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            تواصل مع مسؤول المنصة للحصول على حساب
          </p>
        </div>
      </div>
    </div>
  );
}
