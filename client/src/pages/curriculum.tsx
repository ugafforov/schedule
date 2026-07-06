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
import { BookOpen, Plus, Trash2, CheckCircle2, Copy, GraduationCap } from "lucide-react";
import type { CurriculumPlan, CurriculumEntry } from "@shared/schema";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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

  const { data: plans = [] } = useQuery<CurriculumPlan[]>({
    queryKey: ["/api/curriculum/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/curriculum/plans")).json(),
  });

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Faol plan: {activePlan.year} {activePlan.orderNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {GRADES.map((grade) => {
              const gradeEntries = entries
                .filter((e) => e.grade === grade)
                .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
              const total = gradeEntries.reduce((sum, e) => sum + e.weeklyHours, 0);
              return (
                <div key={grade}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{grade}-sinf</h3>
                    <Badge variant="outline">{total} soat/hafta</Badge>
                  </div>
                  <div className="space-y-1">
                    {gradeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-border/60 bg-card"
                      >
                        <span className="flex-1 text-sm text-foreground truncate">{entry.subjectName}</span>
                        <InlineEdit
                          type="number"
                          min={0.5}
                          value={entry.weeklyHours}
                          onSave={async (v) => {
                            await updateHours.mutateAsync({ id: entry.id, weeklyHours: parseFloat(v) || 0 });
                          }}
                          className="w-16 text-right"
                        />
                        <span className="text-xs text-muted-foreground">soat</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteEntry.mutate(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {newEntryGrade === grade ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5">
                        <Input
                          autoFocus
                          placeholder="Fan nomi"
                          value={newEntryName}
                          onChange={(e) => setNewEntryName(e.target.value)}
                          className="h-8 flex-1"
                        />
                        <Input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={newEntryHours}
                          onChange={(e) => setNewEntryHours(e.target.value)}
                          className="h-8 w-20"
                        />
                        <Button size="sm" onClick={() => addEntry.mutate()} disabled={!newEntryName.trim()}>
                          Saqlash
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setNewEntryGrade(null)}>
                          Bekor qilish
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          setNewEntryGrade(grade);
                          setNewEntryName("");
                          setNewEntryHours("2");
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Fan qo'shish
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
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
    </div>
  );
}
