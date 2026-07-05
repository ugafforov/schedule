import { useState, Fragment, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock, 
  CalendarX, Zap, LayoutGrid, List, ChevronRight, FileSpreadsheet 
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
      <DialogContent className="sm:max-w-md select-none" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarX className="h-6 w-6 text-red-500" />
            Bandlik cheklovlari
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-medium">{teacher.lastName} {teacher.firstName}</p>
        </DialogHeader>
        
        <div className="py-6">
          <div className="grid gap-2" style={{ gridTemplateColumns: `95px repeat(${daysToRender.length}, 1fr)` }}>
            <div />
            {daysToRender.map((day, dIdx) => (
              <button 
                key={day} 
                type="button"
                onClick={() => handleBulkToggle("day", dIdx + 1)}
                className="h-9 flex items-center justify-center font-bold text-[11px] text-muted-foreground hover:text-blue-600 hover:bg-blue-50 uppercase tracking-widest bg-muted/50/50 rounded-t-xl transition-all cursor-pointer border border-transparent hover:border-blue-100"
              >
                {day}
              </button>
            ))}

            {PERIODS.map(period => (
              <Fragment key={period}>
                <button 
                  type="button"
                  onClick={() => handleBulkToggle("period", period)}
                  className="h-14 flex flex-col justify-center pr-4 border-r-2 border-border text-right hover:bg-blue-50 transition-all cursor-pointer group rounded-l-xl"
                >
                  <span className="font-bold text-[11px] text-muted-foreground group-hover:text-blue-600 uppercase tracking-tighter leading-none">
                    {period}-soat
                  </span>
                  <span className="text-[10px] text-gray-300 group-hover:text-blue-400 font-medium mt-1 leading-none">
                    {getPeriodTime(period)}
                  </span>
                </button>
                {daysToRender.map((_, dIdx) => {
                  const dayNum = dIdx + 1;
                  const blocked = isSlotBlocked(dayNum, period);
                  return (
                    <div key={dIdx} className="h-14 flex items-center justify-center p-1">
                      <div
                        onMouseDown={() => handleMouseDown(dayNum, period)}
                        onMouseEnter={() => handleMouseEnter(dayNum, period)}
                        className={`w-full h-full rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                          blocked 
                            ? "bg-red-500 border-red-600 shadow-lg shadow-red-200 ring-2 ring-red-100 scale-[0.98]" 
                            : "bg-muted/50 border-border hover:border-blue-300 hover:bg-card hover:scale-105"
                        }`}
                      />
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          
          <div className="mt-8 flex gap-4 p-4 bg-muted/50 rounded-2xl border border-border items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-red-500 border-2 border-red-600" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Taqiqlangan</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-card border-2 border-border" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Ruxsat etilgan</span>
            </div>
          </div>
          
          <div className="mt-4 space-y-1">
            <p className="text-[10px] text-muted-foreground text-center italic">
              * Sichqonchani bosib turib surish — ko'p kataklarni tezkor belgilash
            </p>
            <p className="text-[10px] text-muted-foreground text-center italic">
              * Kun nomi yoki soat raqami ustiga bosish — to'liq qator/ustunni o'zgartirish
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90 h-11 text-base font-bold shadow-xl shadow-blue-100 rounded-xl">Tayyor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeacherCard({ 
  teacher, 
  subjects, 
  onEdit, 
  onDelete, 
  onOpenUnavail,
  onUpdateField 
}: { 
  teacher: Teacher; 
  subjects: Subject[]; 
  onEdit: (t: Teacher) => void; 
  onDelete: (id: number) => void; 
  onOpenUnavail: (t: Teacher) => void;
  onUpdateField: (id: number, field: string, value: any) => void;
}) {
  const teacherUnavail = (teacher as any).unavailability || [];
  const teacherSubs = (teacher as any).teacherSubjects || [];
  const isVacant = teacher.lastName?.toLowerCase().includes("vakant") || teacher.firstName?.toLowerCase().includes("vakant");

  return (
    <Card className={`group hover:shadow-md transition-all duration-300 border-border rounded-2xl overflow-hidden bg-card ${isVacant ? 'border-l-4 border-l-amber-500/80 bg-amber-500/10' : ''}`}>
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {isVacant ? (
              <div className="w-12 h-12 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-500 text-lg font-bold shadow-sm flex-shrink-0 animate-pulse" title="Tahrirlanmagan vakant o'qituvchi. F.I.O ni yozish uchun bosing.">
                V
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-primary-foreground text-lg font-bold shadow-sm flex-shrink-0">
                {teacher.firstName[0]}{teacher.lastName[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-col">
                <InlineEdit
                  value={`${teacher.lastName} ${teacher.firstName}`}
                  onSave={(val) => {
                    const parts = val.split(" ");
                    onUpdateField(teacher.id, "lastName", parts[0] || "");
                    onUpdateField(teacher.id, "firstName", parts.slice(1).join(" ") || "");
                  }}
                  className={`font-bold text-sm truncate ${isVacant ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
                  placeholder="F.I.O ni kiriting..."
                />
                {isVacant && (
                  <span className="text-[10px] text-amber-500 font-semibold animate-pulse ml-1.5 mt-0.5">
                    ⚠️ Haqiqiy F.I.O ni yozish uchun bosing
                  </span>
                )}
              </div>
              <InlineEdit
                value={teacher.specialization || "Mutaxassislik..."}
                onSave={(val) => onUpdateField(teacher.id, "specialization", val)}
                className="text-xs text-muted-foreground truncate block mt-0.5"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-primary" onClick={() => onEdit(teacher)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-red-500" onClick={() => onDelete(teacher.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-border px-1.5 py-0 text-[10px] font-mono">
            {teacher.employeeId}
          </Badge>
          {teacher.department && (
            <Badge variant="outline" className="text-[10px] border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10">
              {teacher.department}
            </Badge>
          )}
          {(teacher as any).gradeLevel && (
            <Badge variant="outline" className="text-[10px] border-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-500/10">
              {(teacher as any).gradeLevel === "primary" ? "1-4 sinf" : (teacher as any).gradeLevel === "high" ? "5-11 sinf" : "Barcha sinf"}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 border-y border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 text-muted-foreground/60" />
            <InlineEdit
              value={teacher.phone || "Tel..."}
              onSave={(val) => onUpdateField(teacher.id, "phone", val)}
              className="truncate"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
            <Clock className="h-3 w-3 text-primary" />
            <InlineEdit
              value={teacher.maxHoursPerWeek || 30}
              onSave={(val) => onUpdateField(teacher.id, "maxHoursPerWeek", parseInt(val) || 30)}
              type="number"
              className="font-bold text-foreground w-8"
            />
            <span>soat</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Fanlar</span>
            <span className="text-[10px] text-muted-foreground/80">{teacherSubs.length} ta</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
            {teacherSubs.length > 0 ? (
              teacherSubs.map((ts: any) => {
                const sub = subjects.find(s => s.id === ts.subjectId);
                return (
                  <Badge key={ts.id} variant="outline" className="text-[9px] py-0 px-1.5 border-border text-foreground" style={{ borderLeftColor: sub?.color, borderLeftWidth: '2px' }}>
                    {sub?.name}
                  </Badge>
                );
              })
            ) : (
              <span className="text-[10px] text-muted-foreground/30 italic">Fan yo'q</span>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={() => onOpenUnavail(teacher)}
            className="w-full flex items-center justify-between text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider hover:text-foreground transition-colors bg-muted/40 hover:bg-muted p-2 rounded-lg border border-border"
          >
            <div className="flex items-center gap-2">
              <CalendarX className="h-3.5 w-3.5 text-red-400" />
              <span>Bandlik cheklovlari</span>
            </div>
            <div className="flex items-center gap-1">
              {teacherUnavail.length > 0 && (
                <span className="bg-red-500/15 text-red-500 px-1.5 py-0.5 rounded-full text-[9px]">{teacherUnavail.length} ta</span>
              )}
              <ChevronRight className="h-3 w-3" />
            </div>
          </button>
        </div>
      </div>
    </Card>
  );
}

function TeacherRow({ 
  teacher, 
  subjects, 
  onEdit, 
  onDelete, 
  onOpenUnavail,
  onUpdateField 
}: { 
  teacher: Teacher; 
  subjects: Subject[]; 
  onEdit: (t: Teacher) => void; 
  onDelete: (id: number) => void; 
  onOpenUnavail: (t: Teacher) => void;
  onUpdateField: (id: number, field: string, value: any) => void;
}) {
  const teacherSubs = (teacher as any).teacherSubjects || [];
  const teacherUnavail = (teacher as any).unavailability || [];
  const isVacant = teacher.lastName?.toLowerCase().includes("vakant") || teacher.firstName?.toLowerCase().includes("vakant");

  return (
    <div className={`group grid grid-cols-[1.5fr_1fr_1fr_150px_100px] gap-4 items-center p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-all ${isVacant ? 'border-l-4 border-l-amber-500/80 bg-amber-500/5' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {isVacant ? (
          <div className="w-10 h-10 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-sm flex-shrink-0 animate-pulse">
            V
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {teacher.firstName[0]}{teacher.lastName[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <InlineEdit
              value={`${teacher.lastName} ${teacher.firstName}`}
              onSave={(val) => {
                const parts = val.split(" ");
                onUpdateField(teacher.id, "lastName", parts[0] || "");
                onUpdateField(teacher.id, "firstName", parts.slice(1).join(" ") || "");
              }}
              className={`font-semibold text-sm truncate ${isVacant ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
              placeholder="F.I.O ni kiriting..."
            />
            {isVacant && (
              <span className="text-[9px] text-amber-500 font-semibold animate-pulse whitespace-nowrap bg-amber-500/10 px-1 rounded border border-amber-500/20">
                ⚠️ Ism kiritish uchun bosing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground/60 font-mono">{teacher.employeeId}</span>
            <InlineEdit
              value={teacher.specialization || "Mutaxassislik..."}
              onSave={(val) => onUpdateField(teacher.id, "specialization", val)}
              className="text-[10px] text-muted-foreground truncate"
            />
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground truncate">
        {teacher.department || "—"}
      </div>

      <div className="flex flex-wrap gap-1 max-h-8 overflow-hidden">
        {teacherSubs.length > 0 ? (
          teacherSubs.slice(0, 3).map((ts: any) => {
            const sub = subjects.find(s => s.id === ts.subjectId);
            return (
              <Badge key={ts.id} variant="outline" className="text-[9px] py-0 px-1 border-border text-muted-foreground whitespace-nowrap">
                {sub?.name}
              </Badge>
            );
          })
        ) : (
          <span className="text-[10px] text-muted-foreground/30 italic">Biriktirilmagan</span>
        )}
        {teacherSubs.length > 3 && <span className="text-[9px] text-muted-foreground/60">+{teacherSubs.length - 3}</span>}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 text-primary" />
          <InlineEdit
            value={teacher.maxHoursPerWeek || 30}
            onSave={(val) => onUpdateField(teacher.id, "maxHoursPerWeek", parseInt(val) || 30)}
            type="number"
            className="font-bold w-6 text-foreground"
          />
        </div>
        <button 
          onClick={() => onOpenUnavail(teacher)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          title="Bandlik cheklovlarini boshqarish"
        >
          <CalendarX className={`h-3 w-3 ${teacherUnavail.length > 0 ? 'text-red-400' : 'text-muted-foreground/30'}`} />
          <span className="font-medium">{teacherUnavail.length}</span>
          <ChevronRight className="h-2.5 w-2.5" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-primary" onClick={() => onEdit(teacher)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-red-500" onClick={() => onDelete(teacher.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
  const [view, setView] = useState<"grid" | "list">("list");
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
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={() => setClearing(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Hammasini o'chirish
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(true)} className="border-emerald-100 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="border-blue-100 text-blue-700 hover:bg-blue-50">
            <Zap className="h-4 w-4 mr-1.5 text-amber-500" /> Ko'p qo'shish
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

      {/* Filters and View controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input 
            placeholder="F.I.O yoki kafedra bo'yicha qidirish..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2 self-end">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
            <Button 
              variant={view === "grid" ? "secondary" : "ghost"} 
              size="sm" 
              className={`h-7 w-8 p-0 ${view === "grid" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("grid")}
              title="Grid ko'rinishi"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant={view === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className={`h-7 w-8 p-0 ${view === "list" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("list")}
              title="Ro'yxat ko'rinishi"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Hech qanday o'qituvchi topilmadi</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-1">Qidiruv kriteriyasini o'zgartiring yoki yangi o'qituvchi qo'shing.</p>
          <Button variant="outline" className="mt-6 border-border hover:bg-muted text-foreground" onClick={() => setSearch("")}>Barcha o'qituvchilar</Button>
        </div>
      ) : (
        view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((teacher) => (
              <TeacherCard 
                key={teacher.id} 
                teacher={teacher} 
                subjects={subjects}
                onEdit={handleEdit}
                onDelete={id => setDeletingId(id)}
                onOpenUnavail={setUnavailTeacher}
                onUpdateField={updateField}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_150px_100px] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 rounded-xl border border-border">
              <div>O'qituvchi</div>
              <div>Kafedra</div>
              <div>Fanlar</div>
              <div>Yuklama / Bandlik</div>
              <div className="text-right">Amallar</div>
            </div>
            {filtered.map((teacher) => (
              <TeacherRow
                key={teacher.id}
                teacher={teacher}
                subjects={subjects}
                onEdit={handleEdit}
                onDelete={id => setDeletingId(id)}
                onOpenUnavail={setUnavailTeacher}
                onUpdateField={updateField}
              />
            ))}
          </div>
        )
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
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-muted/50">
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
                        ? "bg-primary text-primary-foreground shadow-md shadow-blue-100"
                        : "bg-card text-muted-foreground border border-border hover:border-blue-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${formData.subjectIds.includes(sub.id) ? "bg-card" : ""}`} style={!formData.subjectIds.includes(sub.id) ? { backgroundColor: sub.color } : {}} />
                    <span className="truncate">{sub.name}</span>
                  </button>
                ))}
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

