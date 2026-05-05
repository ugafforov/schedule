import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Shield, LogOut, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sozlamalar</h1>
        <p className="text-gray-500 text-sm mt-0.5">Tizim va foydalanuvchi sozlamalari</p>
      </div>

      {/* Profil */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <User className="mr-2 h-4 w-4 text-blue-600" />
            Profil ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
              <span className="text-blue-700 font-bold text-lg">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email}
              </p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <Badge
                className={`mt-1 text-xs ${
                  user?.role === "admin"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
                variant="secondary"
              >
                <Shield className="mr-1 h-3 w-3" />
                {user?.role === "admin" ? "Administrator" : "O'qituvchi"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foydalanuvchilarni boshqarish */}
      {user?.role === "admin" && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center">
              <Shield className="mr-2 h-4 w-4 text-purple-600" />
              Foydalanuvchilarni boshqarish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Foydalanuvchilarni qo'shish, o'chirish va rollarini belgilash Supabase Dashboard orqali amalga oshiriladi.
            </p>
            <a
              href="https://supabase.com/dashboard/project/yfafnvypynldweuxsvdh/auth/users"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                <ExternalLink className="mr-2 h-4 w-4" />
                Supabase Auth Dashboard
              </Button>
            </a>
            <p className="text-xs text-gray-400 mt-3">
              Yangi foydalanuvchi qo'shganda <code className="bg-gray-100 px-1 rounded">user_metadata</code> ga{" "}
              <code className="bg-gray-100 px-1 rounded">{"{ \"role\": \"admin\" }"}</code> yoki{" "}
              <code className="bg-gray-100 px-1 rounded">{"{ \"role\": \"teacher\" }"}</code> qo'shing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chiqish */}
      <Card className="border border-red-100 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Tizimdan chiqish</p>
              <p className="text-sm text-gray-500 mt-0.5">Sessiyani yakunlash va login sahifasiga qaytish</p>
            </div>
            <Button
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Chiqish
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
