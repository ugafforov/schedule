import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Menu, School } from "lucide-react";

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-700 h-14 flex items-center px-4 flex-shrink-0 z-20">
      <div className="flex items-center justify-between w-full">
        {/* Left: hamburger (mobile) + brand */}
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={onMobileMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Brand */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <School className="h-4.5 w-4.5 text-white h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Maktab Dars Jadvali</p>
              {user && (
                <p className="text-xs text-slate-400 leading-tight">
                  Xush kelibsiz, {user.firstName} {user.lastName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: user avatar */}
        {user && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-xs">
                {user.firstName?.[0] || "?"}{user.lastName?.[0] || ""}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-white leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400 leading-tight">
                {user.role === "admin" ? "Administrator" : user.role === "teacher" ? "O'qituvchi" : "Maktab"}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
