import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, Menu, ChevronRight } from "lucide-react";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Bosh sahifa", subtitle: "Dars jadvali tizimiga xush kelibsiz" },
  "/timetables": { title: "Dars jadvali", subtitle: "Haftalik dars jadvalini boshqarish" },
  "/teachers": { title: "O'qituvchilar", subtitle: "O'qituvchilar ro'yxatini boshqarish" },
  "/classes": { title: "Sinflar", subtitle: "Sinf va bo'limlarni boshqarish" },
  "/subjects": { title: "Fanlar", subtitle: "O'quv fanlarini boshqarish" },
  "/rooms": { title: "Xonalar", subtitle: "Xona va auditoriyalarni boshqarish" },
  "/settings": { title: "Sozlamalar", subtitle: "Tizim sozlamalari va kirish kodlari" },
};

interface HeaderProps {
  onMenuClick?: () => void;
  onCollapseClick?: () => void;
  sidebarCollapsed?: boolean;
}

export default function Header({ onMenuClick, onCollapseClick, sidebarCollapsed }: HeaderProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const pageInfo = pageTitles[location] || { title: "Sahifa", subtitle: "" };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3.5 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Desktop: toggle collapse | Mobile: open drawer */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-gray-600 hover:bg-gray-100"
            onClick={() => {
              if (window.innerWidth >= 1024) {
                onCollapseClick?.();
              } else {
                onMenuClick?.();
              }
            }}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div>
            <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400 mb-0.5">
              <span>Maktab Dars Jadvali</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-blue-600 font-medium">{pageInfo.title}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{pageInfo.title}</h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="relative text-gray-500 hover:text-gray-900 h-9 w-9 p-0"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-xs">
                {user?.firstName?.[0] || "?"}{user?.lastName?.[0] || ""}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-400 leading-tight">
                {user?.role === "admin" ? "Administrator" : user?.role === "teacher" ? "O'qituvchi" : "Maktab"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
