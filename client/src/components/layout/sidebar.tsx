import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar, LayoutDashboard, Users, GraduationCap, BookOpen,
  DoorOpen, LogOut, Settings, X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/",          label: "Bosh sahifa",   icon: LayoutDashboard },
  { href: "/timetables",label: "Dars jadvali",  icon: Calendar },
  { href: "/teachers",  label: "O'qituvchilar", icon: Users },
  { href: "/classes",   label: "Sinflar",       icon: GraduationCap },
  { href: "/subjects",  label: "Fanlar",        icon: BookOpen },
  { href: "/rooms",     label: "Xonalar",       icon: DoorOpen },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [hovered, setHovered] = useState(false);

  const navigate = (href: string) => {
    setLocation(href);
    onMobileClose?.();
  };

  /* ── shared nav items renderer ──────────────────────────────────── */
  const NavList = ({ expanded }: { expanded: boolean }) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = location === item.href;
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              "flex items-center w-full rounded-lg transition-colors duration-150 group",
              expanded ? "px-3 py-2.5 space-x-3" : "justify-center w-10 h-10 mx-auto",
              active
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-700/70 hover:text-white"
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {expanded && (
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                {item.label}
              </span>
            )}
            {expanded && active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />}
          </button>
        );
      })}
    </>
  );

  /* ── bottom actions ──────────────────────────────────────────────── */
  const BottomActions = ({ expanded }: { expanded: boolean }) => (
    <>
      <button
        onClick={() => navigate("/settings")}
        className={cn(
          "flex items-center rounded-lg transition-colors duration-150",
          expanded ? "w-full px-3 py-2.5 space-x-3" : "justify-center w-10 h-10 mx-auto",
          location === "/settings" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-700/70 hover:text-white"
        )}
      >
        <Settings className="w-5 h-5 flex-shrink-0" />
        {expanded && <span className="text-sm font-medium whitespace-nowrap">Sozlamalar</span>}
      </button>

      <button
        onClick={logout}
        className={cn(
          "flex items-center rounded-lg transition-colors duration-150 text-slate-400 hover:bg-red-900/40 hover:text-red-400",
          expanded ? "w-full px-3 py-2.5 space-x-3" : "justify-center w-10 h-10 mx-auto"
        )}
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        {expanded && <span className="text-sm font-medium whitespace-nowrap">Chiqish</span>}
      </button>

      {user && expanded && (
        <div className="px-3 py-2.5 bg-slate-700/50 rounded-lg mt-1">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user.firstName?.[0] || "?"}{user.lastName?.[0] || ""}
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
    </>
  );

  /* ── desktop sidebar ─────────────────────────────────────────────── */
  const desktopSidebar = (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "hidden lg:flex flex-col flex-shrink-0 bg-slate-900 border-r border-slate-700/60 overflow-hidden",
        "transition-all duration-200 ease-in-out",
        hovered ? "w-56" : "w-[60px]"
      )}
    >
      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-3", hovered ? "px-3 space-y-0.5" : "px-2.5 space-y-1")}>
        {!hovered && <div className="h-2" />}
        {hovered && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 mt-1">Menyu</p>
        )}
        <NavList expanded={hovered} />
      </nav>

      <div className={cn("border-t border-slate-700/60 py-3 space-y-0.5", hovered ? "px-3" : "px-2.5")}>
        <BottomActions expanded={hovered} />
      </div>
    </aside>
  );

  /* ── mobile drawer ───────────────────────────────────────────────── */
  const mobileDrawer = mobileOpen ? (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onMobileClose} />
      <aside className="relative w-64 bg-slate-900 shadow-2xl flex flex-col z-10">
        {/* Mobile header */}
        <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
          <span className="text-sm font-bold text-white">Menyu</span>
          <button onClick={onMobileClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <NavList expanded={true} />
        </nav>
        <div className="border-t border-slate-700 px-3 py-3 space-y-0.5">
          <BottomActions expanded={true} />
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  );
}
