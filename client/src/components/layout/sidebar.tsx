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
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
      "bg-background border-r border-border overflow-x-hidden",
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
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

      <div className="border-t border-border py-3 px-[10px] space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "relative flex items-center w-full rounded-lg py-2.5 px-[10px] outline-none",
            "transition-colors duration-100",
            location === "/settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
            "transition-colors duration-100 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        <aside className="relative w-64 bg-background shadow-2xl flex flex-col z-10">
          <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
            <span className="text-sm font-bold text-foreground">Menyu</span>
            <button
              onClick={onMobileClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {navItems.map(item => (
              <NavItem key={item.href} {...item} expanded />
            ))}
          </nav>
          <div className="border-t border-border px-3 py-3 space-y-1">
            <NavItem href="/settings" label="Sozlamalar" icon={Settings} expanded />
            <button
              onClick={logout}
              className="flex items-center w-full rounded-lg py-2.5 px-3 mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-100"
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
