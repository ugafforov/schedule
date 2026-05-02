import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar, LayoutDashboard, Users, GraduationCap, BookOpen,
  DoorOpen, LogOut, School, Settings, X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/timetables", label: "Dars jadvali", icon: Calendar },
  { href: "/teachers", label: "O'qituvchilar", icon: Users },
  { href: "/classes", label: "Sinflar", icon: GraduationCap },
  { href: "/subjects", label: "Fanlar", icon: BookOpen },
  { href: "/rooms", label: "Xonalar", icon: DoorOpen },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();

  const navigate = (href: string) => {
    setLocation(href);
    onClose?.();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <School className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Maktab Dars</h1>
            <p className="text-xs text-slate-400">Jadval tizimi</p>
          </div>
        </div>
        {/* Close button on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Menyu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group w-full text-left",
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left",
            location === "/settings"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-700 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Sozlamalar</span>
        </button>

        <button
          onClick={logout}
          className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-all duration-200 w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Chiqish</span>
        </button>

        {user && (
          <div className="mt-2 px-3 py-2.5 bg-slate-700/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {(user.firstName?.[0] || "?")}{user.lastName?.[0] || ""}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-slate-400 truncate">
                  {user.role === "admin" ? "Administrator" : user.role === "teacher" ? "O'qituvchi" : "Maktab"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 shadow-xl hidden lg:flex flex-col flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay + drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="relative w-72 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
