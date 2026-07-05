import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Wand2, Calendar, ArrowRight, Users,
  BookOpen, DoorOpen, GraduationCap, CheckCircle2, Clock, TrendingUp
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const today = new Date();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: conflicts = [], isLoading: conflictsLoading } = useQuery<any[]>({
    queryKey: ["/api/schedule-conflicts"],
  });

  const days = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
  const dateStr = `${today.getDate()} ${months[today.getMonth()]}, ${today.getFullYear()}`;
  const dayStr = days[today.getDay()];

  const statCards = [
    { label: "Sinflar", value: stats?.totalClasses ?? "—", icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50", href: "/classes" },
    { label: "O'qituvchilar", value: stats?.totalTeachers ?? "—", icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", href: "/teachers" },
    { label: "Fanlar", value: stats?.totalSubjects ?? "—", icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50", href: "/subjects" },
    { label: "Xonalar", value: stats?.totalRooms ?? "—", icon: DoorOpen, color: "text-orange-600", bg: "bg-orange-50", href: "/rooms" },
  ];

  const quickActions = [
    { icon: Wand2, label: "Jadval yaratish", description: "Avtomatik dars jadvalini yarating", color: "text-blue-600", bg: "bg-blue-50", href: "/timetables" },
    { icon: Users, label: "O'qituvchi qo'shish", description: "Yangi o'qituvchini ro'yxatga olish", color: "text-emerald-600", bg: "bg-emerald-50", href: "/teachers" },
    { icon: GraduationCap, label: "Sinf qo'shish", description: "Yangi sinf yaratish", color: "text-violet-600", bg: "bg-violet-50", href: "/classes" },
    { icon: BookOpen, label: "Fan qo'shish", description: "Yangi fan qo'shish", color: "text-orange-600", bg: "bg-orange-50", href: "/subjects" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bosh sahifa</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{dayStr}, {dateStr}</p>
        </div>
        <Button onClick={() => setLocation("/timetables")} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <Wand2 className="mr-2 h-4 w-4" />
          Jadval yaratish
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => setLocation(card.href)}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${card.color} h-5 w-5`} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? <div className="h-7 w-12 bg-muted animate-pulse rounded" /> : card.value}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* Scheduled lessons highlight */}
      {!statsLoading && stats?.totalScheduled > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-card/20 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-primary-foreground font-bold text-xl">{stats.totalScheduled} ta dars</p>
              <p className="text-blue-200 text-sm">Dars jadvali yaratildi</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLocation("/timetables")} className="bg-card/20 text-primary-foreground border-0 hover:bg-card/30">
            Ko'rish <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          {/* Quick actions */}
          <Card className="border border-border shadow-sm bg-card text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Tezkor amallar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => setLocation(action.href)}
                      className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left bg-card group"
                    >
                      <div className={`w-9 h-9 ${action.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`${action.color} h-4 w-4`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Setup guide if no data */}
          {!statsLoading && stats?.totalClasses === 0 && (
            <Card className="border border-amber-500/20 bg-amber-500/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-amber-600 dark:text-amber-400 flex items-center">
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Tizimni sozlash bo'yicha yo'riqnoma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { step: 1, label: "Fanlarni qo'shing", href: "/subjects", done: stats?.totalSubjects > 0 },
                    { step: 2, label: "O'qituvchilarni qo'shing va ularga fan belgilang", href: "/teachers", done: stats?.totalTeachers > 0 },
                    { step: 3, label: "Xonalarni qo'shing", href: "/rooms", done: stats?.totalRooms > 0 },
                    { step: 4, label: "Sinflarni qo'shing va ularga fan+o'qituvchi belgilang", href: "/classes", done: stats?.totalClasses > 0 },
                    { step: 5, label: "Jadval yaratish tugmasini bosing", href: "/timetables", done: stats?.totalScheduled > 0 },
                  ].map(({ step, label, href, done }) => (
                    <button
                      key={step}
                      onClick={() => setLocation(href)}
                      className={`flex items-center space-x-3 w-full p-2.5 rounded-lg text-left transition-colors ${done ? "opacity-60" : "hover:bg-amber-500/10"}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${done ? "bg-green-500 text-primary-foreground" : "bg-amber-500/30 text-amber-700 dark:text-amber-300"}`}>
                        {done ? "✓" : step}
                      </div>
                      <span className={`text-sm ${done ? "line-through text-muted-foreground/60" : "text-amber-700 dark:text-amber-300 font-medium"}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Conflicts */}
          <Card className="border border-border shadow-sm bg-card text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center">
                <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
                Jadval ziddiyatlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conflictsLoading ? (
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
              ) : conflicts.length > 0 ? (
                <div className="space-y-2">
                  {conflicts.slice(0, 4).map((c: any) => (
                    <div key={c.id} className="flex items-start space-x-2.5 p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                          {c.conflictType === "room" ? "Xona ziddiyati" : 
                           c.conflictType === "teacher" ? "O'qituvchi ziddiyati" : 
                           c.conflictType === "unavailability" ? "Bandlik ziddiyati" : "Sinf ziddiyati"}
                        </p>
                        <p className="text-xs text-orange-600/90 dark:text-orange-400/90 mt-0.5 truncate">{c.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Ziddiyatlar yo'q</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Jadval to'g'ri tuzilgan</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System status */}
          <Card className="border border-border shadow-sm bg-card text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center">
                <TrendingUp className="mr-2 h-4 w-4 text-blue-600" />
                Tizim holati
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "O'qituvchilar", icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", href: "/teachers", value: stats?.totalTeachers },
                { label: "Sinflar", icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50", href: "/classes", value: stats?.totalClasses },
                { label: "Fanlar", icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50", href: "/subjects", value: stats?.totalSubjects },
                { label: "Xonalar", icon: DoorOpen, color: "text-orange-600", bg: "bg-orange-50", href: "/rooms", value: stats?.totalRooms },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => setLocation(item.href)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-7 h-7 ${item.bg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`${item.color} h-3.5 w-3.5`} />
                      </div>
                      <span className="text-sm text-foreground font-medium group-hover:text-primary">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-muted text-foreground hover:bg-muted/80">
                        {statsLoading ? "..." : item.value ?? 0}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary" />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* School hours */}
          <Card className="border border-border shadow-sm bg-card text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                Dars vaqtlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {[
                  { n: "1-dars", time: "08:00 – 08:45" },
                  { n: "2-dars", time: "09:00 – 09:45" },
                  { n: "3-dars", time: "10:00 – 10:45" },
                  { n: "4-dars", time: "11:00 – 11:45" },
                  { n: "5-dars", time: "12:00 – 12:45" },
                  { n: "6-dars", time: "13:00 – 13:45" },
                ].map(slot => (
                  <div key={slot.n} className="flex items-center justify-between py-1 px-2 rounded">
                    <span className="text-xs font-medium text-muted-foreground">{slot.n}</span>
                    <span className="text-xs font-mono text-muted-foreground/80">{slot.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
