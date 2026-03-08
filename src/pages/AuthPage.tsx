import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap, ShieldAlert } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Brute-force protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref");
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
    // Store referral code in localStorage for later use during org creation
    if (referralCode) {
      localStorage.setItem("referral_code", referralCode);
    }
  }, [user, navigate, referralCode]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutUntil) {
      lockoutTimer.current = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setLockoutRemaining(0);
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
        } else {
          setLockoutRemaining(remaining);
        }
      }, 1000);
      return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
    }
  }, [lockoutUntil]);

  const normalizedEmail = email.trim().toLowerCase();
  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleLoginFailure = () => {
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockoutUntil(until);
      setLockoutRemaining(LOCKOUT_SECONDS);
      setFailedAttempts(0);
      toast.error(`تم تجاوز عدد المحاولات. حاول مجدداً بعد ${LOCKOUT_SECONDS} ثانية`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast.error(`حسابك مقفل مؤقتاً. حاول بعد ${lockoutRemaining} ثانية`);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      handleLoginFailure();
      toast.error(
        error.message === "Invalid login credentials"
          ? "بيانات الدخول غير صحيحة. تواصل مع مسؤول الشركة إذا نسيت كلمة المرور."
          : error.message
      );
    } else {
      setFailedAttempts(0);
      navigate("/dashboard", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
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

        <h2 className="text-lg font-semibold text-foreground mb-1">تسجيل الدخول</h2>
        <p className="text-sm text-muted-foreground mb-6">أدخل بياناتك للمتابعة</p>

        {/* Lockout warning */}
        {isLockedOut && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" dir="rtl">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>محاولات كثيرة. حاول بعد {lockoutRemaining} ثانية</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
              disabled={isLockedOut}
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
                dir="ltr"
                className="text-left pr-10"
                disabled={isLockedOut}
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
          <Button type="submit" className="w-full h-11" disabled={loading || isLockedOut}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            تسجيل الدخول
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            تواصل مع مسؤول الشركة للحصول على حساب أو إعادة تعيين كلمة المرور
          </p>
        </div>
      </div>
    </div>
  );
}
