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
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6" dir="rtl">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">تم تعطيل الشركة</h1>
        <p className="text-muted-foreground">تم تعطيل شركتك من قِبل مسؤول الموقع. لا يمكنك الوصول إلى النظام حالياً.</p>
        <p className="text-sm text-muted-foreground">يرجى التواصل مع مسؤول الموقع لمزيد من المعلومات.</p>
        <button onClick={signOut} className="text-sm text-primary hover:underline">تسجيل الخروج</button>
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
