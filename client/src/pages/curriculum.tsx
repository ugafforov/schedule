import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InlineEdit } from "@/components/ui/inline-edit";
import { BookOpen, Plus, Trash2, CheckCircle2, Copy, GraduationCap, AlertTriangle, XCircle, Info } from "lucide-react";
import type { CurriculumPlan, CurriculumEntry, Subject } from "@shared/schema";
import { UZBEK_CURRICULUM, RUSSIAN_CURRICULUM } from "@shared/curriculum";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function DtsAnalysis({ 
  grade, 
  gradeEntries, 
  language,
  planId
}: { 
  grade: number; 
  gradeEntries: CurriculumEntry[]; 
  language: "uz" | "ru"; 
  planId: number;
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const std = language === "ru" ? RUSSIAN_CURRICULUM : UZBEK_CURRICULUM;
  const gradeKey = grade.toString();
  const standardCurriculum = std[gradeKey] || {};

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/curriculum/plans/${planId}/entries/reset-grade`, { grade });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum/plans", planId, "entries"] });
      toast({ title: "Muvaffaqiyat", description: `${grade}-sinf o'quv rejasi DTS bo'yicha tiklandi` });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  });

  const normalize = (name: string) => {
    return name.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[()]/g, '')
      .replace("science", "")
      .trim();
  };

  const isSameSubject = (name1: string, name2: string) => {
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    if (n1 === n2) return true;
    if (n1 === "informatika" && n2 === "informatika va axborot texnologiyalari") return true;
    if (n2 === "informatika" && n1 === "informatika va axborot texnologiyalari") return true;
    if (n1 === "tarix" && n2 === "tarixdan hikoyalar") return true;
    if (n2 === "tarix" && n1 === "tarixdan hikoyalar") return true;
    if (n1 === "science" && n2 === "tabiiy fanlar") return true;
    if (n2 === "science" && n1 === "tabiiy fanlar") return true;
    return false;
  };

  const deviations: {
    type: "missing" | "extra" | "hours_diff";
    subjectName: string;
    expectedHours?: number;
    actualHours?: number;
  }[] = [];

  const matchedStdKeys = new Set<string>();

  gradeEntries.forEach(entry => {
    let matchedKey: string | null = null;
    for (const stdKey of Object.keys(standardCurriculum)) {
      if (isSameSubject(stdKey, entry.subjectName)) {
        matchedKey = stdKey;
        break;
      }
    }

    if (matchedKey) {
      matchedStdKeys.add(matchedKey);
      const expected = standardCurriculum[matchedKey];
      if (entry.weeklyHours !== expected) {
        deviations.push({
          type: "hours_diff",
          subjectName: entry.subjectName,
          expectedHours: expected,
          actualHours: entry.weeklyHours
        });
      }
    } else {
      deviations.push({
        type: "extra",
        subjectName: entry.subjectName,
        actualHours: entry.weeklyHours
      });
    }
  });

  Object.keys(standardCurriculum).forEach(stdKey => {
    if (!matchedStdKeys.has(stdKey)) {
      deviations.push({
        type: "missing",
        subjectName: stdKey,
        expectedHours: standardCurriculum[stdKey]
      });
    }
  });

  if (deviations.length === 0) {
    return (
      <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-green-500 dark:text-green-400 flex items-center gap-1 px-1">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        DTS me'yorlariga to'liq mos keladi.
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2 border-t border-border/40 space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          DTS tahlili
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1.5 h-4.5 font-normal border-amber-500/30 text-amber-500 bg-amber-500/5">
            {deviations.length} ta tafovut
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowResetConfirm(true)}
            disabled={resetMutation.isPending}
            className="text-[9px] h-4.5 px-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
          >
            {resetMutation.isPending ? "..." : "DTS tiklash"}
          </Button>
        </div>
      </div>
      <div className="space-y-1 max-h-[130px] overflow-y-auto pr-1 scrollbar-thin">
        {deviations.map((dev, idx) => (
          <div 
            key={idx} 
            className={`text-[11px] leading-tight p-1.5 rounded flex items-start gap-1.5 ${
              dev.type === "missing" 
                ? "bg-destructive/10 text-destructive border border-destructive/20" 
                : dev.type === "hours_diff" 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                : "bg-muted/40 text-muted-foreground border border-border/30"
            }`}
          >
            {dev.type === "missing" && (
              <>
                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold">{dev.subjectName}</span> fan kiritilmagan. DTS bo'yicha <span className="font-semibold">{dev.expectedHours} soat</span> bo'lishi kerak.
                </div>
              </>
            )}
            {dev.type === "hours_diff" && (
              <>
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold">{dev.subjectName}</span> soati xato. DTSda <span className="font-semibold">{dev.expectedHours}s</span>, sizda <span className="font-semibold">{dev.actualHours}s</span> ({dev.actualHours! > dev.expectedHours! ? "ko'p" : "kam"}).
                </div>
              </>
            )}
            {dev.type === "extra" && (
              <>
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold">{dev.subjectName}</span> nostandart fan (<span className="font-semibold">{dev.actualHours} soat</span>).
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>DTS tiklashni tasdiqlash</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            {grade}-sinf o'quv rejasini DTS standartiga tiklamoqchimisiz? Amaldagi barcha fanlar o'chib, standart darslar qayta yuklanadi. Ushbu amalni ortga qaytarib bo'lmaydi.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Bekor qilish
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                resetMutation.mutate();
                setShowResetConfirm(false);
              }}
              disabled={resetMutation.isPending}
            >
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CurriculumPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [language, setLanguage] = useState<"uz" | "ru">("uz");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneYear, setCloneYear] = useState("");
  const [cloneOrderNumber, setCloneOrderNumber] = useState("");
  const [newEntryGrade, setNewEntryGrade] = useState<number | null>(null);
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryHours, setNewEntryHours] = useState("2");
  const [selectedGrade, setSelectedGrade] = useState<number | "all">("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{ id: number; name: string } | null>(null);

  const { data: plans = [] } = useQuery<CurriculumPlan[]>({
    queryKey: ["/api/curriculum/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/curriculum/plans")).json(),
  });

  const { data: dbSubjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => (await apiRequest("GET", "/api/subjects")).json(),
  });

  const activeDbSubjects = dbSubjects.filter((s) => s.isActive !== false);

  const languagePlans = plans.filter((p) => p.language === language).sort((a, b) => b.id - a.id);
  const activePlan = languagePlans.find((p) => p.isActive);

  const { data: entries = [] } = useQuery<CurriculumEntry[]>({
    queryKey: ["/api/curriculum/plans", activePlan?.id, "entries"],
    queryFn: async () => (await apiRequest("GET", `/api/curriculum/plans/${activePlan!.id}/entries`)).json(),
    enabled: !!activePlan,
  });

  const invalidateEntries = () =>
    qc.invalidateQueries({ queryKey: ["/api/curriculum/plans", activePlan?.id, "entries"] });

  const updateHours = useMutation({
    mutationFn: async ({ id, weeklyHours }: { id: number; weeklyHours: number }) =>
      apiRequest("PATCH", `/api/curriculum/entries/${id}`, { weeklyHours }),
    onSuccess: invalidateEntries,
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/curriculum/entries/${id}`),
    onSuccess: () => {
      invalidateEntries();
      toast({ title: "Fan o'chirildi" });
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!activePlan || newEntryGrade === null) return;
      return apiRequest("POST", "/api/curriculum/entries", {
        planId: activePlan.id,
        grade: newEntryGrade,
        subjectName: newEntryName,
        codes: [],
        keywords: [newEntryName.toLowerCase()],
        weeklyHours: parseFloat(newEntryHours) || 1,
      });
    },
    onSuccess: () => {
      invalidateEntries();
      setNewEntryGrade(null);
      setNewEntryName("");
      setNewEntryHours("2");
      toast({ title: "Fan qo'shildi" });
    },
  });

  const clonePlan = useMutation({
    mutationFn: async () => {
      if (!activePlan) return;
      return apiRequest("POST", `/api/curriculum/plans/${activePlan.id}/clone`, {
        year: cloneYear || activePlan.year,
        orderNumber: cloneOrderNumber || activePlan.orderNumber,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/curriculum/plans"] });
      setCloneOpen(false);
      setCloneYear("");
      setCloneOrderNumber("");
      toast({ title: "Yangi versiya yaratildi", description: "Uni tahrirlab, so'ng faollashtiring." });
    },
  });

  const activatePlan = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/curriculum/plans/${id}/activate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/curriculum/plans"] });
      toast({ title: "Plan faollashtirildi" });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            O'quv reja (DTS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Davlat ta'lim standarti bo'yicha sinf-fan-soat jadvalini boshqarish. Bu yerdagi ma'lumot
            "DTS bo'yicha avtomatik biriktirish" funksiyasi uchun manba hisoblanadi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={language === "uz" ? "default" : "outline"} onClick={() => setLanguage("uz")}>
            O'zbek tili
          </Button>
          <Button variant={language === "ru" ? "default" : "outline"} onClick={() => setLanguage("ru")}>
            Rus tili
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Planlar (versiyalar)</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCloneOpen(true)} disabled={!activePlan}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Yangi versiya (nusxalash)
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {languagePlans.length === 0 && (
            <p className="text-sm text-muted-foreground">Bu til uchun hali plan yaratilmagan.</p>
          )}
          {languagePlans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30"
            >
              <div className="text-sm">
                <span className="font-medium text-foreground">{plan.year}</span>
                {plan.orderNumber && <span className="text-muted-foreground ml-2">{plan.orderNumber}</span>}
              </div>
              {plan.isActive ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Faol
                </Badge>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => activatePlan.mutate(plan.id)}>
                  Faollashtirish
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {activePlan && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Faol plan: {activePlan.year} {activePlan.orderNumber}
            </h2>
          </div>

          {/* Sinf tanlash (Tabs-like navigation) */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Button
              size="sm"
              variant={selectedGrade === "all" ? "default" : "outline"}
              onClick={() => setSelectedGrade("all")}
              className="h-7 px-2.5 text-xs font-medium rounded-md"
            >
              Barchasi
            </Button>
            <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />
            {GRADES.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={selectedGrade === g ? "default" : "outline"}
                onClick={() => setSelectedGrade(g)}
                className="h-7 px-2 text-xs font-medium rounded-md"
              >
                {g}-sinf
              </Button>
            ))}
          </div>

          {/* Grid ko'rinishi */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {GRADES.filter((g) => selectedGrade === "all" || selectedGrade === g).map((grade) => {
              const gradeEntries = entries
                .filter((e) => e.grade === grade)
                .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
              const total = gradeEntries.reduce((sum, e) => sum + e.weeklyHours, 0);
              
              const filteredSuggestions = activeDbSubjects.filter(s => 
                s.name.toLowerCase().includes(newEntryName.toLowerCase())
              );
              const hasExactMatch = activeDbSubjects.some(s => 
                s.name.toLowerCase() === newEntryName.trim().toLowerCase()
              );

              return (
                <Card key={grade} className="p-3 border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="text-sm font-bold text-foreground">{grade}-sinf</h3>
                    <Badge variant="secondary" className="font-normal text-[11px] h-5 px-1.5 bg-muted-foreground/10 text-muted-foreground border-none">
                      {total} soat
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {gradeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/40 hover:bg-muted/30 transition-colors group"
                      >
                        <span className="flex-1 text-[13px] font-medium text-foreground break-words">{entry.subjectName}</span>
                        <InlineEdit
                          type="number"
                          min={0.5}
                          value={entry.weeklyHours}
                          onSave={async (v) => {
                            await updateHours.mutateAsync({ id: entry.id, weeklyHours: parseFloat(v) || 0 });
                          }}
                          className="w-10 text-right text-[13px] h-6 px-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground/60 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          onClick={() => {
                            setEntryToDelete({ id: entry.id, name: entry.subjectName });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <DtsAnalysis grade={grade} gradeEntries={gradeEntries} language={language} planId={activePlan!.id} />

                    {/* Add Entry Form inside the Card */}
                    {newEntryGrade === grade ? (
                      <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                        <div className="relative">
                          <Input
                            autoFocus
                            placeholder="Fan nomi"
                            value={newEntryName}
                            onChange={(e) => {
                              setNewEntryName(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="h-7 text-[13px]"
                          />
                          {showSuggestions && (filteredSuggestions.length > 0 || (!hasExactMatch && newEntryName.trim() !== "")) && (
                            <div className="absolute z-50 left-[102%] bottom-0 w-[240px] bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-[220px] overflow-y-auto p-1">
                              {filteredSuggestions.map((sub) => (
                                <div 
                                  key={sub.id} 
                                  className="px-2 py-1.5 text-sm hover:bg-muted/80 hover:text-accent-foreground cursor-pointer rounded-sm break-words"
                                  onClick={() => {
                                    setNewEntryName(sub.name);
                                    setShowSuggestions(false);
                                  }}
                                >
                                  {sub.name}
                                </div>
                              ))}
                              {!hasExactMatch && newEntryName.trim() !== "" && (
                                <div 
                                  className={`px-2 py-1.5 text-[13px] text-primary hover:bg-primary/10 cursor-pointer rounded-sm font-medium flex items-center gap-1.5 ${filteredSuggestions.length > 0 ? "border-t border-border mt-1 pt-1.5" : ""}`}
                                  onClick={() => {
                                    setShowSuggestions(false);
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5 shrink-0" />
                                  <span className="break-words">Yangi fan: "{newEntryName}"</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={newEntryHours}
                            onChange={(e) => setNewEntryHours(e.target.value)}
                            className="h-7 w-14 text-[13px] px-2"
                          />
                          <Button size="sm" className="h-7 text-xs flex-1 px-2" onClick={() => addEntry.mutate()} disabled={!newEntryName.trim()}>
                            Saqlash
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => setNewEntryGrade(null)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-7 mt-2 text-xs text-muted-foreground hover:bg-muted/50 border border-dashed border-border/50"
                        onClick={() => {
                          setNewEntryGrade(grade);
                          setNewEntryName("");
                          setNewEntryHours("2");
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Fan qo'shish
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={cloneOpen} onOpenChange={(v) => !v && setCloneOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi versiya yaratish</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Joriy faol plandagi barcha fanlar yangi versiyaga nusxalanadi — keyin uni tahrirlab,
            faollashtirasiz. DTS yangilanganda kod o'zgartirish shart emas.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">O'quv yili</Label>
              <Input
                placeholder={activePlan?.year || "2026-2027"}
                value={cloneYear}
                onChange={(e) => setCloneYear(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Buyruq raqami</Label>
              <Input
                placeholder={activePlan?.orderNumber || ""}
                value={cloneOrderNumber}
                onChange={(e) => setCloneOrderNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => clonePlan.mutate()}>Nusxalash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!entryToDelete} onOpenChange={(v) => !v && setEntryToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Fanni o'chirishni tasdiqlash
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-foreground">
            <span className="font-semibold text-destructive">"{entryToDelete?.name}"</span> fanini o'quv rejadan o'chirmoqchimisiz?
            <p className="text-xs text-muted-foreground mt-2">
              Ushbu amalni ortga qaytarib bo'lmaydi. Fan o'chirilgach, dars soatlari ham plandan olib tashlanadi.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEntryToDelete(null)}>
              Bekor qilish
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (entryToDelete) {
                  deleteEntry.mutate(entryToDelete.id);
                  setEntryToDelete(null);
                }
              }}
            >
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
