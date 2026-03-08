import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap, ArrowRight, ShieldAlert } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthStep = "login" | "signup" | "forgot-email" | "forgot-otp" | "forgot-newpass";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("login");
  const [otpCode, setOtpCode] = useState("");

  // Brute-force protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

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

  // ---- Forgot Password: send OTP ----
  const handleSendOTP = async () => {
    if (!normalizedEmail) {
      toast.error("اكتب البريد الإلكتروني أولاً");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إرسال رسالة استعادة كلمة المرور إلى بريدك الإلكتروني. يمكنك الضغط على الرابط في الرسالة أو إدخال رمز التحقق هنا.");
      setStep("forgot-otp");
    }
    setLoading(false);
  };

  // ---- Forgot Password: verify OTP ----
  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error("أدخل رمز التحقق المكون من 6 أرقام");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otpCode,
      type: "recovery",
    });
    if (error) {
      toast.error("رمز التحقق غير صحيح أو منتهي الصلاحية");
    } else {
      toast.success("تم التحقق بنجاح! أدخل كلمة المرور الجديدة");
      setStep("forgot-newpass");
    }
    setLoading(false);
  };

  // ---- Forgot Password: set new password ----
  const handleSetNewPassword = async () => {
    if (newPassword.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم تحديث كلمة المرور بنجاح!");
      navigate("/dashboard", { replace: true });
    }
    setLoading(false);
  };

  // ---- Login / Signup ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast.error(`حسابك مقفل مؤقتاً. حاول بعد ${lockoutRemaining} ثانية`);
      return;
    }

    if (step === "signup" && password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }

    setLoading(true);

    if (step === "signup") {
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
        handleLoginFailure();
        toast.error(
          error.message === "Invalid login credentials"
            ? "بيانات الدخول غير صحيحة. لو ناسي كلمة المرور اضغط (نسيت كلمة المرور)"
            : error.message
        );
      } else {
        setFailedAttempts(0);
        navigate("/dashboard", { replace: true });
      }
    }

    setLoading(false);
  };

  const resetToLogin = () => {
    setStep("login");
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // ---- RENDER ----
  const isForgotFlow = step === "forgot-email" || step === "forgot-otp" || step === "forgot-newpass";

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

        {/* =========== FORGOT PASSWORD FLOW =========== */}
        {isForgotFlow && (
          <div dir="rtl">
            {/* Back button */}
            <button
              onClick={resetToLogin}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              الرجوع لتسجيل الدخول
            </button>

            {step === "forgot-email" && (
              <>
                <h2 className="text-lg font-semibold text-foreground mb-1">نسيت كلمة المرور</h2>
                <p className="text-sm text-muted-foreground mb-6">أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="company@gmail.com"
                      required
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <Button className="w-full h-11" onClick={handleSendOTP} disabled={loading}>
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    إرسال رمز التحقق
                  </Button>
                </div>
              </>
            )}

            {step === "forgot-otp" && (
              <>
                <h2 className="text-lg font-semibold text-foreground mb-1">أدخل رمز التحقق</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  تم إرسال رسالة إلى <span className="text-foreground font-medium" dir="ltr">{normalizedEmail}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  افتح الرسالة وأدخل رمز التحقق المكون من 6 أرقام، أو اضغط على الرابط في الرسالة مباشرة.
                </p>
                <div className="space-y-5">
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button className="w-full h-11" onClick={handleVerifyOTP} disabled={loading || otpCode.length !== 6}>
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تحقق
                  </Button>
                  <Button variant="ghost" className="w-full text-xs" onClick={handleSendOTP} disabled={loading}>
                    إعادة إرسال الرمز
                  </Button>
                </div>
              </>
            )}

            {step === "forgot-newpass" && (
              <>
                <h2 className="text-lg font-semibold text-foreground mb-1">كلمة المرور الجديدة</h2>
                <p className="text-sm text-muted-foreground mb-6">أدخل كلمة المرور الجديدة (12 حرف على الأقل)</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">كلمة المرور الجديدة</Label>
                    <div className="relative">
                      <Input
                        id="new-pass"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={12}
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
                    <Label htmlFor="confirm-pass">تأكيد كلمة المرور</Label>
                    <Input
                      id="confirm-pass"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={12}
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <Button className="w-full h-11" onClick={handleSetNewPassword} disabled={loading}>
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تحديث كلمة المرور
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========== LOGIN / SIGNUP FLOW =========== */}
        {!isForgotFlow && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {step === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {step === "signup" ? "أدخل بياناتك لإنشاء حساب" : "أدخل بياناتك للمتابعة"}
            </p>

            {/* Lockout warning */}
            {isLockedOut && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" dir="rtl">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>محاولات كثيرة. حاول بعد {lockoutRemaining} ثانية</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === "signup" && (
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
                    minLength={step === "signup" ? 12 : undefined}
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
                {step === "login" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setStep("forgot-email")}
                  >
                    نسيت كلمة المرور؟
                  </Button>
                )}
                {step === "signup" && (
                  <p className="text-xs text-muted-foreground">يجب أن تكون 12 حرف على الأقل</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading || isLockedOut}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}
              </Button>
            </form>

            <div className="mt-6">
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => setStep(step === "signup" ? "login" : "signup")}
              >
                {step === "signup" ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب جديد"}
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                تواصل مع مسؤول المنصة للحصول على حساب
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
