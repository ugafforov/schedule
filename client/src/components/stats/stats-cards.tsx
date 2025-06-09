import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Users, AlertTriangle, DoorOpen } from "lucide-react";

interface StatsCardsProps {
  stats?: {
    totalClasses: number;
    totalTeachers: number;
    activeConflicts: number;
    roomUtilization: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Total Classes",
      value: stats?.totalClasses || 0,
      change: "+12%",
      changeLabel: "vs last term",
      icon: GraduationCap,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      label: "Active Teachers",
      value: stats?.totalTeachers || 0,
      change: "+3",
      changeLabel: "new this month",
      icon: Users,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      label: "Schedule Conflicts",
      value: stats?.activeConflicts || 0,
      change: "-2",
      changeLabel: "since yesterday",
      icon: AlertTriangle,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500",
    },
    {
      label: "Room Utilization",
      value: `${stats?.roomUtilization || 0}%`,
      change: "+5%",
      changeLabel: "vs last week",
      icon: DoorOpen,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="stats-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                  <div className="flex items-center mt-2">
                    <span className="text-sm text-green-600 font-medium">{card.change}</span>
                    <span className="text-sm text-gray-500 ml-1">{card.changeLabel}</span>
                  </div>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${card.iconColor} h-6 w-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
