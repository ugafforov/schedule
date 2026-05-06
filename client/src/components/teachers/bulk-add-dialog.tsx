import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Zap, Users, Wand2, X, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TeacherRecommendation {
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  totalWeeklyHours: number;
  classCount: number;
  neededTeachers: number;
  existingTeachers: number;
  vacancies: number;
}

interface BulkTeacherItem {
  firstName: string;
  lastName: string;
  subjectId?: number;
  subjectName?: string;
  subjectColor?: string;
}

const CURRICULUM_MAX_HOURS = 24;

export function BulkAddTeachers({ 
  open, 
  onClose, 
  onSuccess, 
  autoGenerateMutation 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
  autoGenerateMutation: any 
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"recommend" | "manual">("recommend");
  const [maxHours, setMaxHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [manualText, setManualText] = useState("");
  const [generatedList, setGeneratedList] = useState<BulkTeacherItem[]>([]);

  const { data: recs = [], isLoading: recsLoading } = useQuery<TeacherRecommendation[]>({
    queryKey: ["/api/teacher-recommendation"],
    enabled: open,
    refetchInterval: false,
  });

  const vacancyRecs = recs.filter(r => r.vacancies > 0);
  const totalVacancies = vacancyRecs.reduce((s, r) => s + r.vacancies, 0);

  useEffect(() => {
    if (recs.length > 0 && generatedList.length === 0) {
      generateFromRecs();
    }
  }, [recs]);

  const generateFromRecs = () => {
    const items: BulkTeacherItem[] = [];
    for (const rec of vacancyRecs) {
      for (let i = 0; i < rec.vacancies; i++) {
        const suffix = rec.vacancies === 1 ? "" : ` ${i + 1}`;
        items.push({
          firstName: rec.subjectName,
          lastName: `vakant${suffix}`,
          subjectId: rec.subjectId,
          subjectName: rec.subjectName,
          subjectColor: rec.subjectColor,
        });
      }
    }
    setGeneratedList(items);
  };

  const removeGenerated = (idx: number) => {
    setGeneratedList(p => p.filter((_, i) => i !== idx));
  };

  // Manual mode parsed items
  const manualParsed: BulkTeacherItem[] = [];
  const seen = new Set<string>();
  for (const line of manualText.split("\n").map(l => l.trim()).filter(Boolean)) {
    const parts = line.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    const key = `${firstName} ${lastName}`.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    manualParsed.push({ firstName, lastName });
  }

  const activeList = mode === "recommend" ? generatedList : manualParsed;

  const handleCreate = async () => {
    if (activeList.length === 0) {
      toast({ title: "Xatolik", description: "Ro'yxat bo'sh", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/teachers/bulk-save", {
        teachers: activeList.map(p => ({
          firstName: p.firstName,
          lastName: p.lastName,
          subjectId: p.subjectId,
          maxHoursPerWeek: maxHours
        }))
      });
      toast({ title: "Muvaffaqiyat", description: `${activeList.length} ta o'qituvchi qo'shildi va fanlariga biriktirildi` });
      setGeneratedList([]);
      setManualText("");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setGeneratedList([]); setManualText(""); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Ko'p o'qituvchi qo'shish
          </DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setMode("recommend")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "recommend" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Wand2 className="h-3.5 w-3.5" /> DTS tavsiyasi
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "manual" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Users className="h-3.5 w-3.5" /> Qo'lda kiritish
          </button>
        </div>

        <div className="space-y-4">
          {/* Max hours (shared) */}
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Max soat / hafta (har bir o'qituvchi uchun)</Label>
              <Input type="number" min={1} max={40} value={maxHours} onChange={e => setMaxHours(parseInt(e.target.value) || CURRICULUM_MAX_HOURS)} className="w-28 h-8 text-sm" />
            </div>
          </div>

          {/* RECOMMEND MODE */}
          {mode === "recommend" && (
            <div className="space-y-3">
              {recsLoading ? (
                <div className="space-y-2">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />)}
                </div>
              ) : vacancyRecs.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Barcha fanlar uchun o'qituvchilar yetarli</p>
                  <p className="text-xs text-gray-400 mt-1">Sinflar va fanlar biriktirilgandan so'ng tavsiyalar paydo bo'ladi</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 mb-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900">To'liq avtomatik taqsimlash</h4>
                      <p className="text-[10px] text-amber-700">Barcha vakant o'qituvchilarni yaratish va darslarga biriktirish.</p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        onClose();
                        autoGenerateMutation.mutate();
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs px-3"
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      Bajarish
                    </Button>
                  </div>
                  <div className="border border-amber-100 bg-amber-50 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-100 flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {vacancyRecs.length} ta fanda jami {totalVacancies} ta o'qituvchi vakant
                      </p>
                      <span className="text-xs text-amber-600">1 o'qituvchi = {maxHours} soat/hafta</span>
                    </div>
                    <div className="divide-y divide-amber-100 max-h-52 overflow-y-auto">
                      {vacancyRecs.map(rec => (
                        <div key={rec.subjectId} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: rec.subjectColor || "#3B82F6" }} />
                          <span className="text-sm font-medium text-gray-800 flex-1">{rec.subjectName}</span>
                          <span className="text-xs text-gray-500">{rec.classCount} sinf · {rec.totalWeeklyHours} soat/hafta</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Bor: <span className="font-semibold text-gray-700">{rec.existingTeachers}</span></span>
                            <ChevronRight className="h-3 w-3 text-gray-300" />
                            <span className="text-xs text-red-600">Kerak: <span className="font-bold">{rec.neededTeachers}</span></span>
                          </div>
                          <Badge variant="outline" className="text-xs border-red-200 text-red-700 bg-red-50">
                            +{rec.vacancies} vakant
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={generateFromRecs}
                    className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {totalVacancies} ta vakant o'qituvchi ro'yxatini yaratish
                  </Button>
                </>
              )}

              {/* Generated list preview */}
              {generatedList.length > 0 && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-emerald-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-800">{generatedList.length} ta o'qituvchi qo'shiladi:</p>
                    <button onClick={() => setGeneratedList([])} className="text-xs text-gray-400 hover:text-gray-600">Tozalash</button>
                  </div>
                  <div className="divide-y divide-emerald-100 max-h-44 overflow-y-auto">
                    {generatedList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.subjectColor || "#3B82F6" }} />
                        <span className="text-sm text-gray-800 flex-1">{item.firstName} {item.lastName}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.subjectName}</span>
                        <button onClick={() => removeGenerated(i)} className="text-gray-300 hover:text-red-400 ml-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL MODE */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">O'qituvchilar ro'yxati</Label>
                <textarea
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder={"Ona tili vakant\nMatematika vakant\nFizika vakant 1\nFizika vakant 2"}
                  rows={7}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-gray-400">Har bir qatorda bitta o'qituvchi: <span className="font-mono bg-gray-100 px-1 rounded">Fan nomi vakant</span></p>
              </div>
              {manualParsed.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-xs font-medium text-emerald-700 mb-2">{manualParsed.length} ta o'qituvchi:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {manualParsed.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-emerald-800">
                        <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                          {p.firstName[0]}
                        </div>
                        {p.firstName} {p.lastName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setGeneratedList([]); setManualText(""); onClose(); }}>Bekor qilish</Button>
          <Button
            onClick={handleCreate}
            disabled={loading || activeList.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Qo'shilmoqda..." : `${activeList.length} ta qo'shish`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
