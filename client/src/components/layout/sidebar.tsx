import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar, LayoutDashboard, Users, GraduationCap, BookOpen,
  DoorOpen, LogOut, Settings, X, Clock, Link2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/",               label: "Bosh sahifa",    icon: LayoutDashboard },
  { href: "/timetables",     label: "Dars jadvali",   icon: Calendar },
  { href: "/teachers",       label: "O'qituvchilar",  icon: Users },
  { href: "/subjects",       label: "Fanlar",         icon: BookOpen },
  { href: "/rooms",          label: "Xonalar",        icon: DoorOpen },
  { href: "/darslar",        label: "Dars soatlari",  icon: Clock },
  { href: "/classes",        label: "Sinflar",        icon: GraduationCap },
  { href: "/biriktirishlar", label: "Biriktirishlar", icon: Link2 },
  { href: "/joint-lessons",  label: "Birlashtirilgan darslar", icon: Link2 },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  const navigate = (href: string) => {
    setLocation(href);
    onMobileClose?.();
  };

  const NavItem = ({
    href, label, icon: Icon, expanded = true
  }: { href: string; label: string; icon: typeof LayoutDashboard; expanded?: boolean }) => {
    const active = location === href;
    return (
      <button
        onClick={() => navigate(href)}
        className={cn(
          "relative flex items-center w-full rounded-lg py-2.5 px-[14px] outline-none",
          "transition-colors duration-100",
          active
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span
          className={cn(
            "whitespace-nowrap overflow-hidden text-sm font-medium",
            expanded
              ? "ml-3 max-w-[160px] opacity-100"
              : "ml-0 max-w-0 opacity-0 pointer-events-none",
            "transition-[max-width,opacity,margin] duration-200 ease-in-out"
          )}
        >
          {label}
        </span>
      </button>
    );
  };

  /* ── Desktop: pure-CSS hover, no JS state ─────────────────────── */
  const desktopSidebar = (
    <aside className={cn(
      "group/sidebar",
      "hidden lg:flex flex-col flex-shrink-0 h-full",
      "bg-slate-900 border-r border-slate-700/60 overflow-x-hidden",
      "w-[60px] hover:w-[220px]",
      "transition-[width] duration-200 ease-in-out",
      "[will-change:width]"
    )}>
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 px-[10px] space-y-1">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              "relative flex items-center w-full rounded-lg py-2.5 px-[10px] outline-none",
              "transition-colors duration-100",
              location === item.href
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className={cn(
              "whitespace-nowrap overflow-hidden text-sm font-medium",
              "ml-0 max-w-0 opacity-0",
              "group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100",
              "transition-[max-width,opacity,margin] duration-200 ease-in-out"
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-700/60 py-3 px-[10px] space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "relative flex items-center w-full rounded-lg py-2.5 px-[10px] outline-none",
            "transition-colors duration-100",
            location === "/settings"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className={cn(
            "whitespace-nowrap overflow-hidden text-sm font-medium",
            "ml-0 max-w-0 opacity-0",
            "group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100",
            "transition-[max-width,opacity,margin] duration-200 ease-in-out"
          )}>
            Sozlamalar
          </span>
        </button>

        <button
          onClick={logout}
          className={cn(
            "relative flex items-center w-full rounded-lg py-2.5 px-[10px] outline-none mt-1",
            "transition-colors duration-100 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={cn(
            "whitespace-nowrap overflow-hidden text-sm font-medium",
            "ml-0 max-w-0 opacity-0",
            "group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100",
            "transition-[max-width,opacity,margin] duration-200 ease-in-out"
          )}>
            Chiqish
          </span>
        </button>
      </div>
    </aside>
  );

  /* ── Mobile drawer ───────────────────────────────────────────────── */
  if (!mobileOpen) return desktopSidebar;

  return (
    <>
      {desktopSidebar}
      <div className="lg:hidden fixed inset-0 z-50 flex">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onMobileClose}
        />
        <aside className="relative w-64 bg-slate-900 shadow-2xl flex flex-col z-10">
          <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
            <span className="text-sm font-bold text-white">Menyu</span>
            <button
              onClick={onMobileClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {navItems.map(item => (
              <NavItem key={item.href} {...item} expanded />
            ))}
          </nav>
          <div className="border-t border-slate-700 px-3 py-3 space-y-1">
            <NavItem href="/settings" label="Sozlamalar" icon={Settings} expanded />
            <button
              onClick={logout}
              className="flex items-center w-full rounded-lg py-2.5 px-3 mt-1 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 transition-colors duration-100"
            >
              <LogOut className="w-5 h-5 flex-shrink-0 mr-3" />
              <span className="text-sm font-medium">Chiqish</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
