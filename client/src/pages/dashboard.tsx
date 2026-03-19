import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StatsCards } from "@/components/stats/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Wand2, 
  Calendar, 
  Plus, 
  ArrowRight,
  Users,
  BookOpen,
  DoorOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  TrendingUp
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: conflicts, isLoading: conflictsLoading } = useQuery({
    queryKey: ["/api/schedule-conflicts"],
  });

  const today = new Date();
  const days = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
  const dateStr = `${today.getDate()} ${months[today.getMonth()]}, ${today.getFullYear()}`;
  const dayStr = days[today.getDay()];

  const quickActions = [
    {
      icon: Wand2,
      label: "Jadval yaratish",
      description: "Avtomatik dars jadvalini yarating",
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/timetables",
    },
    {
      icon: Users,
      label: "O'qituvchi qo'shish",
      description: "Yangi o'qituvchini ro'yxatga olish",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/teachers",
    },
    {
      icon: GraduationCap,
      label: "Sinf qo'shish",
      description: "Yangi sinf yaratish",
      color: "text-violet-600",
      bg: "bg-violet-50",
      href: "/classes",
    },
    {
      icon: BookOpen,
      label: "Fan qo'shish",
      description: "Yangi fan qo'shish",
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/subjects",
    },
  ];

  const weekDays = ["Du", "Se", "Ch", "Pa", "Ju"];
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bosh sahifa</h1>
          <p className="text-gray-500 text-sm mt-0.5">{dayStr}, {dateStr}</p>
        </div>
        <Button 
          onClick={() => setLocation("/timetables")}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Jadval yaratish
        </Button>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <StatsCards stats={stats} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                  Haftalik jadval ko'rinishi
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                  onClick={() => setLocation("/timetables")}
                >
                  To'liq ko'rish <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-3 text-gray-400 font-medium w-16">Vaqt</th>
                      {weekDays.map(d => (
                        <th key={d} className="text-center py-2 px-1 text-gray-500 font-semibold">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((time, i) => (
                      <tr key={time} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
                        <td className="py-2 pr-3 text-gray-400 font-mono text-xs">{time}</td>
                        {weekDays.map((day, j) => {
                          const filled = (i + j) % 3 !== 0 && i < 6;
                          const colors = ["bg-blue-100 text-blue-800", "bg-green-100 text-green-800", "bg-purple-100 text-purple-800", "bg-orange-100 text-orange-800", "bg-pink-100 text-pink-800"];
                          const subjects = ["Matematika", "Fizika", "Kimyo", "Biologiya", "Tarix", "Ingliz tili", "Adabiyot", "Geografiya"];
                          return (
                            <td key={day} className="py-1 px-1 text-center">
                              {filled ? (
                                <div className={`${colors[(i + j) % colors.length]} rounded px-1 py-0.5 text-xs leading-tight`}>
                                  {subjects[(i * 5 + j) % subjects.length]}
                                </div>
                              ) : (
                                <div className="text-gray-200">—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Tezkor amallar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => setLocation(action.href)}
                      className="flex items-center space-x-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-left bg-white group"
                    >
                      <div className={`w-9 h-9 ${action.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`${action.color} h-4 w-4`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{action.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
                Jadval ziddiyatlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conflictsLoading ? (
                <div className="skeleton h-20 rounded-lg" />
              ) : conflicts && conflicts.length > 0 ? (
                <div className="space-y-3">
                  {conflicts.slice(0, 4).map((conflict: any) => (
                    <div key={conflict.id} className="flex items-start space-x-2.5 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-900">
                          {conflict.conflictType === 'room' ? 'Xona ziddiyati' : 
                           conflict.conflictType === 'teacher' ? "O'qituvchi ziddiyati" : 'Sinf ziddiyati'}
                        </p>
                        <p className="text-xs text-orange-700 mt-0.5 truncate">{conflict.description}</p>
                      </div>
                    </div>
                  ))}
                  {conflicts.length > 4 && (
                    <p className="text-xs text-center text-gray-400">+{conflicts.length - 4} ta ziddiyat</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Ziddiyatlar yo'q</p>
                  <p className="text-xs text-gray-400 mt-0.5">Jadval to'g'ri tuzilgan</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center">
                <TrendingUp className="mr-2 h-4 w-4 text-blue-600" />
                Tizim holati
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "O'qituvchilar", icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", href: "/teachers" },
                { label: "Sinflar", icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50", href: "/classes" },
                { label: "Fanlar", icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50", href: "/subjects" },
                { label: "Xonalar", icon: DoorOpen, color: "text-orange-600", bg: "bg-orange-50", href: "/rooms" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => setLocation(item.href)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-7 h-7 ${item.bg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`${item.color} h-3.5 w-3.5`} />
                      </div>
                      <span className="text-sm text-gray-700 font-medium group-hover:text-blue-600">{item.label}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center">
                <Clock className="mr-2 h-4 w-4 text-gray-400" />
                Dars vaqtlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { n: "1-dars", time: "08:00 – 08:45" },
                  { n: "2-dars", time: "09:00 – 09:45" },
                  { n: "3-dars", time: "10:00 – 10:45" },
                  { n: "Tanaffus", time: "10:45 – 11:05", isBreak: true },
                  { n: "4-dars", time: "11:05 – 11:50" },
                  { n: "5-dars", time: "12:00 – 12:45" },
                  { n: "6-dars", time: "13:00 – 13:45" },
                ].map((slot) => (
                  <div key={slot.n} className={`flex items-center justify-between py-1.5 px-2 rounded ${slot.isBreak ? "bg-amber-50" : ""}`}>
                    <span className={`text-xs font-medium ${slot.isBreak ? "text-amber-700" : "text-gray-600"}`}>{slot.n}</span>
                    <span className={`text-xs font-mono ${slot.isBreak ? "text-amber-600" : "text-gray-500"}`}>{slot.time}</span>
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
