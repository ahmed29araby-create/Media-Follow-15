import { useState } from "react";
import { Outlet } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div
        className="flex flex-1 flex-col transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? "16rem" : 0 }}
      >
        {/* Toggle button when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-white/70 hover:text-white hover:bg-sidebar/90 transition-colors shadow-lg"
            title="فتح القائمة"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        )}

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
