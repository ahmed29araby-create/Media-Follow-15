import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import PendingApproval from "@/pages/PendingApproval";
import DashboardRouter from "@/pages/DashboardRouter";
import UploadPage from "@/pages/UploadPage";
import FilesPage from "@/pages/FilesPage";
import ModerationPage from "@/pages/ModerationPage";
import AdminTeamPage from "@/pages/AdminTeamPage";
import AdminDashboard from "@/pages/AdminDashboard";
import SettingsPage from "@/pages/SettingsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/NotFound";
import PrivacyPage from "@/pages/PrivacyPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SubscriptionPage from "@/pages/SubscriptionPage";
import AdminSubscriptionsPage from "@/pages/AdminSubscriptionsPage";
import FinancialReportsPage from "@/pages/FinancialReportsPage";

const queryClient = new QueryClient();

function OrgDisabledScreen() {
  const { signOut, isAdmin, disableReason, user, organizationId } = useAuth();
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSent, setAppealSent] = useState(false);
  const [lastAppealStatus, setLastAppealStatus] = useState<string | null>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);

  const isSubscriptionIssue = !disableReason;

  // Fetch latest appeal status
  useEffect(() => {
    if (!organizationId || !user) { setLoadingAppeal(false); return; }
    supabase
      .from("org_appeals")
      .select("status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLastAppealStatus(data[0].status);
          if (data[0].status === "pending") setAppealSent(true);
        }
        setLoadingAppeal(false);
      });
  }, [organizationId, user]);

  const handleSubmitAppeal = async () => {
    if (!appealText.trim() || !user || !organizationId) return;
    setSubmittingAppeal(true);
    try {
      const { error } = await supabase.from("org_appeals" as any).insert({
        organization_id: organizationId,
        user_id: user.id,
        message: appealText.trim(),
      });
      if (error) throw error;

      // Send notification to super admins
      const { data: superAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      
      if (superAdmins) {
        for (const sa of superAdmins) {
          await supabase.from("notifications").insert({
            user_id: sa.user_id,
            title: "طلب إعادة تفعيل شركة",
            message: `شركة معطلة أرسلت طلب إعادة تفعيل: "${appealText.trim().substring(0, 100)}"`,
            type: "appeal",
            organization_id: organizationId,
          });
        }
      }

      setAppealSent(true);
      setShowAppeal(false);
      setAppealText("");
    } catch {
      // silently fail
    }
    setSubmittingAppeal(false);
  };

  if (showSubscription) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-between p-4 border-b border-border/50" dir="rtl">
          <button onClick={() => setShowSubscription(false)} className="text-sm text-primary hover:underline">← العودة</button>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:underline">تسجيل الخروج</button>
        </div>
        <SubscriptionPage />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6" dir="rtl">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-destructive/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="relative max-w-md w-full text-center space-y-6 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">تم تعطيل الشركة</h1>
          {isSubscriptionIssue ? (
            <p className="text-base text-muted-foreground">بسبب عدم تجديد الاشتراك</p>
          ) : (
            <p className="text-base text-muted-foreground">تم تعطيل شركتك من قِبل إدارة المنصة</p>
          )}
        </div>

        {isSubscriptionIssue ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم إيقاف الوصول إلى النظام مؤقتاً. يرجى تجديد الاشتراك لاستعادة جميع خدمات الشركة والوصول الكامل للنظام.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-right">
              <p className="text-xs font-semibold text-destructive mb-1">سبب التعطيل:</p>
              <p className="text-sm text-foreground leading-relaxed">{disableReason}</p>
            </div>
          </div>
        )}

        {isSubscriptionIssue ? (
          isAdmin ? (
            <button
              onClick={() => setShowSubscription(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full"
            >
              تجديد الاشتراك
            </button>
          ) : (
            <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
              يرجى التواصل مع مسؤول الشركة لتجديد الاشتراك.
            </p>
          )
        ) : (
          <>
            {/* Show rejection notice */}
            {lastAppealStatus === "rejected" && !showAppeal && !appealSent && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">✕ تم رفض طلب إعادة التفعيل</p>
                <p className="text-xs text-muted-foreground mt-1">تم مراجعة طلبك ورفضه من قِبل إدارة المنصة. يمكنك تقديم طلب جديد.</p>
              </div>
            )}

            {appealSent || lastAppealStatus === "pending" ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-primary font-medium">⏳ طلبك قيد المراجعة</p>
                <p className="text-xs text-muted-foreground mt-1">تم إرسال طلبك وهو قيد المراجعة من قِبل إدارة المنصة. سيتم الرد عليك في أقرب وقت.</p>
              </div>
            ) : showAppeal ? (
              <div className="space-y-3 text-right">
                <textarea
                  value={appealText}
                  onChange={e => setAppealText(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  dir="rtl"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitAppeal}
                    disabled={submittingAppeal || !appealText.trim()}
                    className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submittingAppeal ? "جاري الإرسال..." : "إرسال الطلب"}
                  </button>
                  <button
                    onClick={() => { setShowAppeal(false); setAppealText(""); }}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : isAdmin && !loadingAppeal ? (
              <button
                onClick={() => setShowAppeal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full"
              >
                {lastAppealStatus === "rejected" ? "تقديم طلب جديد" : "تقديم طلب إعادة تفعيل"}
              </button>
            ) : !isAdmin ? (
              <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                يرجى التواصل مع مسؤول الشركة لتقديم طلب إعادة التفعيل.
              </p>
            ) : null}
          </>
        )}

        <div>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors">تسجيل الخروج</button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading, isSuperAdmin, isAdmin, isMember, accountStatus, role, isOrgActive } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (accountStatus !== "approved") return <PendingApproval />;
  if (!isOrgActive && !isSuperAdmin) return <OrgDisabledScreen />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* Member routes */}
        {(isMember || isAdmin) && <Route path="/upload" element={<UploadPage />} />}
        <Route path="/files" element={<FilesPage />} />

        {/* Admin routes */}
        {isAdmin && <Route path="/team" element={<AdminTeamPage />} />}
        {isAdmin && <Route path="/moderation" element={<ModerationPage />} />}
        {(isAdmin || isSuperAdmin) && <Route path="/settings" element={<SettingsPage />} />}
        {isSuperAdmin && <Route path="/admin-dashboard" element={<AdminDashboard />} />}
        {isSuperAdmin && <Route path="/admin-subscriptions" element={<AdminSubscriptionsPage />} />}
        {isSuperAdmin && <Route path="/financial-reports" element={<FinancialReportsPage />} />}
        <Route path="/privacy" element={<PrivacyPage />} />
        {isAdmin && <Route path="/subscription" element={<SubscriptionPage />} />}

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
