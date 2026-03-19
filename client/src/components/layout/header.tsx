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
};

export default function Header() {
  const { user } = useAuth();
  const [location] = useLocation();
  const pageInfo = pageTitles[location] || { title: "Sahifa", subtitle: "" };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 mb-0.5">
              <span>Maktab Dars Jadvali</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-blue-600 font-medium">{pageInfo.title}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{pageInfo.title}</h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            className="relative text-gray-500 hover:text-gray-900"
          >
            <Bell className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2 pl-3 border-l border-gray-200">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 capitalize leading-tight">
                {user?.role === 'admin' ? 'Administrator' : user?.role === 'teacher' ? "O'qituvchi" : user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
