import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/";
  const isExamRoute = ["/test", "/ai-proctoring", "/break-timer"].includes(
    location.pathname
  );

  // Auth page stays clean
  if (isAuthPage) {
    return <Outlet />;
  }

  // Exam/timer routes stay distraction-free
  if (isExamRoute) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-200 via-blue-100 to-white text-slate-800">

      {/* Sidebar */}
      <Sidebar />

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white/40 backdrop-blur-xl border-l border-white/50">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
