import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OrganizationRequestPendingScreen from "@/components/auth/OrganizationRequestPendingScreen";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap, ShieldAlert } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const STATIC_SUPER_ADMIN_EMAIL = "ahmed29araby@gmail.com";
const STATIC_SUPER_ADMIN_PASSWORD = "ahmedaraby29624367";
const BOOTSTRAP_SUPER_ADMIN_SECRET = "bootstrap-media-follow-2026";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingRequestInfo, setPendingRequestInfo] = useState<{ hasWhatsapp: boolean } | null>(null);

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
      if (error.message === "Invalid login credentials") {
        const isStaticSuperAdminLogin =
          normalizedEmail === STATIC_SUPER_ADMIN_EMAIL && password === STATIC_SUPER_ADMIN_PASSWORD;

        if (isStaticSuperAdminLogin) {
          const { error: bootstrapError } = await supabase.functions.invoke("bootstrap-super-admin", {
            body: {
              email: normalizedEmail,
              password,
              secret_key: BOOTSTRAP_SUPER_ADMIN_SECRET,
            },
          });

          if (!bootstrapError) {
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });

            if (!retryError) {
              setFailedAttempts(0);
              navigate("/dashboard", { replace: true });
              setLoading(false);
              return;
            }
          }
        }

        const { data: loginStatus, error: loginStatusError } = await supabase.functions.invoke("check-login-status", {
          body: {
            email: normalizedEmail,
            password,
          },
        });

        if (!loginStatusError && loginStatus?.status === "pending") {
          setPendingRequestInfo({ hasWhatsapp: Boolean(loginStatus.hasWhatsapp) });
          setLoading(false);
          return;
        }

        if (!loginStatusError && loginStatus?.status === "super_admin_ready") {
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!retryError) {
            setFailedAttempts(0);
            navigate("/dashboard", { replace: true });
            setLoading(false);
            return;
          }

          handleLoginFailure();
          toast.error("تعذر تجهيز حساب مسؤول المنصة. حاول مرة أخرى.");
          setLoading(false);
          return;
        }

        if (!loginStatusError && loginStatus?.status === "rejected") {
          toast.error("تم رفض طلب إنشاء الشركة. يرجى التواصل مع إدارة المنصة للمزيد من التفاصيل.", { duration: 8000 });
          setLoading(false);
          return;
        }

        if (!loginStatusError && loginStatus?.status === "wrong_password") {
          handleLoginFailure();
          toast.error("كلمة المرور غير صحيحة. تأكد منها ثم حاول مرة أخرى.");
          setLoading(false);
          return;
        }

        if (!loginStatusError && loginStatus?.status === "email_not_found") {
          handleLoginFailure();
          toast.error("البريد الإلكتروني غير مسجل. تأكد من البريد الإلكتروني أو أنشئ شركة جديدة.");
          setLoading(false);
          return;
        }

        handleLoginFailure();
        toast.error("بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.");
      } else if (error.message.includes("Email not confirmed")) {
        handleLoginFailure();
        toast.error("لم يتم تأكيد البريد الإلكتروني بعد. يرجى التحقق من بريدك الإلكتروني.");
      } else {
        handleLoginFailure();
        toast.error("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.");
      }
    } else {
      setFailedAttempts(0);
      navigate("/dashboard", { replace: true });
    }

    setLoading(false);
  };

  if (pendingRequestInfo) {
    return (
      <OrganizationRequestPendingScreen
        hasWhatsapp={pendingRequestInfo.hasWhatsapp}
        onBack={() => setPendingRequestInfo(null)}
      />
    );
  }

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

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={() => navigate("/register-organization")}
          >
            إنشاء شركة جديدة
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            تواصل مع مسؤول الشركة للحصول على حساب أو إعادة تعيين كلمة المرور
          </p>
        </div>
      </div>
    </div>
  );
}
