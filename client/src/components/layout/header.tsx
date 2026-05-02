import { useAuth } from "@/hooks/use-auth";
import { usePwa } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { Menu, School, Download, WifiOff } from "lucide-react";

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const { isOnline, isInstalled, canInstall, install } = usePwa();

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 z-30">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Internet aloqasi yo'q — Offline rejimda ishlayapsiz</span>
        </div>
      )}

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
                <School className="h-5 w-5 text-white" />
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

          {/* Right: install button + online indicator + user avatar */}
          <div className="flex items-center gap-3">
            {/* Online/offline dot indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                  isOnline ? "bg-emerald-400" : "bg-red-400 animate-pulse"
                }`}
              />
              <span className={`text-xs hidden sm:inline ${isOnline ? "text-slate-400" : "text-red-400"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {/* PWA install button */}
            {canInstall && !isInstalled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={install}
                className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 text-xs"
                title="Ilovani yuklab olish"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Yuklab olish</span>
              </Button>
            )}

            {/* User avatar */}
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
        </div>
      </header>
    </>
  );
}
