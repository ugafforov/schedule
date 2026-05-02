import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock, CalendarX } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Teacher, Subject } from "@shared/schema";

const DAYS = ["Du", "Se", "Ch", "Pa", "Ju"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const PERIOD_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];

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
  const [activeTab, setActiveTab] = useState<"info" | "unavail">("info");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherFormData>(EMPTY_FORM);
  // unavailability grid: Set of "day_period" strings (1-indexed day, 1-indexed period)
  const [unavailSlots, setUnavailSlots] = useState<Set<string>>(new Set());
  const [unavailLoading, setUnavailLoading] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      let teacherId: number;
      if (editing) {
        const r = await apiRequest("PATCH", `/api/teachers/${editing.id}`, data);
        const j = await r.json();
        teacherId = j.id || editing.id;
      } else {
        const r = await apiRequest("POST", "/api/teachers", data);
        const j = await r.json();
        teacherId = j.id;
      }
      // Save unavailability
      const slots = Array.from(unavailSlots).map(key => {
        const [day, period] = key.split("_").map(Number);
        return { dayOfWeek: day, periodNumber: period };
      });
      await apiRequest("PUT", `/api/teachers/${teacherId}/unavailability`, { slots });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teachers"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setUnavailSlots(new Set());
      setActiveTab("info");
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

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setUnavailSlots(new Set());
    setActiveTab("info");
    setOpen(true);
  };

  const openEdit = async (t: Teacher) => {
    setEditing(t);
    setActiveTab("info");
    let subjectIds: number[] = [];
    let unavail: Set<string> = new Set();
    setUnavailLoading(true);
    try {
      const [subRes, unavailRes] = await Promise.all([
        fetch(`/api/teachers/${t.id}/subjects`),
        fetch(`/api/teachers/${t.id}/unavailability`),
      ]);
      if (subRes.ok) {
        const data = await subRes.json();
        subjectIds = data.map((ts: any) => ts.subjectId);
      }
      if (unavailRes.ok) {
        const data = await unavailRes.json();
        unavail = new Set(data.map((u: any) => `${u.dayOfWeek}_${u.periodNumber}`));
      }
    } catch {}
    setUnavailLoading(false);
    setForm({
      firstName: t.firstName || "",
      lastName: t.lastName || "",
      department: t.department || "",
      specialization: t.specialization || "",
      phone: t.phone || "",
      maxHoursPerWeek: t.maxHoursPerWeek || 30,
      subjectIds,
    });
    setUnavailSlots(unavail);
    setOpen(true);
  };

  const toggleSubject = (id: number) => {
    setForm(p => ({
      ...p,
      subjectIds: p.subjectIds.includes(id) ? p.subjectIds.filter(x => x !== id) : [...p.subjectIds, id],
    }));
  };

  const toggleUnavail = (day: number, period: number) => {
    const key = `${day}_${period}`;
    setUnavailSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
          <p className="text-gray-500 text-sm mt-0.5">O'qituvchilar, fanlar va band bo'lmagan vaqtlarni boshqarish</p>
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
                  {teacher.department && <p className="text-xs text-gray-500 mt-0.5">{teacher.department}</p>}
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

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setActiveTab("info"); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "info" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("info")}
            >
              Ma'lumotlar
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-1.5 ${activeTab === "unavail" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("unavail")}
            >
              <CalendarX className="h-3.5 w-3.5" />
              <span>Band vaqtlar</span>
              {unavailSlots.size > 0 && (
                <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">{unavailSlots.size}</span>
              )}
            </button>
          </div>

          {activeTab === "info" ? (
            <div className="space-y-4">
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
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Dars bera olmaydigan vaqtlar</p>
                  <p className="text-xs text-gray-400 mt-0.5">Qizil katakchalar — o'qituvchi band bo'lgan vaqtlar</p>
                </div>
                {unavailSlots.size > 0 && (
                  <button onClick={() => setUnavailSlots(new Set())} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Tozalash
                  </button>
                )}
              </div>
              {unavailLoading ? (
                <div className="h-40 bg-gray-50 animate-pulse rounded-lg" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-2 text-gray-400 font-medium w-16">Dars</th>
                        {DAYS.map((d, i) => (
                          <th key={i} className="text-center py-1.5 px-1 text-gray-600 font-semibold">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(period => (
                        <tr key={period}>
                          <td className="py-1 px-2">
                            <div className="text-gray-600 font-medium">{period}-dars</div>
                            <div className="text-gray-400 font-mono text-[10px]">{PERIOD_TIMES[period - 1]}</div>
                          </td>
                          {DAYS.map((_, dayIdx) => {
                            const day = dayIdx + 1;
                            const key = `${day}_${period}`;
                            const isBusy = unavailSlots.has(key);
                            return (
                              <td key={dayIdx} className="py-1 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleUnavail(day, period)}
                                  className={`w-full h-9 rounded-md border transition-all text-xs font-medium ${
                                    isBusy
                                      ? "bg-red-100 border-red-300 text-red-600 hover:bg-red-200"
                                      : "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"
                                  }`}
                                  title={isBusy ? "Band (bosib faollashtiring)" : "Bo'sh (bosib bloklang)"}
                                >
                                  {isBusy ? "✕" : "✓"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center space-x-4 text-xs text-gray-500 pt-1">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-green-50 border border-green-200 rounded" />
                  <span>Bo'sh — dars bera oladi</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
                  <span>Band — dars bera olmaydi</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
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
              {upsertMutation.isPending ? "Saqlanmoqda..." : (editing ? "Saqlash" : "Qo'shish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
