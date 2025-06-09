import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  DoorOpen,
  Settings,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/timetables",
    label: "Timetables",
    icon: Calendar,
  },
  {
    href: "/teachers",
    label: "Teachers",
    icon: Users,
  },
  {
    href: "/classes",
    label: "Classes",
    icon: GraduationCap,
  },
  {
    href: "/subjects",
    label: "Subjects",
    icon: BookOpen,
  },
  {
    href: "/rooms",
    label: "Rooms",
    icon: DoorOpen,
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 hidden lg:block">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <Calendar className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Schedule Master</h1>
            <p className="text-sm text-gray-500">Academic Year 2024</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <a className={cn("nav-item", isActive && "active")}>
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </a>
            </Link>
          );
        })}
        
        <div className="pt-4 mt-4 border-t border-gray-200">
          <button className="nav-item w-full">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
          
          <button onClick={logout} className="nav-item w-full">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
