import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Shield, LogOut, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto text-foreground">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sozlamalar</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tizim va foydalanuvchi sozlamalari</p>
      </div>

      {/* Profil */}
      <Card className="border border-border shadow-sm bg-card text-card-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <User className="mr-2 h-4 w-4 text-primary" />
            Profil ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge
                className={`mt-1 text-xs ${
                  user?.role === "admin"
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
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
        <Card className="border border-border shadow-sm bg-card text-card-foreground">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center">
              <Shield className="mr-2 h-4 w-4 text-violet-500" />
              Foydalanuvchilarni boshqarish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Foydalanuvchilarni qo'shish, o'chirish va rollarini belgilash Supabase Dashboard orqali amalga oshiriladi.
            </p>
            <a
              href="https://supabase.com/dashboard/project/yfafnvypynldweuxsvdh/auth/users"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="border-violet-500/20 text-violet-500 hover:bg-violet-500/10">
                <ExternalLink className="mr-2 h-4 w-4" />
                Supabase Auth Dashboard
              </Button>
            </a>
            <p className="text-xs text-muted-foreground/60 mt-3">
              Yangi foydalanuvchi qo'shganda <code className="bg-muted px-1 rounded text-foreground">user_metadata</code> ga{" "}
              <code className="bg-muted px-1 rounded text-foreground">{"{ \"role\": \"admin\" }"}</code> yoki{" "}
              <code className="bg-muted px-1 rounded text-foreground">{"{ \"role\": \"teacher\" }"}</code> qo'shing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chiqish */}
      <Card className="border border-red-500/20 shadow-sm bg-card text-card-foreground">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Tizimdan chiqish</p>
              <p className="text-sm text-muted-foreground mt-0.5">Sessiyani yakunlash va login sahifasiga qaytish</p>
            </div>
            <Button
              variant="outline"
              className="border-red-500/20 text-red-500 hover:bg-red-500/10"
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
