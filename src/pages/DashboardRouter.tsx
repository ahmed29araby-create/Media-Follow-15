import { useAuth } from "@/contexts/AuthContext";
import SuperAdminDashboard from "./SuperAdminDashboard";
import AdminDashboard from "./AdminDashboard";
import MemberDashboard from "./MemberDashboard";

export default function DashboardRouter() {
  const { isSuperAdmin, isAdmin } = useAuth();
  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (isAdmin) return <AdminDashboard />;
  return <MemberDashboard />;
}
