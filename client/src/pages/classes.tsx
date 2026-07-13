import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, GraduationCap, Users, X, BookOpen, ChevronRight, Zap, CheckSquare, Square, LayoutGrid, List, FileSpreadsheet, Calendar } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, Room } from "@shared/schema";
import { ExcelImportDialog } from "@/components/bulk/excel-import-dialog";
import { InlineEdit, InlineSelect } from "@/components/ui/inline-edit";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface SubjectAssignment { subjectId: number; teacherId: number | null; teacherId2: number | null; weeklyHours: number; }
interface ClassFormData { name: string; grade: string; section: string; language: string; totalStudents: number; studyDays: string; defaultRoomId: number | null; classTeacherId: number | null; subjects: SubjectAssignment[]; }

const EMPTY_FORM: ClassFormData = { name: "", grade: "", section: "", language: "uz", totalStudents: 25, studyDays: "1,2,3,4,5", defaultRoomId: null, classTeacherId: null, subjects: [] };
const GRADE_COLORS = [
  "bg-blue-500/10 text-blue-700 dark:text-blue-400", "bg-green-500/10 text-green-700 dark:text-green-400", "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  "bg-orange-500/10 text-orange-700 dark:text-orange-400", "bg-pink-500/10 text-pink-700 dark:text-pink-400", "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  "bg-red-500/10 text-red-700 dark:text-red-400", "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
];
const ALL_GRADES = ["1","2","3","4","5","6","7","8","9","10","11"];

function ClearAllDialog({ open, title, onClose, onConfirm }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>O'chirishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>O'chirish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Bulk add dialog ─────────────────────────────────────────────────────── */
function BulkAddDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [selectedGrades, setSelectedGrades] = useState<string[]>(["1","2","3","4","5","6","7","8","9","10","11"]);
  const [sections, setSections] = useState("A, B");
  const [language, setLanguage] = useState("uz");
  const [totalStudents, setTotalStudents] = useState(25);
  const [loading, setLoading] = useState(false);

  const parsedSections = sections.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const preview = selectedGrades.flatMap(g => parsedSections.map(s => `${g}-${s}`));

  const toggleGrade = (g: string) =>
    setSelectedGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a,b)=>parseInt(a)-parseInt(b)));

  const handleCreate = async () => {
    if (preview.length === 0) { toast({ title: "Xatolik", description: "Hech bo'lmasa bitta sinf tanlang", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const dbClasses = selectedGrades.flatMap(grade => parsedSections.map(section => ({ 
        grade, 
        section, 
        language,
        name: `${grade}-${section}`,
        total_students: totalStudents,
        is_active: true 
      })));
      await apiRequest("POST", "/api/classes/bulk", { classes: dbClasses.map(c => ({ grade: c.grade, section: c.section, language: c.language, totalStudents: c.total_students })) });
      toast({ title: "Muvaffaqiyat", description: `${dbClasses.length} ta sinf yaratildi` });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Tez sinf yaratish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-1">
          {/* Language selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">Ta'lim tili</Label>
            <div className="flex gap-2">
              <Button variant={language === "uz" ? "default" : "outline"} size="sm" onClick={() => setLanguage("uz")} className="flex-1">O'zbekcha</Button>
              <Button variant={language === "ru" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ru")} className="flex-1">Ruscha</Button>
            </div>
          </div>
          {/* Grade selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sinflar (sinf raqamlarini tanlang)</Label>
              <div className="flex gap-1">
                <button onClick={() => setSelectedGrades([...ALL_GRADES])} className="text-xs text-blue-600 hover:underline">Hammasi</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setSelectedGrades([])} className="text-xs text-muted-foreground hover:underline">Tozalash</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_GRADES.map(g => {
                const sel = selectedGrades.includes(g);
                return (
                  <button key={g} onClick={() => toggleGrade(g)}
                    className={`w-12 h-10 rounded-lg border-2 text-sm font-bold transition-all ${
                      sel ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" : "border-border text-muted-foreground hover:border-border"
                    }`}>{g}</button>
                );
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-1.5">
            <Label className="text-sm">Guruhlar (vergul bilan ajratilgan)</Label>
            <Input placeholder="A, B, C" value={sections} onChange={e => setSections(e.target.value)} />
            <p className="text-xs text-muted-foreground">Masalan: A, B yoki A, B, C, D</p>
          </div>

          {/* Students count */}
          <div className="space-y-1.5">
            <Label className="text-sm">O'quvchilar soni (har bir sinf uchun)</Label>
            <Input type="number" min={1} max={50} value={totalStudents} onChange={e => setTotalStudents(parseInt(e.target.value) || 25)} className="w-32" />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ko'rinish — <span className="text-blue-600 font-semibold">{preview.length} ta sinf</span> yaratiladi:</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-3 bg-muted/50 rounded-xl border border-border">
                {preview.map(name => (
                  <span key={name} className="px-2 py-0.5 bg-card border border-border rounded-md text-xs font-medium text-foreground">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleCreate} disabled={loading || preview.length === 0} className="bg-primary hover:bg-primary/90">
            {loading ? "Yaratilmoqda..." : `${preview.length} ta sinf yaratish`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Classes() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [form, setForm] = useState<ClassFormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<"info" | "subjects">("info");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classes = [], isLoading } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/classes");
      const data = await res.json();
      return (data as any[]).sort((a, b) => {
        const ga = parseInt(a.grade) || 0;
        const gb = parseInt(b.grade) || 0;
        if (ga !== gb) return ga - gb;
        return (a.section || "").localeCompare(b.section || "");
      });
    }
  });
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers"],
  });
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = editing ? "PATCH" : "POST";
      const url = editing ? `/api/classes/${editing.id}` : "/api/classes";
      await apiRequest(method, url, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      setOpen(false); setEditing(null); setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "Sinf yangilandi" : "Sinf qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/classes/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/classes"] }); toast({ title: "Muvaffaqiyat", description: "Sinf o'chirildi" }); },
  });
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/classes/clear-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Muvaffaqiyat", description: "Barcha sinflar tozalandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  // Inline update mutation
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Class> }) => {
      await apiRequest("PATCH", `/api/classes/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Saqlanmadi", variant: "destructive" }),
  });

  const bulkUpdateStudyDaysMutation = useMutation({
    mutationFn: async ({ classIds, studyDays }: { classIds: number[]; studyDays: string }) => {
      await apiRequest("POST", "/api/classes/bulk-update-study-days", { classIds, studyDays });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Muvaffaqiyat", description: "Sinflarning dars kunlari yangilandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Saqlanmadi", variant: "destructive" }),
  });

  const handleBulkStudyDaysUpdate = (filter: "primary" | "high" | "all", studyDays: string) => {
    let targetIds: number[] = [];
    if (filter === "primary") {
      targetIds = classes.filter(c => parseInt(c.grade) >= 1 && parseInt(c.grade) <= 4).map(c => c.id);
    } else if (filter === "high") {
      targetIds = classes.filter(c => parseInt(c.grade) >= 5 && parseInt(c.grade) <= 11).map(c => c.id);
    } else {
      targetIds = classes.map(c => c.id);
    }

    if (targetIds.length === 0) {
      toast({ title: "Ma'lumot", description: "Tegishli sinflar topilmadi" });
      return;
    }
    bulkUpdateStudyDaysMutation.mutate({ classIds: targetIds, studyDays });
  };

  // Grade options for inline select
  const gradeOptions = ALL_GRADES.map(grade => ({
    value: grade,
    label: `${grade}-sinf`,
  }));

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setActiveTab("info"); setOpen(true); };
  const openEdit = async (cls: Class) => {
    setEditing(cls);
    let subs: SubjectAssignment[] = [];
    try {
      const res = await apiRequest("GET", `/api/classes/${cls.id}/subjects`);
      if (res.ok) {
        const data = await res.json();
        subs = data.map((cs: any) => ({ subjectId: cs.subjectId, teacherId: cs.teacherId, teacherId2: cs.teacherId2 || null, weeklyHours: cs.weeklyHours }));
      }
    } catch (e) {
      console.error("Error fetching class subjects:", e);
    }
    setForm({ name: cls.name || "", grade: cls.grade || "", section: cls.section || "", language: (cls as any).language || "uz", totalStudents: cls.totalStudents || 25, studyDays: (cls as any).studyDays || "1,2,3,4,5", defaultRoomId: cls.defaultRoomId || null, classTeacherId: (cls as any).classTeacherId || null, subjects: subs });
    setActiveTab("info"); setOpen(true);
  };

  const addSubject = (subjectId: number) => {
    if (form.subjects.find(s => s.subjectId === subjectId)) return;
    const sub = subjects.find(s => s.id === subjectId);
    setForm(p => ({ ...p, subjects: [...p.subjects, { subjectId, teacherId: null, teacherId2: null, weeklyHours: sub?.weeklyHours || 2 }] }));
  };
  const removeSubject = (subjectId: number) => setForm(p => ({ ...p, subjects: p.subjects.filter(s => s.subjectId !== subjectId) }));
  const updateSubjectField = (subjectId: number, field: "teacherId" | "teacherId2" | "weeklyHours", value: any) =>
    setForm(p => ({ ...p, subjects: p.subjects.map(s => s.subjectId === subjectId ? { ...s, [field]: value } : s) }));

  const filtered = classes.filter(c => `${c.name} ${c.grade} ${c.section}`.toLowerCase().includes(search.toLowerCase()));
  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name || "?";
  const unassignedSubjects = subjects.filter(s => !form.subjects.find(fs => fs.subjectId === s.id));

  const isPrimaryGradeForm = (() => { const g = parseInt(form.grade); return g >= 1 && g <= 4; })();
  // Bir o'qituvchi faqat bitta sinfga rahbar bo'la oladi — boshqa sinfga rahbar bo'lganlar ro'yxatdan chiqariladi
  const takenClassTeacherIds = new Set(
    classes.filter(c => (c as any).classTeacherId && c.id !== editing?.id).map(c => (c as any).classTeacherId as number),
  );
  const availableTeachers = teachers.filter(t => !takenClassTeacherIds.has(t.id));
  // 1-4 sinf uchun boshlang'ich o'qituvchilar ro'yxat boshida (qattiq cheklov emas — admin istalganini tanlashi mumkin)
  const classTeacherOptions = isPrimaryGradeForm
    ? [...availableTeachers].sort((a, b) => {
        const ap = String((a as any).gradeLevel || "").includes("primary") ? 0 : 1;
        const bp = String((b as any).gradeLevel || "").includes("primary") ? 0 : 1;
        return ap - bp || a.id - b.id;
      })
    : availableTeachers;
  const classTeacherName = (id: number | null | undefined) => {
    if (!id) return null;
    const t = teachers.find(x => x.id === id);
    return t ? `${t.firstName} ${t.lastName}`.trim() || t.employeeId : null;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sinflar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sinflar va ularga biriktirilgan fanlarni boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => classes.length > 0 && setClearOpen(true)}
            disabled={clearAllMutation.isPending || classes.length === 0}
            className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Barchasini tozalash
          </Button>
          <Button variant="outline" onClick={() => setExcelImportOpen(true)} className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel Import
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30">
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            Tez yaratish
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10">
                <Calendar className="mr-2 h-4 w-4 text-indigo-500" /> O'quv kunlari (Tezkor)
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-card border border-border shadow-md rounded-lg p-1 text-card-foreground">
              <DropdownMenuItem onClick={() => handleBulkStudyDaysUpdate("primary", "1,2,3,4,5")} className="text-xs py-2 cursor-pointer hover:bg-muted rounded-md">
                Boshlang'ich (1-4) sinflarni 5 kunlik qilish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStudyDaysUpdate("high", "1,2,3,4,5,6")} className="text-xs py-2 cursor-pointer hover:bg-muted rounded-md">
                Yuqori (5-11) sinflarni 6 kunlik qilish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStudyDaysUpdate("all", "1,2,3,4,5,6")} className="text-xs py-2 cursor-pointer hover:bg-muted rounded-md">
                Barcha sinflarni 6 kunlik qilish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStudyDaysUpdate("all", "1,2,3,4,5")} className="text-xs py-2 cursor-pointer hover:bg-muted rounded-md">
                Barcha sinflarni 5 kunlik qilish
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Sinf qo'shish
          </Button>
        </div>
      </div>

      <Card className="border border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <GraduationCap className="mr-2 h-4 w-4 text-primary" />
              Sinflar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs bg-muted text-foreground">{classes.length} ta</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4 w-4" />
                <Input placeholder="Sinf nomini qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-lg">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("grid")} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} aria-label="List view">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "space-y-3"}>
              {Array(10).fill(0).map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((cls, idx) => {
                const [bg, text] = GRADE_COLORS[idx % GRADE_COLORS.length].split(" ");
                return (
                  <div key={cls.id} className="group border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center`}>
                        <span className={`font-bold text-lg ${text}`}>{cls.grade || cls.name?.[0] || "?"}</span>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground" onClick={() => openEdit(cls)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => setDeleteId(cls.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-foreground text-lg">{cls.name}</h3>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 uppercase bg-muted text-muted-foreground border-border">
                        {(cls as any).language || "uz"}
                      </Badge>
                    </div>
                    {classTeacherName((cls as any).classTeacherId) && (
                      <p className="text-xs text-muted-foreground mt-1 truncate" title="Sinf rahbari">
                        Rahbar: {classTeacherName((cls as any).classTeacherId)}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
                      <div className="flex items-center space-x-1 text-muted-foreground/60">
                        <Users className="h-3.5 w-3.5" /><span className="text-xs">{cls.totalStudents} o'quvchi</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          const is6 = (cls as any).studyDays?.includes("6");
                          inlineUpdateMutation.mutate({ id: cls.id, data: { studyDays: is6 ? "1,2,3,4,5" : "1,2,3,4,5,6" } });
                        }}
                        className={`text-[9px] px-1.5 py-0 h-4.5 cursor-pointer font-semibold transition-all select-none ${
                          (cls as any).studyDays?.includes("6") 
                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20" 
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                        }`}
                        title="Dars kunlarini o'zgartirish uchun bosing"
                      >
                        {(cls as any).studyDays?.includes("6") ? "6 kunlik" : "5 kunlik"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.6fr)_90px_110px_100px_80px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 rounded-xl border border-border">
                  <div>Sinf</div>
                  <div>Raqam</div>
                  <div>Kunlar</div>
                  <div>O'quvchi</div>
                  <div className="text-right">Amal</div>
                </div>
                {filtered.map((cls, idx) => {
                  const [bg, text] = GRADE_COLORS[idx % GRADE_COLORS.length].split(" ");
                  const isUpdating = inlineUpdateMutation.isPending;
                  return (
                    <div key={cls.id} className="grid grid-cols-[minmax(0,1.6fr)_90px_110px_100px_80px] gap-4 items-center p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <span className={`font-bold text-lg ${text}`}>{cls.grade || cls.name?.[0] || "?"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <InlineEdit
                              value={cls.name}
                              onSave={(name) => inlineUpdateMutation.mutateAsync({ id: cls.id, data: { name } })}
                              placeholder="Sinf nomi"
                              className="font-semibold text-foreground text-sm"
                              disabled={isUpdating}
                            />
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 uppercase bg-muted text-muted-foreground border-border">
                              {(cls as any).language || "uz"}
                            </Badge>
                          </div>
                          <InlineEdit
                            value={cls.section || ""}
                            onSave={(section) => inlineUpdateMutation.mutateAsync({ id: cls.id, data: { section } })}
                            placeholder="Guruh"
                            className="text-xs text-muted-foreground/60"
                            disabled={isUpdating}
                          />
                          {classTeacherName((cls as any).classTeacherId) && (
                            <p className="text-xs text-muted-foreground truncate" title="Sinf rahbari">
                              Rahbar: {classTeacherName((cls as any).classTeacherId)}
                            </p>
                          )}
                        </div>
                      </div>
                      <InlineSelect
                        value={cls.grade || ""}
                        options={gradeOptions}
                        onSave={(grade) => inlineUpdateMutation.mutateAsync({ id: cls.id, data: { grade } })}
                        className="text-sm text-foreground"
                        disabled={isUpdating}
                      />
                      <div className="text-sm">
                        <Badge 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const is6 = (cls as any).studyDays?.includes("6");
                            inlineUpdateMutation.mutate({ id: cls.id, data: { studyDays: is6 ? "1,2,3,4,5" : "1,2,3,4,5,6" } });
                          }}
                          className={`text-[9px] px-1.5 py-0.5 h-5 cursor-pointer font-semibold transition-all select-none ${
                            (cls as any).studyDays?.includes("6") 
                              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20" 
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                          }`}
                          title="Dars kunlarini o'zgartirish uchun bosing"
                        >
                          {(cls as any).studyDays?.includes("6") ? "6 kun (Du-Sh)" : "5 kun (Du-Ju)"}
                        </Badge>
                      </div>
                      <div className="text-sm text-foreground whitespace-nowrap">
                        <InlineEdit
                          value={cls.totalStudents || 25}
                          onSave={(val: string) => inlineUpdateMutation.mutateAsync({ id: cls.id, data: { totalStudents: parseInt(val) || 25 } })}
                          type="number"
                          min={5}
                          max={50}
                          placeholder="25"
                          className="inline-block w-16"
                          disabled={isUpdating}
                        />
                        <span className="ml-1 text-muted-foreground/60">o'quvchi</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/60 hover:text-foreground" onClick={() => openEdit(cls)} title="Batafsil tahrirlash"><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteId(cls.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "Sinflar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Tez yaratish (1-11 sinflar)
                  </Button>
                  <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" /> Bitta sinf qo'shish
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single add/edit dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sinfni tahrirlash" : "Yangi sinf qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="flex space-x-1 border-b border-border mb-4">
            {(["info", "subjects"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-muted-foreground hover:text-foreground"}`}>
                {tab === "info" ? "Asosiy ma'lumot" : `Fanlar (${form.subjects.length})`}
              </button>
            ))}
          </div>
          {activeTab === "info" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sinf nomi *</Label>
                  <Input className="h-9" placeholder="Masalan: 9-A" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ta'lim tili</Label>
                  <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Til" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uz">O'zbek tili</SelectItem>
                      <SelectItem value="ru">Rus tili</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sinf raqami</Label>
                  <Input className="h-9" placeholder="9" value={form.grade} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Guruh</Label>
                  <Input className="h-9" placeholder="A" value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">O'quvchilar</Label>
                  <Input className="h-9" type="number" min={1} max={50} value={form.totalStudents} onChange={e => setForm(p => ({ ...p, totalStudents: parseInt(e.target.value) || 25 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">O'quv kunlari</Label>
                  <Select value={form.studyDays} onValueChange={v => setForm(p => ({ ...p, studyDays: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Kunlar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1,2,3,4,5">5 kunlik (Du - Ju)</SelectItem>
                      <SelectItem value="1,2,3,4,5,6">6 kunlik (Du - Sh)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Asosiy xona</Label>
                  <Select value={form.defaultRoomId ? String(form.defaultRoomId) : "none"} onValueChange={v => setForm(p => ({ ...p, defaultRoomId: v === "none" ? null : parseInt(v) }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Xona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><span className="text-muted-foreground/60">Xona yo'q</span></SelectItem>
                      {rooms.map(r => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name} ({r.roomNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sinf rahbari</Label>
                <Select value={form.classTeacherId ? String(form.classTeacherId) : "none"} onValueChange={v => setForm(p => ({ ...p, classTeacherId: v === "none" ? null : parseInt(v) }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sinf rahbarini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground/60">Sinf rahbari yo'q</span></SelectItem>
                    {classTeacherOptions.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {`${t.firstName} ${t.lastName}`.trim() || t.employeeId}
                        {isPrimaryGradeForm && String((t as any).gradeLevel || "").includes("primary") ? " · boshlang'ich" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isPrimaryGradeForm && (
                  <p className="text-xs text-muted-foreground">Bo'sh qoldirilsa, avtomatik taqsimlashda belgilanadi.</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("subjects")} className="w-full h-8 text-xs">
                Fanlarni belgilash <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {activeTab === "subjects" && (
            <div className="space-y-3">
              {unassignedSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Fan qo'shish</Label>
                  <Select onValueChange={v => addSubject(parseInt(v))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Fan tanlang..." /></SelectTrigger>
                    <SelectContent>{unassignedSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.subjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Hali fan qo'shilmagan</p></div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {form.subjects.map(sa => (
                    <div key={sa.subjectId} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjects.find(s => s.id === sa.subjectId)?.color || "#3B82F6" }} />
                          <span className="text-sm font-medium text-foreground">{subjectName(sa.subjectId)}</span>
                        </div>
                        <button onClick={() => removeSubject(sa.subjectId)} className="text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_60px] gap-2 items-start">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">1-O'qituvchi</label>
                          <Select value={sa.teacherId ? String(sa.teacherId) : "none"}
                            onValueChange={v => updateSubjectField(sa.subjectId, "teacherId", v === "none" ? null : parseInt(v))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Tanlanmagan —</SelectItem>
                              {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{`${t.firstName} ${t.lastName}`.trim() || t.employeeId}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">2-O'qituvchi (Guruh)</label>
                          <Select value={sa.teacherId2 ? String(sa.teacherId2) : "none"}
                            onValueChange={v => updateSubjectField(sa.subjectId, "teacherId2", v === "none" ? null : parseInt(v))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Tanlanmagan —</SelectItem>
                              {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{`${t.firstName} ${t.lastName}`.trim() || t.employeeId}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Soat</label>
                          <Input type="number" min={1} max={8} value={sa.weeklyHours}
                            onChange={e => updateSubjectField(sa.subjectId, "weeklyHours", parseInt(e.target.value) || 2)} className="h-8 text-xs px-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.subjects.length > 0 && (
                <div className="text-xs text-muted-foreground border-t border-border pt-2">
                  Jami: <span className="font-semibold text-foreground">{form.subjects.reduce((s, x) => s + x.weeklyHours, 0)}</span> soat/hafta
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name && !form.grade) { toast({ title: "Xatolik", description: "Sinf nomi kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-primary hover:bg-primary/90">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/classes"] })} />

      <ClearAllDialog
        open={clearOpen}
        title="Barcha sinflar o'chirilsinmi?"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          clearAllMutation.mutate();
        }}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        title="Sinf o'chiriladi. Davom etasizmi?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
      />

      <ExcelImportDialog
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        type="classes"
      />
    </div>
  );
}
