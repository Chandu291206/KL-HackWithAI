import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiHome,
  FiBook,
  FiFileText,
  FiCalendar,
  FiBarChart2,
  FiLogOut,
  FiUser,
  FiBookOpen,
  FiVideo,
} from "react-icons/fi";

const menuItems = [
  { icon: <FiHome />, label: "Home", path: "/dashboard" },
  { icon: <FiBook />, label: "Learn", path: "/learn" },
  { icon: <FiVideo />, label: "AI Proctoring", path: "/ai-proctoring" },
  { icon: <FiCalendar />, label: "Plan", path: "/study-plan" },
  { icon: <FiBarChart2 />, label: "Analytics", path: "/analytics" },
  // { icon: <FiBookOpen />, label: "Topics", path: "/topic" },
  // { icon: <FiFileText />, label: "Tests", path: "/test" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className="hidden md:flex flex-col w-72 h-screen sticky top-0
      bg-sky/200 backdrop-blur-2xl border-r border-white/50
      shadow-[4px_0_30px_rgba(0,0,0,0.05)]">

      {/* Logo Section */}
      <div className="p-8">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 
                          flex items-center justify-center text-white text-xl shadow-lg">
            🎓
          </div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">
              EduCoach
            </h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
              Student AI
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                ${isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-100 shadow-sm"
                    : "text-slate-600 hover:bg-white/60 hover:text-blue-600 hover:-translate-y-0.5"
                  }`}
              >
                <span
                  className={`text-lg transition-colors ${isActive ? "text-blue-600" : "text-slate-400"
                    }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="mt-auto p-6 border-t border-white/50 flex flex-col gap-5">

        {/* User Card */}
        <div className="flex gap-4 p-4 rounded-2xl bg-white/50 backdrop-blur-xl 
                        border border-white shadow-sm items-center">

          <div className="w-11 h-11 rounded-full bg-blue-100 
                          flex items-center justify-center text-blue-600 shadow-inner">
            <FiUser />
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold truncate text-slate-900">
              {user?.name || "Student"}
            </div>
            <div className="text-xs text-slate-500 truncate font-semibold uppercase tracking-wider">
              {user?.exam_type || "JEE"} Aspirant
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold 
                     text-red-500 hover:bg-red-50 transition-all w-full"
        >
          <FiLogOut className="text-lg" />
          Log Out
        </button>

      </div>
    </aside>
  );
}
