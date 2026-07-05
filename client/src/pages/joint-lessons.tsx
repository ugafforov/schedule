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
import { Plus, Search, Edit, Trash2, Link2, Users, BookOpen, DoorOpen, X, Check, ChevronsUpDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, Room } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

interface GroupInput {
  groupName: string;
  teacherId: string;
  roomId: string; // "none" for auto
}

interface JointLessonFormData {
  subjectId: string;
  weeklyHours: number;
  classIds: number[];
  groups: GroupInput[];
}

const EMPTY_FORM: JointLessonFormData = {
  subjectId: "",
  weeklyHours: 2,
  classIds: [],
  groups: [
    { groupName: "1-guruh", teacherId: "", roomId: "none" },
    { groupName: "2-guruh", teacherId: "", roomId: "none" }
  ]
};

export default function JointLessons() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<JointLessonFormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  // Queries
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
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
  const { data: jointLessons = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/joint-lessons"],
  });

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/joint-lessons/${editingId}` : "/api/joint-lessons";
      await apiRequest(method, url, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/joint-lessons"] });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editingId ? "Birlashtirilgan dars yangilandi" : "Birlashtirilgan dars qo'shildi" });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/joint-lessons/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/joint-lessons"] });
      toast({ title: "Muvaffaqiyat", description: "Birlashtirilgan dars o'chirildi" });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" });
    }
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (jl: any) => {
    setEditingId(jl.id);
    setForm({
      subjectId: String(jl.subjectId),
      weeklyHours: jl.weeklyHours,
      classIds: jl.classIds || [],
      groups: (jl.groups || []).map((g: any) => ({
        groupName: g.groupName,
        teacherId: String(g.teacherId),
        roomId: g.roomId ? String(g.roomId) : "none"
      }))
    });
    setOpen(true);
  };

  const handleClassToggle = (classId: number) => {
    setForm(prev => {
      const classIds = prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : [...prev.classIds, classId];
      return { ...prev, classIds };
    });
  };

  const addGroup = () => {
    setForm(prev => ({
      ...prev,
      groups: [...prev.groups, { groupName: `${prev.groups.length + 1}-guruh`, teacherId: "", roomId: "none" }]
    }));
  };

  const removeGroup = (index: number) => {
    if (form.groups.length <= 2) {
      toast({ title: "Ma'lumot", description: "Kamida 2 ta guruh bo'lishi shart", variant: "destructive" });
      return;
    }
    setForm(prev => ({
      ...prev,
      groups: prev.groups.filter((_, i) => i !== index)
    }));
  };

  const updateGroupField = (index: number, field: keyof GroupInput, value: string) => {
    setForm(prev => ({
      ...prev,
      groups: prev.groups.map((g, i) => i === index ? { ...g, [field]: value } : g)
    }));
  };

  const handleSubmit = () => {
    if (!form.subjectId) {
      toast({ title: "Xatolik", description: "Fan tanlanishi shart", variant: "destructive" });
      return;
    }
    if (form.classIds.length < 2) {
      toast({ title: "Xatolik", description: "Kamida 2 ta sinf tanlanishi shart", variant: "destructive" });
      return;
    }
    const invalidGroup = form.groups.find(g => !g.groupName || !g.teacherId);
    if (invalidGroup) {
      toast({ title: "Xatolik", description: "Barcha guruhlar nomi va o'qituvchisi kiritilishi shart", variant: "destructive" });
      return;
    }

    const payload = {
      subjectId: parseInt(form.subjectId),
      weeklyHours: form.weeklyHours,
      classIds: form.classIds,
      groups: form.groups.map(g => ({
        groupName: g.groupName,
        teacherId: parseInt(g.teacherId),
        roomId: g.roomId === "none" ? null : parseInt(g.roomId)
      }))
    };

    upsertMutation.mutate(payload);
  };

  const getSubjectName = (id: number) => subjects.find(s => s.id === id)?.name || "Noma'lum fan";
  const getClassName = (id: number) => classes.find(c => c.id === id)?.name || `Sinf #${id}`;
  const getTeacherName = (id: number) => {
    const t = teachers.find(x => x.id === id);
    return t ? `${t.firstName} ${t.lastName}`.trim() : `O'qituvchi #${id}`;
  };
  const getRoomName = (id: number | null) => {
    if (!id) return "Avtomatik xona";
    const r = rooms.find(x => x.id === id);
    return r ? `${r.name} (${r.roomNumber})` : `Xona #${id}`;
  };

  const filtered = jointLessons.filter(jl => {
    const subName = getSubjectName(jl.subjectId).toLowerCase();
    const classNames = (jl.classes || []).map((c: any) => c.className.toLowerCase()).join(" ");
    const searchLower = search.toLowerCase();
    return subName.includes(searchLower) || classNames.includes(searchLower);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Birlashtirilgan darslar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Parallel sinflarni birlashtirib, guruhlar doirasida darslarni boshqarish</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Birlashtirilgan dars qo'shish
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4 w-4" />
          <Input placeholder="Fan yoki sinflarni qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-muted/20 border-border text-foreground" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="text-xs text-muted-foreground">
          Jami: <span className="font-semibold text-foreground">{filtered.length} ta dars</span>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm text-card-foreground">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">{search ? "Qidiruv bo'yicha dars topilmadi" : "Hozircha birlashtirilgan darslar yo'q"}</p>
          {!search && <p className="text-xs text-muted-foreground/60 mt-1">Yangi birlashtirilgan dars qo'shish tugmasini bosing</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((jl: any) => (
            <Card key={jl.id} className="border border-border hover:border-primary/50 hover:shadow-md transition-all rounded-2xl overflow-hidden bg-card text-card-foreground flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-border bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4.5 w-4.5 text-primary" />
                      <span className="font-bold text-foreground text-sm">{getSubjectName(jl.subjectId)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-muted text-foreground" onClick={() => openEdit(jl)}><Edit className="h-3.5 w-3.5 text-muted-foreground/80 hover:text-foreground" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-500/10 text-red-500 hover:text-red-600" onClick={() => setDeleteId(jl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {(jl.classIds || []).map((cid: number) => (
                      <Badge key={cid} variant="secondary" className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-none rounded-md">
                        {getClassName(cid)}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Guruhlar va o'qituvchilar</span>
                    <div className="space-y-1.5">
                      {(jl.groups || []).map((g: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40 border border-border">
                          <div className="flex items-center space-x-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                            <span className="font-semibold text-foreground">{g.groupName}</span>
                            <span className="text-muted-foreground/30">|</span>
                            <span className="text-muted-foreground">{getTeacherName(g.teacherId)}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground/80 bg-card border border-border px-2 py-0.5 rounded-lg">
                            <DoorOpen className="h-3 w-3" />
                            <span>{g.roomName || "Avtomatik"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </div>
              <div className="border-t border-border px-4 py-3 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                <span>Haftalik dars soati:</span>
                <span className="font-bold text-foreground">{jl.weeklyHours} soat</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Link2 className="h-5 w-5 text-primary" />
              {editingId ? "Birlashtirilgan darsni tahrirlash" : "Yangi birlashtirilgan dars qo'shish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Fanni tanlang *</Label>
              <Select value={form.subjectId} onValueChange={v => setForm(p => ({ ...p, subjectId: v }))}>
                <SelectTrigger className="h-10 text-sm rounded-xl bg-muted/20 border-border text-foreground"><SelectValue placeholder="Fan ro'yxati..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Weekly Hours */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Haftalik dars soati *</Label>
              <Input type="number" min={0.5} max={10} step={0.5} value={form.weeklyHours} onChange={e => setForm(p => ({ ...p, weeklyHours: parseFloat(e.target.value) || 2 }))} className="h-10 rounded-xl bg-muted/20 border-border text-foreground" />
            </div>

            {/* Classes checklist */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Sinflarni tanlang (Kamida 2 ta sinf) *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto p-3.5 bg-muted/40 border border-border rounded-2xl">
                {classes.map(c => {
                  const checked = form.classIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center space-x-2 bg-card px-2.5 py-1.5 rounded-xl border border-border">
                      <Checkbox id={`cls-${c.id}`} checked={checked} onCheckedChange={() => handleClassToggle(c.id)} className="rounded-md" />
                      <Label htmlFor={`cls-${c.id}`} className="text-xs font-medium cursor-pointer select-none text-foreground">{c.name}</Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Groups list */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Dars guruhlari *</Label>
                <Button size="sm" variant="outline" onClick={addGroup} className="h-8 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg">
                  + Guruh qo'shish
                </Button>
              </div>

              <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                {form.groups.map((g, index) => (
                  <div key={index} className="relative border border-border rounded-2xl p-4 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input placeholder="Guruh nomi" value={g.groupName} onChange={e => updateGroupField(index, "groupName", e.target.value)} className="h-8 w-36 font-semibold text-xs rounded-lg bg-card border-border text-foreground" />
                      {form.groups.length > 2 && (
                        <button onClick={() => removeGroup(index)} className="text-muted-foreground/60 hover:text-red-500 transition-colors p-1"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">O'qituvchi</label>
                        <Select value={g.teacherId} onValueChange={v => updateGroupField(index, "teacherId", v)}>
                          <SelectTrigger className="h-9 text-xs rounded-lg bg-card border-border text-foreground"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                          <SelectContent>
                            {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{`${t.firstName} ${t.lastName}`.trim() || t.employeeId}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Xona</label>
                        <Select value={g.roomId} onValueChange={v => updateGroupField(index, "roomId", v)}>
                          <SelectTrigger className="h-9 text-xs rounded-lg bg-card border-border text-foreground"><SelectValue placeholder="Avtomatik" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Avtomatik xona</SelectItem>
                            {rooms.map(r => <SelectItem key={r.id} value={String(r.id)}>{`${r.name} (${r.roomNumber})`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl border-border">Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {editingId ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-bold">
              <Trash2 className="h-5 w-5" /> Birlashtirilgan darsni o'chirish
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Ushbu birlashtirilgan darsni o'chirishni tasdiqlaysizmi? (Dars jadvalidagi mavjud darslar o'chib ketadi)</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl border-border">Bekor</Button>
            <Button variant="destructive" onClick={() => { if (deleteId !== null) deleteMutation.mutate(deleteId); setDeleteId(null); }} className="rounded-xl">O'chirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
