import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, GraduationCap, Users, X, BookOpen, ChevronRight, Zap, CheckSquare, Square, LayoutGrid, List } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher } from "@shared/schema";

interface SubjectAssignment { subjectId: number; teacherId: number | null; weeklyHours: number; }
interface ClassFormData { name: string; grade: string; section: string; totalStudents: number; subjects: SubjectAssignment[]; }

const EMPTY_FORM: ClassFormData = { name: "", grade: "", section: "", totalStudents: 25, subjects: [] };
const GRADE_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700",
  "bg-red-100 text-red-700", "bg-yellow-100 text-yellow-700",
];
const ALL_GRADES = ["1","2","3","4","5","6","7","8","9","10","11"];

function DeleteConfirmDialog({ open, title, onCancel, onConfirm }: { open: boolean; title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>O'chirishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Bekor qilish</Button>
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
      const classes = selectedGrades.flatMap(grade => parsedSections.map(section => ({ grade, section, totalStudents })));
      await apiRequest("POST", "/api/classes/bulk", { classes });
      toast({ title: "Muvaffaqiyat", description: `${classes.length} ta sinf yaratildi` });
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
          {/* Grade selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sinflar (sinf raqamlarini tanlang)</Label>
              <div className="flex gap-1">
                <button onClick={() => setSelectedGrades([...ALL_GRADES])} className="text-xs text-blue-600 hover:underline">Hammasi</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setSelectedGrades([])} className="text-xs text-gray-500 hover:underline">Tozalash</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_GRADES.map(g => {
                const sel = selectedGrades.includes(g);
                return (
                  <button key={g} onClick={() => toggleGrade(g)}
                    className={`w-12 h-10 rounded-lg border-2 text-sm font-bold transition-all ${
                      sel ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}>{g}</button>
                );
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-1.5">
            <Label className="text-sm">Guruhlar (vergul bilan ajratilgan)</Label>
            <Input placeholder="A, B, C" value={sections} onChange={e => setSections(e.target.value)} />
            <p className="text-xs text-gray-400">Masalan: A, B yoki A, B, C, D</p>
          </div>

          {/* Students count */}
          <div className="space-y-1.5">
            <Label className="text-sm">O'quvchilar soni (har bir sinf uchun)</Label>
            <Input type="number" min={1} max={50} value={totalStudents} onChange={e => setTotalStudents(parseInt(e.target.value) || 25)} className="w-32" />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Ko'rinish — <span className="text-blue-600 font-semibold">{preview.length} ta sinf</span> yaratiladi:</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-100">
                {preview.map(name => (
                  <span key={name} className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleCreate} disabled={loading || preview.length === 0} className="bg-blue-600 hover:bg-blue-700">
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
  const [editing, setEditing] = useState<Class | null>(null);
  const [form, setForm] = useState<ClassFormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<"info" | "subjects">("info");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classes = [], isLoading } = useQuery<Class[]>({ queryKey: ["/api/classes"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: teachers = [] } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const payload = { ...data, subjects: data.subjects };
      if (editing) await apiRequest("PATCH", `/api/classes/${editing.id}`, payload);
      else await apiRequest("POST", "/api/classes", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      setOpen(false); setEditing(null); setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "Sinf yangilandi" : "Sinf qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/classes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/classes"] }); toast({ title: "Muvaffaqiyat", description: "Sinf o'chirildi" }); },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setActiveTab("info"); setOpen(true); };
  const openEdit = async (cls: Class) => {
    setEditing(cls);
    let subs: SubjectAssignment[] = [];
    try {
      const r = await fetch(`/api/classes/${cls.id}/subjects`, { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` } });
      if (r.ok) subs = (await r.json()).map((cs: any) => ({ subjectId: cs.subjectId, teacherId: cs.teacherId, weeklyHours: cs.weeklyHours }));
    } catch {}
    setForm({ name: cls.name || "", grade: cls.grade || "", section: cls.section || "", totalStudents: cls.totalStudents || 25, subjects: subs });
    setActiveTab("info"); setOpen(true);
  };

  const addSubject = (subjectId: number) => {
    if (form.subjects.find(s => s.subjectId === subjectId)) return;
    const sub = subjects.find(s => s.id === subjectId);
    setForm(p => ({ ...p, subjects: [...p.subjects, { subjectId, teacherId: null, weeklyHours: sub?.weeklyHours || 2 }] }));
  };
  const removeSubject = (subjectId: number) => setForm(p => ({ ...p, subjects: p.subjects.filter(s => s.subjectId !== subjectId) }));
  const updateSubjectField = (subjectId: number, field: "teacherId" | "weeklyHours", value: any) =>
    setForm(p => ({ ...p, subjects: p.subjects.map(s => s.subjectId === subjectId ? { ...s, [field]: value } : s) }));

  const filtered = classes.filter(c => `${c.name} ${c.grade} ${c.section}`.toLowerCase().includes(search.toLowerCase()));
  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name || "?";
  const unassignedSubjects = subjects.filter(s => !form.subjects.find(fs => fs.subjectId === s.id));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sinflar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Sinflar va ularga biriktirilgan fanlarni boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300">
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            Tez yaratish
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Sinf qo'shish
          </Button>
        </div>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <GraduationCap className="mr-2 h-4 w-4 text-blue-600" />
              Sinflar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{classes.length} ta</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Sinf nomini qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`} onClick={() => setViewMode("grid")} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`} onClick={() => setViewMode("list")} aria-label="List view">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "space-y-3"}>
              {Array(10).fill(0).map((_, i) => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((cls, idx) => {
                const [bg, text] = GRADE_COLORS[idx % GRADE_COLORS.length].split(" ");
                return (
                  <div key={cls.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center`}>
                        <span className={`font-bold text-lg ${text}`}>{cls.grade || cls.name?.[0] || "?"}</span>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(cls)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(cls.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{cls.name}</h3>
                    <div className="flex items-center space-x-1 mt-1 text-gray-400">
                      <Users className="h-3 w-3" /><span className="text-xs">{cls.totalStudents} o'quvchi</span>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.6fr)_120px_120px_110px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  <div>Sinf</div>
                  <div>Raqam</div>
                  <div>O'quvchi</div>
                  <div className="text-right">Amal</div>
                </div>
                {filtered.map((cls, idx) => {
                  const [bg, text] = GRADE_COLORS[idx % GRADE_COLORS.length].split(" ");
                  return (
                    <div key={cls.id} className="grid grid-cols-[minmax(0,1.6fr)_120px_120px_110px] gap-4 items-center p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <span className={`font-bold text-lg ${text}`}>{cls.grade || cls.name?.[0] || "?"}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{cls.name}</h3>
                          <p className="text-xs text-gray-400 truncate">Guruh: {cls.section || "—"}</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 truncate">{cls.grade || "—"}</div>
                      <div className="text-sm text-gray-600 whitespace-nowrap">{cls.totalStudents} o'quvchi</div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(cls)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(cls.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "Sinflar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Tez yaratish (1-11 sinflar)
                  </Button>
                  <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sinfni tahrirlash" : "Yangi sinf qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="flex space-x-1 border-b border-gray-100 mb-4">
            {(["info", "subjects"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                {tab === "info" ? "Asosiy ma'lumot" : `Fanlar (${form.subjects.length})`}
              </button>
            ))}
          </div>
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Sinf nomi *</Label>
                <Input placeholder="Masalan: 9-A" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Sinf raqami</Label>
                  <Input placeholder="9" value={form.grade} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Guruh</Label>
                  <Input placeholder="A" value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">O'quvchilar soni</Label>
                <Input type="number" min={1} max={50} value={form.totalStudents} onChange={e => setForm(p => ({ ...p, totalStudents: parseInt(e.target.value) || 25 }))} />
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("subjects")} className="w-full">
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
                <div className="text-center py-8 text-gray-400"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Hali fan qo'shilmagan</p></div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {form.subjects.map(sa => (
                    <div key={sa.subjectId} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjects.find(s => s.id === sa.subjectId)?.color || "#3B82F6" }} />
                          <span className="text-sm font-medium text-gray-900">{subjectName(sa.subjectId)}</span>
                        </div>
                        <button onClick={() => removeSubject(sa.subjectId)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">O'qituvchi</label>
                          <Select value={sa.teacherId ? String(sa.teacherId) : "none"}
                            onValueChange={v => updateSubjectField(sa.subjectId, "teacherId", v === "none" ? null : parseInt(v))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Biriktirilmagan —</SelectItem>
                              {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{`${t.firstName} ${t.lastName}`.trim() || t.employeeId}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Soat/hafta</label>
                          <Input type="number" min={1} max={8} value={sa.weeklyHours}
                            onChange={e => updateSubjectField(sa.subjectId, "weeklyHours", parseInt(e.target.value) || 2)} className="h-8 text-xs" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.subjects.length > 0 && (
                <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                  Jami: <span className="font-semibold text-gray-900">{form.subjects.reduce((s, x) => s + x.weeklyHours, 0)}</span> soat/hafta
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name && !form.grade) { toast({ title: "Xatolik", description: "Sinf nomi kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/classes"] })} />

      <DeleteConfirmDialog
        open={deleteId !== null}
        title="Sinf o'chiriladi. Davom etasizmi?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
