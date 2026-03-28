import { Button } from "@/components/ui/button";
import { Clock, Zap } from "lucide-react";

interface OrganizationRequestPendingScreenProps {
  hasWhatsapp?: boolean;
  onBack: () => void;
}

export default function OrganizationRequestPendingScreen({
  hasWhatsapp = false,
  onBack,
}: OrganizationRequestPendingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative glass-panel w-full max-w-md p-8 text-center space-y-6 animate-slide-in">
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-foreground">Media Follow</span>
        </div>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
          <Clock className="h-8 w-8 text-warning animate-pulse-glow" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">طلب شركتك قيد المراجعة</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            طلب إنشاء الشركة ما زال تحت المراجعة من مسؤول المنصة، وسيتم تفعيل الحساب بعد الموافقة.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground space-y-2">
          {hasWhatsapp ? (
            <p>سيتم التواصل معك عبر WhatsApp عند تفعيل الشركة.</p>
          ) : (
            <p>حاول تسجيل الدخول مرة أخرى بعد 12 ساعة إذا لم تصلك الموافقة بعد.</p>
          )}
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">
          العودة لتسجيل الدخول
        </Button>
      </div>
    </div>
  );
}