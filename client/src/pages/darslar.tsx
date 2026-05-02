import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, RotateCcw, Save, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { TimeSlot } from "@shared/schema";

const DEFAULT_PERIODS = [
  { periodNumber: 1, startTime: "08:00", endTime: "08:45" },
  { periodNumber: 2, startTime: "09:00", endTime: "09:45" },
  { periodNumber: 3, startTime: "10:00", endTime: "10:45" },
  { periodNumber: 4, startTime: "11:00", endTime: "11:45" },
  { periodNumber: 5, startTime: "12:00", endTime: "12:45" },
  { periodNumber: 6, startTime: "13:00", endTime: "13:45" },
];

function toHHMM(t: string): string {
  return (t || "").slice(0, 5);
}

function minuteDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export default function Darslar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: slots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots"],
  });

  const [periods, setPeriods] = useState(DEFAULT_PERIODS.map(p => ({ ...p })));

  useEffect(() => {
    if (slots.length > 0) {
      const day1 = slots.filter((s: any) => s.dayOfWeek === 1);
      if (day1.length > 0) {
        const mapped = day1
          .sort((a: any, b: any) => a.periodNumber - b.periodNumber)
          .map((s: any) => ({
            periodNumber: s.periodNumber,
            startTime: toHHMM(s.startTime),
            endTime: toHHMM(s.endTime),
          }));
        setPeriods(mapped);
      }
    }
  }, [slots]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/time-slots/periods", { periods }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/time-slots"] });
      toast({ title: "Saqlandi", description: "Dars soatlari yangilandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/time-slots/reset"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/time-slots"] });
      setPeriods(DEFAULT_PERIODS.map(p => ({ ...p })));
      toast({ title: "Tiklandi", description: "Standart vaqtlar o'rnatildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const update = (i: number, field: "startTime" | "endTime", val: string) => {
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dars soatlari</h1>
          <p className="text-gray-500 text-sm mt-0.5">Har bir dars davomiyligini va vaqtini belgilang</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="text-gray-600"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Standartga qaytarish
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-2 h-4 w-4" />
            Saqlash
          </Button>
        </div>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Dars jadvali soatlari
            <Badge variant="secondary" className="text-xs ml-1">{periods.length} ta dars</Badge>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">Bu vaqtlar Dushanba–Juma barcha kunlarga qo'llaniladi</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map((p, i) => {
                const duration = minuteDiff(p.startTime, p.endTime);
                return (
                  <div
                    key={p.periodNumber}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-sm">{p.periodNumber}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-14">Boshlanish</span>
                        <Input
                          type="time"
                          value={p.startTime}
                          onChange={e => update(i, "startTime", e.target.value)}
                          className="h-9 w-32 text-sm font-mono"
                        />
                      </div>
                      <span className="text-gray-300 text-lg">—</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-8">Tugash</span>
                        <Input
                          type="time"
                          value={p.endTime}
                          onChange={e => update(i, "endTime", e.target.value)}
                          className="h-9 w-32 text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {duration > 0 ? (
                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {duration} daqiqa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">
                          Noto'g'ri vaqt
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-amber-100 bg-amber-50/50 shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Eslatma</p>
              <p className="text-xs mt-0.5 text-amber-700">
                Dars soatlarini o'zgartirgandan so'ng, mavjud jadval qayta generatsiya qilinishi kerak bo'ladi.
                Vaqtlar barcha darslar uchun bir xil qo'llaniladi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
