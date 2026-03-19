import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Teacher, Subject } from "@shared/schema";

interface TeacherFormData {
  firstName: string;
  lastName: string;
  department: string;
  specialization: string;
  phone: string;
  maxHoursPerWeek: number;
  subjectIds: number[];
}

const EMPTY_FORM: TeacherFormData = {
  firstName: "", lastName: "", department: "", specialization: "", phone: "", maxHoursPerWeek: 30, subjectIds: [],
};

export default function Teachers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherFormData>(EMPTY_FORM);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      if (editing) {
        await apiRequest("PATCH", `/api/teachers/${editing.id}`, data);
      } else {
        await apiRequest("POST", "/api/teachers", data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teachers"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "O'qituvchi yangilandi" : "O'qituvchi qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teachers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi o'chirildi" });
    },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = async (t: Teacher) => {
    setEditing(t);
    // Load teacher's current subjects
    let subjectIds: number[] = [];
    try {
      const r = await fetch(`/api/teachers/${t.id}/subjects`);
      if (r.ok) {
        const data = await r.json();
        subjectIds = data.map((ts: any) => ts.subjectId);
      }
    } catch {}
    setForm({
      firstName: t.firstName || "",
      lastName: t.lastName || "",
      department: t.department || "",
      specialization: t.specialization || "",
      phone: t.phone || "",
      maxHoursPerWeek: t.maxHoursPerWeek || 30,
      subjectIds,
    });
    setOpen(true);
  };

  const toggleSubject = (id: number) => {
    setForm(p => ({
      ...p,
      subjectIds: p.subjectIds.includes(id) ? p.subjectIds.filter(x => x !== id) : [...p.subjectIds, id],
    }));
  };

  const filtered = teachers.filter(t =>
    `${t.firstName} ${t.lastName} ${t.department} ${t.specialization}`.toLowerCase().includes(search.toLowerCase())
  );

  const fullName = (t: Teacher) => `${t.firstName} ${t.lastName}`.trim() || t.employeeId;
  const initials = (t: Teacher) => {
    const name = `${t.firstName} ${t.lastName}`.trim();
    return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">O'qituvchilar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'qituvchilar va ularning fanlarini boshqarish</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          O'qituvchi qo'shish
        </Button>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <Users className="mr-2 h-4 w-4 text-emerald-600" />
              O'qituvchilar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{teachers.length} ta</Badge>
            </CardTitle>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Ism yoki bo'lim bo'yicha..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <div key={i} className="h-36 bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(teacher => (
                <div key={teacher.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">{initials(teacher)}</span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(teacher)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(teacher.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 text-sm">{fullName(teacher)}</h3>
                  {teacher.department && (
                    <p className="text-xs text-gray-500 mt-0.5">{teacher.department}</p>
                  )}
                  {teacher.specialization && (
                    <div className="flex items-center space-x-1 mt-1.5">
                      <BookOpen className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">{teacher.specialization}</p>
                    </div>
                  )}
                  {teacher.phone && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500">{teacher.phone}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <Badge variant="secondary" className="text-xs py-0 bg-emerald-50 text-emerald-700">Faol</Badge>
                    <div className="flex items-center space-x-1 text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">{teacher.maxHoursPerWeek} soat/hafta</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {search ? "Qidiruv bo'yicha natija topilmadi" : "O'qituvchilar ro'yxati bo'sh"}
              </p>
              {!search && <p className="text-sm text-gray-400 mt-1">Yangi o'qituvchi qo'shish uchun yuqoridagi tugmani bosing</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Ism *</Label>
                <Input placeholder="Ism" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Familiya *</Label>
                <Input placeholder="Familiya" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Bo'lim / Kafedra</Label>
              <Input placeholder="Matematika kafedrasi" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mutaxassislik</Label>
              <Input placeholder="Masalan: Algebra, Geometriya" value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Telefon</Label>
                <Input placeholder="+998 90 123 45 67" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Max soat / hafta</Label>
                <Input type="number" min={1} max={40} value={form.maxHoursPerWeek} onChange={e => setForm(p => ({ ...p, maxHoursPerWeek: parseInt(e.target.value) || 30 }))} />
              </div>
            </div>

            {subjects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">O'qitiladigan fanlar</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                  {subjects.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSubject(sub.id)}
                      className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        form.subjectIds.includes(sub.id)
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100"
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || "#3B82F6" }} />
                      <span className="truncate">{sub.name}</span>
                    </button>
                  ))}
                </div>
                {form.subjectIds.length > 0 && (
                  <p className="text-xs text-blue-600">{form.subjectIds.length} ta fan tanlandi</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => {
                if (!form.firstName && !form.lastName) {
                  toast({ title: "Xatolik", description: "Ism yoki familiya kiritilishi shart", variant: "destructive" });
                  return;
                }
                upsertMutation.mutate(form);
              }}
              disabled={upsertMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
