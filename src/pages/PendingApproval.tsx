import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Zap } from "lucide-react";

export default function PendingApproval() {
  const { signOut, accountStatus } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>
      <div className="relative glass-panel max-w-md p-8 text-center animate-slide-in">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-foreground">Media Follow</span>
        </div>
        {accountStatus === "rejected" ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">تم رفض الوصول</h2>
            <p className="text-sm text-muted-foreground mb-6">تم رفض طلب حسابك. تواصل مع المسؤول للتفاصيل.</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
              <Clock className="h-7 w-7 text-warning animate-pulse-glow" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">في انتظار الموافقة</h2>
            <p className="text-sm text-muted-foreground mb-6">حسابك في انتظار موافقة المسؤول. ستحصل على صلاحية الدخول بعد الموافقة.</p>
          </>
        )}
        <Button variant="outline" onClick={signOut}>
          <LogOut className="ml-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
