import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock, CalendarX, Zap, LayoutGrid, List, Wand2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { Teacher, Subject } from "@shared/schema";
import { InlineEdit } from "@/components/ui/inline-edit";

// Sub-components
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";
import { TeacherSubjectDialog } from "@/components/teachers/subject-dialog";
import { BulkAddTeachers } from "@/components/teachers/bulk-add-dialog";

const CURRICULUM_MAX_HOURS = 24;
const DAYS = ["Du", "Se", "Ch", "Pa", "Ju"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const PERIOD_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];

interface TeacherFormData {
  firstName: string; lastName: string; department: string;
  specialization: string; phone: string; maxHoursPerWeek: number; subjectIds: number[];
  gradeLevel: string; // "primary" (1-4), "high" (5-11) yoki "primary,high" (barcha sinflar)
}

const EMPTY_FORM: TeacherFormData = {
  firstName: "", lastName: "", department: "", specialization: "", phone: "", maxHoursPerWeek: 30, subjectIds: [], gradeLevel: "high",
};

function ClearAllDialog({ open, title, onClose, onConfirm }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>O'chirishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>O'chirish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Teachers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "unavail">("info");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<TeacherFormData>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  // Filtered teachers
  const filtered = teachers.filter(t => {
    const query = search.toLowerCase();
    return (
      t.firstName.toLowerCase().includes(query) ||
      t.lastName.toLowerCase().includes(query) ||
      t.employeeId.toLowerCase().includes(query) ||
      t.department?.toLowerCase().includes(query) ||
      t.specialization?.toLowerCase().includes(query)
    );
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/teachers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setOpen(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi muvaffaqiyatli qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/teachers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setOpen(false);
      setEditing(null);
      setFormData(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi ma'lumotlari yangilandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teachers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setDeletingId(null);
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi tizimdan o'chirildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/teachers/all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setClearing(false);
      toast({ title: "Muvaffaqiyat", description: "Barcha o'qituvchilar o'chirildi" });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/teachers/auto-generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Muvaffaqiyat", description: "O'qituvchilar avtomatik yaratildi va fanlarga biriktirildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const updateUnavailabilityMutation = useMutation({
    mutationFn: ({ teacherId, unavailability }: { teacherId: number; unavailability: any[] }) =>
      apiRequest("POST", `/api/teachers/${teacherId}/unavailability`, { unavailability }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Muvaffaqiyat", description: "Bandlik ma'lumotlari yangilandi" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: formData });
    else createMutation.mutate({ ...formData, employeeId: `T${Date.now()}` });
  };

  const handleEdit = (t: Teacher) => {
    setEditing(t);
    // teacherSubjects ni subjectId lariga o'tkazish
    const subjectIds = (t as any).teacherSubjects?.map((ts: any) => ts.subjectId) || [];
    setFormData({
      firstName: t.firstName,
      lastName: t.lastName,
      department: t.department || "",
      specialization: t.specialization || "",
      phone: t.phone || "",
      maxHoursPerWeek: t.maxHoursPerWeek || 30,
      subjectIds,
      gradeLevel: (t as any).gradeLevel || "high",
    });
    setOpen(true);
  };

  const toggleUnavailability = (teacherId: number, day: number, period: number) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    const current = (teacher as any).unavailability || [];
    const exists = current.find((u: any) => u.dayOfWeek === day && u.periodNumber === period);
    const updated = exists
      ? current.filter((u: any) => !(u.dayOfWeek === day && u.periodNumber === period))
      : [...current, { dayOfWeek: day, periodNumber: period }];
    updateUnavailabilityMutation.mutate({ teacherId, unavailability: updated });
  };

  const updateField = (id: number, field: string, value: string | number) => {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;
    updateMutation.mutate({ id, data: { ...teacher, [field]: value } });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">O'qituvchilar</h1>
          <p className="text-sm text-gray-500 mt-1">O'qituvchilar tarkibi va ularning bandlik jadvallarini boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          {teachers.length > 0 && (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setClearing(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Hammasini o'chirish
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Zap className="h-4 w-4 mr-1.5 text-amber-500" /> Ko'p qo'shish
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormData(EMPTY_FORM); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> Yangi o'qituvchi
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Jami o'qituvchilar</p>
              <p className="text-xl font-bold text-gray-900">{teachers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">O'rtacha dars soati</p>
              <p className="text-xl font-bold text-gray-900">
                {teachers.length ? Math.round(teachers.reduce((s, t) => s + (t.maxHoursPerWeek || 0), 0) / teachers.length) : 0} s.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Cheklov o'rnatilgan</p>
              <p className="text-xl font-bold text-gray-900">
                {teachers.filter(t => ((t as any).unavailability || []).length > 0).length} ta
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Kafedralar</p>
              <p className="text-xl font-bold text-gray-900">
                {new Set(teachers.map(t => t.department).filter(Boolean)).size} ta
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="F.I.O yoki kafedra bo'yicha qidirish..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-100 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-2 self-end">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <Button 
              variant={view === "grid" ? "secondary" : "ghost"} 
              size="sm" 
              className={`h-7 px-3 ${view === "grid" ? "bg-white shadow-sm" : "text-gray-500"}`}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" /> Grid
            </Button>
            <Button 
              variant={view === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className={`h-7 px-3 ${view === "list" ? "bg-white shadow-sm" : "text-gray-500"}`}
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4 mr-1.5" /> List
            </Button>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-gray-50 animate-pulse rounded-2xl border border-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Hech qanday o'qituvchi topilmadi</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-1">Qidiruv kriteriyasini o'zgartiring yoki yangi o'qituvchi qo'shing.</p>
          <Button variant="outline" className="mt-6" onClick={() => setSearch("")}>Barcha o'qituvchilar</Button>
        </div>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filtered.map((teacher) => (
            <Card key={teacher.id} className="group hover:shadow-md transition-all duration-300 border-gray-100 rounded-2xl overflow-hidden relative">
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(teacher)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeletingId(teacher.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-blue-100 shadow-lg flex-shrink-0">
                    {teacher.firstName[0]}{teacher.lastName[0]}
                  </div>
                  <div className="min-w-0 pr-10">
                    <CardTitle className="text-lg font-bold text-gray-900 truncate flex items-center gap-2">
                      <InlineEdit
                        value={`${teacher.lastName} ${teacher.firstName}`}
                        onSave={(val) => {
                          const parts = val.split(" ");
                          updateField(teacher.id, "lastName", parts[0] || "");
                          updateField(teacher.id, "firstName", parts.slice(1).join(" ") || "");
                        }}
                        className="truncate"
                      />
                    </CardTitle>
                    <p className="text-sm text-gray-500 font-medium truncate">{teacher.specialization || "Mutaxassislik kiritilmagan"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none px-2 py-0 text-[10px] font-bold uppercase tracking-wider">
                        {teacher.employeeId}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-blue-100 text-blue-600 bg-blue-50/50">
                        {teacher.department}
                      </Badge>
                      {(teacher as any).gradeLevel && (
                        <Badge variant="outline" className="text-[10px] border-purple-100 text-purple-600 bg-purple-50/50">
                          {(teacher as any).gradeLevel === "primary" ? "1-4 sinf" : (teacher as any).gradeLevel === "high" ? "5-11 sinf" : "Barcha sinf"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Contact and Hours */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {teacher.phone || "Telefon yo'q"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-sm font-bold text-gray-900">{teacher.maxHoursPerWeek} soat</span>
                  </div>
                </div>

                {/* Subjects */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fanlar</Label>
                    <span className="text-[10px] font-medium text-gray-400">{(teacher as any).teacherSubjects?.length || 0} ta</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {((teacher as any).teacherSubjects || []).length > 0 ? (
                      (teacher as any).teacherSubjects.map((ts: any) => {
                        const sub = subjects.find(s => s.id === ts.subjectId);
                        return (
                          <Badge key={ts.id} variant="outline" className="text-[10px] font-medium transition-colors hover:border-blue-300" style={{ borderColor: `${sub?.color}40`, color: sub?.color }}>
                            {sub?.name}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-400 italic">Fan biriktirilmagan</span>
                    )}
                  </div>
                </div>

                {/* Unavailability grid */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    O'qituvchi bandligi (Cheklovlar)
                    <CalendarX className="h-3 w-3" />
                  </Label>
                  <div className="flex gap-1.5">
                    {DAYS.map((day, dIdx) => (
                      <div key={day} className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-gray-400 text-center mb-0.5">{day}</span>
                        <div className="grid grid-cols-1 gap-1">
                          {PERIODS.map(period => {
                            const isBlocked = ((teacher as any).unavailability || []).some((u: any) => u.dayOfWeek === dIdx + 1 && u.periodNumber === period);
                            return (
                              <button
                                key={period}
                                onClick={() => toggleUnavailability(teacher.id, dIdx + 1, period)}
                                title={`${day}, ${period}-soat: ${isBlocked ? 'Band (dars qo\'yib bo\'lmaydi)' : 'Bo\'sh (dars qo\'yish mumkin)'}`}
                                className={`h-4 rounded-sm transition-all border ${
                                  isBlocked 
                                    ? "bg-red-500 border-red-600 shadow-sm" 
                                    : "bg-gray-100 border-gray-200 hover:bg-gray-200"
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 italic">* Qizil kataklar — o'qituvchi dars o'ta olmaydigan vaqtlar</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODALS */}
      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Familiya</Label>
                <Input id="lastName" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Ism</Label>
                <Input id="firstName" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Kafedra / Bo'lim</Label>
                <Input id="department" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">Mutaxassislik</Label>
                <Input id="specialization" value={formData.specialization} onChange={e => setFormData({ ...formData, specialization: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon raqami</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxHours">Haftalik max soat</Label>
                <Input id="maxHours" type="number" required value={formData.maxHoursPerWeek} onChange={e => setFormData({ ...formData, maxHoursPerWeek: parseInt(e.target.value) || 30 })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sinf darajalari</Label>
              <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
                {[
                  { id: "primary", label: "1-4 sinf" },
                  { id: "high", label: "5-11 sinf" },
                  { id: "primary,high", label: "Barchasi" }
                ].map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, gradeLevel: l.id })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      formData.gradeLevel === l.id 
                        ? "bg-white text-blue-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>O'qitadigan fanlari</Label>
                <Badge variant="outline" className="text-[10px]">{formData.subjectIds.length} ta tanlangan</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
                {subjects.map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      const ids = formData.subjectIds.includes(sub.id)
                        ? formData.subjectIds.filter(id => id !== sub.id)
                        : [...formData.subjectIds, sub.id];
                      setFormData({ ...formData, subjectIds: ids });
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all ${
                      formData.subjectIds.includes(sub.id)
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                        : "bg-white text-gray-600 border border-gray-100 hover:border-blue-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${formData.subjectIds.includes(sub.id) ? "bg-white" : ""}`} style={!formData.subjectIds.includes(sub.id) ? { backgroundColor: sub.color } : {}} />
                    <span className="truncate">{sub.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-50">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {editing ? "Saqlash" : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmDialog
        open={deletingId !== null}
        title="Ushbu o'qituvchini o'chirib tashlamoqchimisiz? Ushbu amalni ortga qaytarib bo'lmaydi."
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />

      <ClearAllDialog
        open={clearing}
        title="Barcha o'qituvchilarni o'chirib tashlamoqchimisiz? Bu amal barcha o'qituvchi ma'lumotlarini tozalaydi."
        onClose={() => setClearing(false)}
        onConfirm={() => clearAllMutation.mutate()}
      />

      <BulkAddTeachers 
        open={bulkOpen} 
        onClose={() => setBulkOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/teachers"] })}
        autoGenerateMutation={autoGenerateMutation}
      />
    </div>
  );
}
