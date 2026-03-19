import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Users, AlertTriangle, DoorOpen, BookOpen, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  stats?: {
    totalClasses: number;
    totalTeachers: number;
    activeConflicts: number;
    roomUtilization: number;
    totalSubjects?: number;
    totalRooms?: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Jami sinflar",
      value: stats?.totalClasses || 0,
      icon: GraduationCap,
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-50",
      iconColor: "text-blue-600",
      note: "faol sinf",
    },
    {
      label: "O'qituvchilar",
      value: stats?.totalTeachers || 0,
      icon: Users,
      bgColor: "bg-emerald-500",
      lightBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      note: "faol o'qituvchi",
    },
    {
      label: "Jadval ziddiyatlari",
      value: stats?.activeConflicts || 0,
      icon: AlertTriangle,
      bgColor: stats?.activeConflicts ? "bg-orange-500" : "bg-gray-400",
      lightBg: stats?.activeConflicts ? "bg-orange-50" : "bg-gray-50",
      iconColor: stats?.activeConflicts ? "text-orange-600" : "text-gray-500",
      note: stats?.activeConflicts ? "hal qilinmagan" : "muammo yo'q",
    },
    {
      label: "Xonalar band",
      value: `${stats?.roomUtilization || 0}%`,
      icon: DoorOpen,
      bgColor: "bg-violet-500",
      lightBg: "bg-violet-50",
      iconColor: "text-violet-600",
      note: "o'rtacha bandlik",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1.5">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.note}</p>
                </div>
                <div className={`w-11 h-11 ${card.lightBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`${card.iconColor} h-5 w-5`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
