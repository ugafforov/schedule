import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { ScheduleGenerator } from "@/components/schedule/schedule-generator";
import { 
  Calendar, 
  Wand2, 
  Download, 
  AlertTriangle, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Info,
  Printer
} from "lucide-react";

const CLASSES = ["Barchasi", "9-A", "9-B", "9-C", "10-A", "10-B", "11-A", "11-B"];

export default function Timetables() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedClass, setSelectedClass] = useState("Barchasi");

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4);

  const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
  const weekLabel = `${startOfWeek.getDate()} – ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dars jadvali</h1>
          <p className="text-gray-500 text-sm mt-0.5">Haftalik dars jadvalini ko'rish va tahrirlash</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="text-gray-600">
            <Printer className="mr-1.5 h-4 w-4" />
            Chop etish
          </Button>
          <Button variant="outline" size="sm" className="text-gray-600">
            <Download className="mr-1.5 h-4 w-4" />
            Eksport
          </Button>
          <Button
            onClick={() => setShowGenerator(!showGenerator)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Jadval yaratish
          </Button>
        </div>
      </div>

      {showGenerator && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Avtomatik jadval yaratish</h3>
                <p className="text-xs text-gray-500">Barcha o'qituvchi, sinf va xonalar asosida jadval tuziladi</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowGenerator(false)} className="text-gray-400 hover:text-gray-600">
              ✕
            </Button>
          </div>
          <ScheduleGenerator />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-3 space-y-4">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-base font-semibold text-gray-900">Haftalik jadval</CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {weekLabel}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-medium">Bugun</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {CLASSES.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedClass === cls
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ScheduleGrid />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900">Amallar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowGenerator(true)}
              >
                <Wand2 className="mr-2 h-3.5 w-3.5" />
                Avtomatik jadval
              </Button>
              <Button className="w-full justify-start h-9 text-sm" variant="outline">
                <AlertTriangle className="mr-2 h-3.5 w-3.5 text-orange-500" />
                Ziddiyatlarni tekshir
              </Button>
              <Button className="w-full justify-start h-9 text-sm" variant="outline">
                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-500" />
                Oldingi haftadan ko'chir
              </Button>
              <Button className="w-full justify-start h-9 text-sm" variant="outline">
                <Trash2 className="mr-2 h-3.5 w-3.5 text-red-500" />
                Hammasini o'chirish
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900">Rangli belgilar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { color: "bg-blue-400", label: "Matematika" },
                { color: "bg-green-400", label: "Tabiiy fanlar" },
                { color: "bg-purple-400", label: "Kimyo" },
                { color: "bg-orange-400", label: "Ijtimoiy fanlar" },
                { color: "bg-pink-400", label: "Til va adabiyot" },
                { color: "bg-cyan-400", label: "Chet tillari" },
              ].map((item) => (
                <div key={item.label} className="flex items-center space-x-2.5">
                  <div className={`w-3 h-3 ${item.color} rounded-sm flex-shrink-0`} />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center">
                <Info className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                Yordam
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 leading-relaxed">
                Dars kartochkasini sichqoncha bilan ushlab boshqa vaqt uyasiga sudrab olib boring. 
                Avtomatik jadval yaratish uchun "Avtomatik jadval" tugmasini bosing.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900">Statistika</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { label: "Jami darslar", value: "42 ta" },
                { label: "O'qituvchilar yuki", value: "85%" },
                { label: "Xonalar bandligi", value: "72%" },
                { label: "Ziddiyatlar", value: "0 ta", green: true },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{stat.label}</span>
                  <span className={`text-xs font-semibold ${stat.green ? "text-green-600" : "text-gray-900"}`}>{stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
