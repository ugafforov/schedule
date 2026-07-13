import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, User, Shield, LogOut, ExternalLink, CalendarClock } from "lucide-react";
import { CLASS_HOUR_SLOT_SETTING_KEY, DEFAULT_CLASS_HOUR_SLOT } from "@shared/constants";

const DAY_NAMES: Record<number, string> = {
  1: "Dushanba", 2: "Seshanba", 3: "Chorshanba", 4: "Payshanba", 5: "Juma", 6: "Shanba",
};

function ClassHourSlotCard() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data } = useQuery<{ key: string; value: { dayOfWeek: number; periodNumber: number } }>({
    queryKey: [`/api/settings/${CLASS_HOUR_SLOT_SETTING_KEY}`],
  });
  const slot = data?.value || DEFAULT_CLASS_HOUR_SLOT;

  const saveMutation = useMutation({
    mutationFn: async (value: { dayOfWeek: number; periodNumber: number }) => {
      await apiRequest("PUT", `/api/settings/${CLASS_HOUR_SLOT_SETTING_KEY}`, value);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/settings/${CLASS_HOUR_SLOT_SETTING_KEY}`] });
      toast({ title: "Muvaffaqiyat", description: "Sinf soati vaqti saqlandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Saqlanmadi", variant: "destructive" }),
  });

  return (
    <Card className="border border-border shadow-sm bg-card text-card-foreground">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center">
          <CalendarClock className="mr-2 h-4 w-4 text-emerald-500" />
          Jadval sozlamalari
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Sinf soati (Kelajak soati) vaqti</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sinf soati odatda dushanba 1-darsda o'tkaziladi va uni sinf rahbari o'tadi.
            Xususiy maktablar boshqa kun/vaqtni tanlashi mumkin.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Kun</Label>
            <Select
              value={String(slot.dayOfWeek)}
              onValueChange={v => saveMutation.mutate({ dayOfWeek: parseInt(v), periodNumber: slot.periodNumber })}
              disabled={saveMutation.isPending}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(d => (
                  <SelectItem key={d} value={String(d)}>{DAY_NAMES[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Dars raqami</Label>
            <Select
              value={String(slot.periodNumber)}
              onValueChange={v => saveMutation.mutate({ dayOfWeek: slot.dayOfWeek, periodNumber: parseInt(v) })}
              disabled={saveMutation.isPending}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map(p => (
                  <SelectItem key={p} value={String(p)}>{p}-dars</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

      {/* Jadval sozlamalari */}
      {user?.role === "admin" && <ClassHourSlotCard />}

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
