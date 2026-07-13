import { useState, Fragment, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock, 
  CalendarX, Zap, LayoutGrid, List, ChevronRight, FileSpreadsheet,
  MoreHorizontal
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { Teacher, Subject, TimeSlot } from "@shared/schema";
import { InlineEdit } from "@/components/ui/inline-edit";

// Sub-components
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";
import { BulkAddTeachers } from "@/components/teachers/bulk-add-dialog";
import { ExcelImportDialog } from "@/components/bulk/excel-import-dialog";

const DAYS = ["Du", "Se", "Ch", "Pa", "Ju"];
const PERIODS = [1, 2, 3, 4, 5, 6];

interface TeacherFormData {
  firstName: string; lastName: string; department: string;
  specialization: string; phone: string; maxHoursPerWeek: number; subjectIds: number[];
  gradeLevel: string;
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
        <p className="text-sm text-muted-foreground">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>O'chirish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoGenerateConfirmDialog({ open, onClose, onConfirm, count }: { open: boolean; onClose: () => void; onConfirm: () => void; count: number }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Avtomatik yaratishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <p className="text-sm text-muted-foreground">
            DTS dars yuklamalari asosida jami <strong className="text-foreground font-bold">{count} ta</strong> vakant o'qituvchi avtomatik yaratiladi va tegishli sinf darslariga biriktiriladi.
          </p>
          <p className="text-sm text-muted-foreground">
            Tasdiqlaysizmi?
          </p>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-primary-foreground" onClick={onConfirm}>Tasdiqlash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function UnavailabilityDialog({ 
  open, 
  onClose, 
  teacher, 
  onSave,
  timeSlots
}: { 
  open: boolean; 
  onClose: () => void; 
  teacher: Teacher | null; 
  onSave: (tid: number, slots: any[]) => void;
  timeSlots: TimeSlot[];
}) {
  const [localSlots, setLocalSlots] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<"block" | "unblock" | null>(null);

  const daysToRender = useMemo(() => {
    const defaultDays = ["Du", "Se", "Ch", "Pa", "Ju"];
    const hasSaturdaySlots = timeSlots.some(s => Number(s.dayOfWeek) === 6);
    if (hasSaturdaySlots) {
      return [...defaultDays, "Sh"];
    }
    return defaultDays;
  }, [timeSlots]);

  // Sync local state when teacher changes or dialog opens
  useEffect(() => {
    if (open && teacher) {
      setLocalSlots((teacher as any).unavailability || []);
    }
  }, [open, teacher]);

  if (!teacher) return null;

  const isSlotBlocked = (d: number, p: number) => 
    localSlots.some(s => Number(s.dayOfWeek) === d && Number(s.periodNumber) === p);

  const toggleSlotLocally = (d: number, p: number, forceAction?: "block" | "unblock") => {
    setLocalSlots(prev => {
      const exists = prev.some(s => Number(s.dayOfWeek) === d && Number(s.periodNumber) === p);
      const shouldBlock = forceAction ? forceAction === "block" : !exists;
      
      if (shouldBlock && !exists) return [...prev, { dayOfWeek: d, periodNumber: p }];
      if (!shouldBlock && exists) return prev.filter(s => !(Number(s.dayOfWeek) === d && Number(s.periodNumber) === p));
      return prev;
    });
  };

  const handleMouseDown = (d: number, p: number) => {
    const blocked = isSlotBlocked(d, p);
    const action = blocked ? "unblock" : "block";
    setIsDragging(true);
    setDragAction(action);
    toggleSlotLocally(d, p, action);
  };

  const handleMouseEnter = (d: number, p: number) => {
    if (isDragging && dragAction) {
      toggleSlotLocally(d, p, dragAction);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragAction(null);
      // Sync to parent on drag end
      onSave(teacher.id, localSlots);
    }
  };

  const handleBulkToggle = (type: "day" | "period", index: number) => {
    const daysArray = daysToRender.map((_, i) => i + 1);
    let slotsToToggle = type === "day" 
      ? PERIODS.map(p => ({ dayOfWeek: index, periodNumber: p }))
      : daysArray.map(d => ({ dayOfWeek: d, periodNumber: index }));

    const allBlocked = slotsToToggle.every(s => isSlotBlocked(s.dayOfWeek, s.periodNumber));
    const action = allBlocked ? "unblock" : "block";

    setLocalSlots(prev => {
      let next = [...prev];
      if (action === "unblock") {
        next = next.filter(u => !slotsToToggle.some(s => Number(u.dayOfWeek) === s.dayOfWeek && Number(u.periodNumber) === s.periodNumber));
      } else {
        slotsToToggle.forEach(s => {
          if (!next.some(u => Number(u.dayOfWeek) === s.dayOfWeek && Number(u.periodNumber) === s.periodNumber)) {
            next.push(s);
          }
        });
      }
      // Sync immediately for bulk actions
      onSave(teacher.id, next);
      return next;
    });
  };

  const getPeriodTime = (p: number) => {
    const slot = timeSlots.find(s => s.periodNumber === p && !s.isBreak);
    return slot ? `${slot.startTime?.slice(0, 5)}–${slot.endTime?.slice(0, 5)}` : "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md select-none border-border bg-card text-card-foreground p-5 rounded-xl shadow-lg" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <CalendarX className="h-5 w-5 text-red-500" />
            Bandlik cheklovlari
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{teacher.lastName} {teacher.firstName} ({teacher.specialization || "Mutaxassislik kiritilmagan"})</p>
        </DialogHeader>
        
        <div className="py-3">
          <div className="grid gap-1" style={{ gridTemplateColumns: `75px repeat(${daysToRender.length}, 1fr)` }}>
            <div />
            {daysToRender.map((day, dIdx) => (
              <button 
                key={day} 
                type="button"
                onClick={() => handleBulkToggle("day", dIdx + 1)}
                className="h-8 flex items-center justify-center font-bold text-[10px] text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 uppercase tracking-wider bg-muted/40 rounded-t-md transition-all cursor-pointer border border-transparent hover:border-blue-500/20"
              >
                {day}
              </button>
            ))}

            {PERIODS.map(period => (
              <Fragment key={period}>
                <button 
                  type="button"
                  onClick={() => handleBulkToggle("period", period)}
                  className="h-9 flex flex-col justify-center pr-2.5 border-r border-border text-right hover:bg-blue-500/10 transition-all cursor-pointer group rounded-l-md"
                >
                  <span className="font-bold text-[9px] text-muted-foreground group-hover:text-blue-600 uppercase tracking-tighter leading-none">
                    {period}-soat
                  </span>
                  <span className="text-[7.5px] text-muted-foreground/60 group-hover:text-blue-400 font-mono mt-0.5 leading-none">
                    {getPeriodTime(period)}
                  </span>
                </button>
                {daysToRender.map((_, dIdx) => {
                  const dayNum = dIdx + 1;
                  const blocked = isSlotBlocked(dayNum, period);
                  return (
                    <div key={dIdx} className="h-9 flex items-center justify-center p-[1.5px]">
                      <div
                        onMouseDown={() => handleMouseDown(dayNum, period)}
                        onMouseEnter={() => handleMouseEnter(dayNum, period)}
                        className={`w-full h-full rounded border transition-all duration-150 cursor-pointer ${
                          blocked 
                            ? "bg-red-500/20 border-red-500 hover:bg-red-500/35 dark:bg-red-500/30 dark:border-red-400 shadow-sm" 
                            : "bg-muted/30 border-border/70 hover:border-blue-500/40 hover:bg-muted/70 hover:scale-[1.02]"
                        }`}
                      />
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          
          <div className="mt-4 flex gap-3 p-2 bg-muted/30 rounded-lg border border-border/40 items-center justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-red-500/25 border border-red-500" />
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Taqiqlangan</span>
            </div>
            <div className="w-px h-3.5 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-muted/30 border border-border" />
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Ruxsat etilgan</span>
            </div>
          </div>
          
          <div className="mt-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground/75 text-center italic">
              * Sichqonchani bosib turib surish — ko'p kataklarni tezkor belgilash
            </p>
            <p className="text-[9px] text-muted-foreground/75 text-center italic">
              * Kun yoki soat ustiga bosish — butun qator/ustunni o'zgartirish
            </p>
          </div>
        </div>

        <DialogFooter className="mt-1">
          <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90 h-9 text-xs font-semibold rounded-lg shadow-sm">Tayyor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



export default function Teachers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<TeacherFormData>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [unavailTeacher, setUnavailTeacher] = useState<Teacher | null>(null);
  const [autoGenerateConfirmOpen, setAutoGenerateConfirmOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({ queryKey: ["/api/time-slots"] });
  const { data: recs = [] } = useQuery<any[]>({ queryKey: ["/api/teacher-recommendation"] });

  const totalVacancies = recs.filter(r => r.vacancies > 0).reduce((s, r) => s + r.vacancies, 0);

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
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-recommendation"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-recommendation"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-recommendation"] });
      setDeletingId(null);
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi tizimdan o'chirildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/teachers/all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-recommendation"] });
      setClearing(false);
      toast({ title: "Muvaffaqiyat", description: "Barcha o'qituvchilar o'chirildi" });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/teachers/auto-generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-recommendation"] });
      toast({ title: "Muvaffaqiyat", description: "Vakant o'qituvchilar avtomatik yaratildi va fanlarga biriktirildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const updateUnavailabilityMutation = useMutation({
    mutationFn: ({ teacherId, slots }: { teacherId: number; slots: any[] }) =>
      apiRequest("POST", `/api/teachers/${teacherId}/unavailability`, { slots }),
    onMutate: async ({ teacherId, slots }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/teachers"] });
      const previousTeachers = queryClient.getQueryData<Teacher[]>(["/api/teachers"]);
      if (previousTeachers) {
        queryClient.setQueryData<Teacher[]>(["/api/teachers"], 
          previousTeachers.map(t => t.id === teacherId 
            ? { ...t, unavailability: slots } 
            : t
          )
        );
      }
      return { previousTeachers };
    },
    onError: (err, variables, context) => {
      if (context?.previousTeachers) {
        queryClient.setQueryData(["/api/teachers"], context.previousTeachers);
      }
      toast({ title: "Xatolik", description: "Saqlab bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: formData });
    else createMutation.mutate({ ...formData, employeeId: `T${Date.now()}` });
  };

  const handleEdit = (t: Teacher) => {
    setEditing(t);
    const subjectIds = (t as any).teacherSubjects?.map((ts: any) => ts.subjectId) || [];
    setFormData({
      firstName: t.firstName, lastName: t.lastName, department: t.department || "",
      specialization: t.specialization || "", phone: t.phone || "",
      maxHoursPerWeek: t.maxHoursPerWeek || 30, subjectIds, gradeLevel: (t as any).gradeLevel || "high",
    });
    setOpen(true);
  };

  const updateUnavailability = (teacherId: number, slots: any[]) => {
    const formattedSlots = slots.map((s: any) => ({
      dayOfWeek: Number(s.dayOfWeek),
      periodNumber: Number(s.periodNumber)
    }));
    updateUnavailabilityMutation.mutate({ teacherId, slots: formattedSlots });
  };

  const updateField = (id: number, field: string, value: any) => {
    updateMutation.mutate({ id, data: { [field]: value } });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">O'qituvchilar</h1>
          <p className="text-sm text-muted-foreground mt-1">O'qituvchilar tarkibi va ularning bandlik jadvallarini boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          {teachers.length > 0 && (
            <Button variant="outline" size="sm" className="text-red-600 dark:text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-500/10 border-red-500/20" onClick={() => setClearing(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Hammasini o'chirish
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(true)} className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10">
            <Zap className="h-4 w-4 mr-1.5 text-amber-500" /> Ko'p qo'shish
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormData(EMPTY_FORM); setOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> O'qituvchi qo'shish
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-card text-card-foreground">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Jami o'qituvchilar</p>
              <p className="text-xl font-bold text-foreground">{teachers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-card text-card-foreground">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">O'rtacha dars soati</p>
              <p className="text-xl font-bold text-foreground">
                {teachers.length ? Math.round(teachers.reduce((s, t) => s + (t.maxHoursPerWeek || 0), 0) / teachers.length) : 0} s.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-card text-card-foreground">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Cheklov o'rnatilgan</p>
              <p className="text-xl font-bold text-foreground">
                {teachers.filter(t => ((t as any).unavailability || []).length > 0).length} ta
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-card text-card-foreground">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Kafedralar</p>
              <p className="text-xl font-bold text-foreground">
                {new Set(teachers.map(t => t.department).filter(Boolean)).size} ta
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DTS Recommendation Banner */}
      {totalVacancies > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0 animate-pulse">
              <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">DTS dars yuklamalari bo'yicha {totalVacancies} ta o'qituvchi yetishmayapti</h3>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">Sinflar va dars soatlari asosida tizim kerakli vakantlarni hisobladi. Ularni avtomatik qo'shish va darslarga biriktirish uchun tugmani bosing.</p>
            </div>
          </div>
          <Button 
            onClick={() => setAutoGenerateConfirmOpen(true)} 
            disabled={autoGenerateMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-primary-foreground font-medium shadow-sm flex-shrink-0 rounded-xl h-10 px-4 gap-2"
          >
            {autoGenerateMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
            ) : (
              <Zap className="h-4 w-4 fill-white" />
            )}
            Vakantlarni avtomatik qo'shish
          </Button>
        </div>
      )}

      {teachers.length === 0 && !isLoading ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground">O'qituvchilar ro'yxati bo'sh</h3>
          <p className="text-muted-foreground max-w-md mx-auto mt-2 text-sm leading-relaxed">
            Dars jadvalini shakllantirish uchun o'qituvchilarni qo'shing. Excel fayldan yuklashingiz yoki dars yuklamalari bo'yicha vakantlarni avtomatik yaratishingiz mumkin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {totalVacancies > 0 && (
              <Button 
                onClick={() => setAutoGenerateConfirmOpen(true)} 
                className="bg-amber-600 hover:bg-amber-700 text-primary-foreground font-medium rounded-xl h-10 px-4 gap-2 border border-transparent shadow-sm"
              >
                <Zap className="h-4 w-4 fill-white" />
                Vakantlarni avtomatik qo'shish
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setExcelImportOpen(true)} 
              className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl h-10 px-4 gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel Import
            </Button>
            <Button 
              onClick={() => setOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl h-10 px-4 gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              O'qituvchi qo'shish
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border border-border shadow-sm bg-card text-card-foreground">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold flex items-center">
                <Users className="mr-2 h-4 w-4 text-blue-500" />
                O'qituvchilar ro'yxati
                <Badge variant="secondary" className="ml-2 text-xs bg-muted text-foreground">{teachers.length} ta</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4 w-4" />
                  <Input 
                    placeholder="Qidirish..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : filtered.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="w-[280px] pl-4">O'qituvchi</TableHead>
                    <TableHead className="w-[240px]">Mutaxassislik</TableHead>
                    <TableHead>Fanlar</TableHead>
                    <TableHead className="w-[150px]">Yuklama</TableHead>
                    <TableHead className="w-[180px]">Bandlik cheklovi</TableHead>
                    <TableHead className="w-[60px] text-right pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((teacher) => {
                    const teacherSubs = (teacher as any).teacherSubjects || [];
                    const teacherUnavail = (teacher as any).unavailability || [];
                    const isVacant = teacher.isVacant;

                    return (
                      <TableRow key={teacher.id} className={`group border-border hover:bg-muted/30 transition-colors ${isVacant ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''}`}>
                        <TableCell className="pl-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <InlineEdit
                                value={`${teacher.lastName} ${teacher.firstName}`}
                                onSave={(val) => {
                                  const parts = val.split(" ");
                                  updateField(teacher.id, "lastName", parts[0] || "");
                                  updateField(teacher.id, "firstName", parts.slice(1).join(" ") || "");
                                }}
                                className={`font-semibold text-sm truncate ${isVacant ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
                                placeholder="F.I.O ni kiriting..."
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono">{teacher.employeeId}</span>
                              {isVacant && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Vakant
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <InlineEdit
                              value={teacher.specialization || "Mutaxassislik..."}
                              onSave={(val) => updateField(teacher.id, "specialization", val)}
                              className="font-medium text-sm text-foreground truncate"
                            />
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {teacher.department || "Kafedra belgilanmagan"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-h-8 overflow-hidden max-w-[250px] items-center">
                            {teacherSubs.length > 0 ? (
                              teacherSubs.slice(0, 3).map((ts: any) => {
                                const sub = subjects.find(s => s.id === ts.subjectId);
                                return (
                                  <Badge key={ts.id} variant="outline" className="text-[9px] py-0 px-1 border-border text-muted-foreground whitespace-nowrap bg-muted/20">
                                    {sub?.name || 'Mavjud emas'}
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40 italic">Biriktirilmagan</span>
                            )}
                            {teacherSubs.length > 3 && (
                              <span className="text-[10px] text-muted-foreground font-medium pl-1">
                                +{teacherSubs.length - 3}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-500/70 flex-shrink-0" />
                            <InlineEdit
                              value={teacher.maxHoursPerWeek || 30}
                              onSave={(val) => updateField(teacher.id, "maxHoursPerWeek", parseInt(val) || 30)}
                              type="number"
                              className="font-semibold text-foreground w-12"
                            />
                            <span className="text-xs text-muted-foreground/70">soat</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {teacherUnavail.length > 0 ? (
                            <button 
                              onClick={() => setUnavailTeacher(teacher)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
                              title="Cheklovlarni tahrirlash"
                            >
                              <CalendarX className="h-3.5 w-3.5" />
                              <span>{teacherUnavail.length} ta dars yopiq</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => setUnavailTeacher(teacher)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted border border-border transition-all cursor-pointer"
                              title="Cheklov qo'shish"
                            >
                              <CalendarX className="h-3.5 w-3.5 opacity-60" />
                              <span>Cheklov yo'q</span>
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="sr-only">Menyuni ochish</span>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 border-border">
                              <DropdownMenuItem onClick={() => handleEdit(teacher)} className="text-sm cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeletingId(teacher.id)} className="text-sm text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950 cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />
                                O'chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground font-medium">Qidiruv bo'yicha hech qanday o'qituvchi topilmadi</p>
                <Button variant="outline" className="mt-4 border-border hover:bg-muted text-foreground rounded-xl" onClick={() => setSearch("")}>
                  Qidiruvni tozalash
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
              <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
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
                        ? "bg-card text-blue-600 shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
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
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-border rounded-lg p-2 bg-muted/30">
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
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                      formData.subjectIds.includes(sub.id)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:bg-muted"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${formData.subjectIds.includes(sub.id) ? "bg-primary-foreground" : ""}`} style={!formData.subjectIds.includes(sub.id) ? { backgroundColor: sub.color } : {}} />
                    {sub.name}
                  </button>
                ))}
                {subjects.length === 0 && <span className="text-[10px] text-muted-foreground italic p-1">Fanlar mavjud emas</span>}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-50">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary hover:bg-primary/90">
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

      <AutoGenerateConfirmDialog
        open={autoGenerateConfirmOpen}
        count={totalVacancies}
        onClose={() => setAutoGenerateConfirmOpen(false)}
        onConfirm={() => {
          setAutoGenerateConfirmOpen(false);
          autoGenerateMutation.mutate();
        }}
      />

      <UnavailabilityDialog
        open={unavailTeacher !== null}
        onClose={() => setUnavailTeacher(null)}
        teacher={unavailTeacher ? (teachers.find(t => t.id === unavailTeacher.id) || unavailTeacher) : null}
        onSave={updateUnavailability}
        timeSlots={timeSlots}
      />

      <BulkAddTeachers 
        open={bulkOpen} 
        onClose={() => setBulkOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/teachers"] })}
        autoGenerateMutation={autoGenerateMutation}
      />

      <ExcelImportDialog 
        open={excelImportOpen} 
        onClose={() => setExcelImportOpen(false)} 
        type="teachers" 
      />
    </div>
  );
}

