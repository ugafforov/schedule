import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Wand2, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Printer, Clock, RefreshCw,
  BookOpen, Users, DoorOpen, GraduationCap, UserCheck, GripVertical, FileText, FileSpreadsheet
} from "lucide-react";

import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, Room, TimeSlot, ScheduleEntry } from "@shared/schema";

const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return `${monday.getDate()}–${friday.getDate()} ${MONTHS[friday.getMonth()]} ${friday.getFullYear()}`;
}

type ViewMode = "class" | "teacher";

// --- Draggable & Droppable Components ---

function DraggableEntry({ 
  entry, 
  subject, 
  room, 
  teacherName, 
  className,
  viewMode,
  showAllClasses,
  onEdit,
  onDelete,
  isOverlay = false,
  isOptimistic = false
}: { 
  entry: ScheduleEntry; 
  subject?: Subject; 
  room?: Room; 
  teacherName: string;
  className: string;
  viewMode: ViewMode;
  showAllClasses: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
  isOptimistic?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: entry
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: (isDragging && !isOverlay) || isOptimistic ? 0.4 : 1,
    zIndex: isOverlay ? 1000 : undefined,
    borderLeft: `2px solid ${subject?.color || "#3B82F6"}`,
    backgroundColor: `${subject?.color || "#3B82F6"}15`,
    filter: isOptimistic ? "grayscale(50%)" : undefined,
  };

  const textColor = subject?.color || "#3B82F6";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md p-1 cursor-grab active:cursor-grabbing group/cell relative shadow-sm border border-transparent hover:border-blue-200 transition-all ${isOverlay ? 'shadow-lg rotate-1' : ''} ${isOptimistic ? 'animate-pulse' : ''}`}
      onClick={(e) => {
        if (!isDragging && !isOptimistic) onEdit();
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0" {...attributes} {...listeners}>
          <div className="flex items-center gap-1">
            <GripVertical className="h-2 w-2 text-gray-400 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0" />
            <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: textColor }}>
              {subject?.name || "?"}
            </p>
          </div>
          {viewMode === "class" && (showAllClasses
            ? <p className="text-[9px] text-gray-600 truncate leading-tight mt-0.5">{className}</p>
            : <p className="text-[9px] text-gray-500 truncate leading-tight mt-0.5">{teacherName}</p>
          )}
          {viewMode === "teacher" && (
            <p className="text-[9px] text-gray-600 truncate font-medium leading-tight mt-0.5">{className}</p>
          )}
          <p className="text-[9px] text-gray-400 leading-tight">{room?.roomNumber || ""}</p>
        </div>
        {!isOverlay && !isOptimistic && (
          <button
            className="opacity-0 group-hover/cell:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-0.5"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DroppableCell({ 
  id, 
  children,
  isOverClassName = "bg-blue-50/50",
  status = "idle" 
}: { 
  id: string; 
  children: React.ReactNode;
  isOverClassName?: string;
  status?: "idle" | "valid" | "invalid";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const statusClasses = {
    idle: "",
    valid: "bg-emerald-50/40 border border-dashed border-emerald-200",
    invalid: "bg-red-50/40 border border-dashed border-red-200 cursor-not-allowed opacity-60"
  };

  return (
    <td 
      ref={setNodeRef} 
      className={`py-0.5 px-0.5 align-top transition-all duration-200 ${statusClasses[status]} ${isOver ? isOverClassName : ""}`}
    >
      <div className="space-y-0.5 min-h-[40px]">
        {children}
      </div>
    </td>
  );
}

// --- Main Component ---

export default function Timetables() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("class");
  const [selectedClassId, setSelectedClassId] = useState<number | "all">("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [clearExisting, setClearExisting] = useState(true);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [editForm, setEditForm] = useState<{ subjectId: number; teacherId: number; roomId: number } | null>(null);
  const [generatorResult, setGeneratorResult] = useState<any>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<ScheduleEntry | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{
    draggedEntryId: number;
    targetSlotId: number;
    conflictingEntryId: number;
    conflictingClassName: string;
  } | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekStart = monday.toISOString();

  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ["/api/classes"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: teachers = [] } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ["/api/rooms"] });
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({ queryKey: ["/api/time-slots"] });
  const { data: conflicts = [] } = useQuery<any[]>({ queryKey: ["/api/schedule-conflicts"] });
  const { data: unavail = [] } = useQuery<any[]>({ queryKey: ["/api/teachers/unavailability"] });
  const { data: classSubjects = [] } = useQuery<any[]>({ queryKey: ["/api/class-subjects"] });

  const unavailSet = useMemo(() => new Set(unavail.map(u => `${u.teacherId}_${u.dayOfWeek}_${u.periodNumber}`)), [unavail]);

  const { data: allEntries = [], isLoading: loadingEntries } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule-entries", weekStart],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/schedule-entries?weekStart=${encodeURIComponent(weekStart)}`);
      return res.json();
    },
  });

  const missingLessons = useMemo(() => {
    if (viewMode !== "class" || selectedClassId === "all") return [];
    
    const required = classSubjects.filter(cs => cs.classId === selectedClassId);
    const scheduled = allEntries.filter(e => e.classId === selectedClassId);
    
    const missing: { subjectName: string; missingHours: number; color: string }[] = [];
    
    for (const req of required) {
      const scheduledCount = scheduled.filter(e => e.subjectId === req.subjectId).length;
      // Agar subject 2 ta o'qituvchiga bo'lingan bo'lsa, bitta dars 2 ta entry beradi. Shuning uchun teacherId2 borligini hisobga olamiz.
      const isSplit = !!req.teacherId2;
      const actualScheduledCount = isSplit ? Math.floor(scheduledCount / 2) : scheduledCount;
      
      const missingHours = req.weeklyHours - actualScheduledCount;
      if (missingHours > 0) {
        const sub = subjects.find(s => s.id === req.subjectId);
        missing.push({
          subjectName: sub?.name || "Noma'lum fan",
          missingHours,
          color: sub?.color || "#3B82F6"
        });
      }
    }
    return missing.sort((a, b) => b.missingHours - a.missingHours);
  }, [viewMode, selectedClassId, classSubjects, allEntries, subjects]);


  // moveEntryMutation with Optimistic UI
  const moveEntryMutation = useMutation({
    mutationFn: async ({ id, timeSlotId }: { id: number; timeSlotId: number }) => {
      const res = await apiRequest("PATCH", `/api/schedule-entries/${id}`, { timeSlotId });
      return res.json();
    },
    onMutate: async ({ id, timeSlotId }) => {
      await qc.cancelQueries({ queryKey: ["/api/schedule-entries", weekStart] });
      const previousEntries = qc.getQueryData<ScheduleEntry[]>(["/api/schedule-entries", weekStart]);
      if (previousEntries) {
        qc.setQueryData(["/api/schedule-entries", weekStart], 
          previousEntries.map(e => e.id === id ? { ...e, timeSlotId, isOptimistic: true } : e)
        );
      }
      return { previousEntries };
    },
    onError: (err, variables, context) => {
      if (context?.previousEntries) {
        qc.setQueryData(["/api/schedule-entries", weekStart], context.previousEntries);
      }
      toast({ title: "Xatolik", description: "Darsni ko'chirib bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries", weekStart] });
      qc.invalidateQueries({ queryKey: ["/api/schedule-conflicts"] });
    },
  });

  const getSlotStatus = (slotId: number): "idle" | "valid" | "invalid" => {
    if (!activeDragEntry) return "idle";
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return "idle";

    const isTeacherBusy = allEntries.some(e => e.id !== activeDragEntry.id && e.timeSlotId === slotId && e.teacherId === activeDragEntry.teacherId);
    const isTeacherUnavail = unavailSet.has(`${activeDragEntry.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`);
    const isClassBusy = allEntries.some(e => e.id !== activeDragEntry.id && e.timeSlotId === slotId && e.classId === activeDragEntry.classId);
    
    if (isTeacherBusy || isTeacherUnavail || isClassBusy) return "invalid";
    return "valid";
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const entry = active.data.current as ScheduleEntry;
    setActiveDragEntry(entry);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragEntry(null);

    if (over && active.id !== over.id) {
      const entryId = parseInt(String(active.id).replace('entry-', ''));
      const slotId = parseInt(String(over.id).replace('slot-', ''));
      
      if (!isNaN(entryId) && !isNaN(slotId)) {
        const draggedEntry = allEntries.find(e => e.id === entryId);

        // 1. Check teacher conflict in ANOTHER class
        const teacherConflict = allEntries.find(e => 
          e.timeSlotId === slotId && 
          e.teacherId === draggedEntry?.teacherId && 
          e.classId !== draggedEntry?.classId &&
          e.id !== entryId
        );

        if (teacherConflict) {
          setConflictWarning({
            draggedEntryId: entryId,
            targetSlotId: slotId,
            conflictingEntryId: teacherConflict.id,
            conflictingClassName: classes.find(c => c.id === teacherConflict.classId)?.name || "Boshqa sinf"
          });
          return;
        }

        const existingEntriesInSlot = allEntries.filter(e => e.timeSlotId === slotId && e.classId === draggedEntry?.classId && e.id !== entryId);

        let shouldReplace = false;
        let entryToReplaceId: number | null = null;

        if (existingEntriesInSlot.length > 0 && draggedEntry) {
          const target = existingEntriesInSlot[0];
          // Valid split class check: same subject, different teacher
          const isValidSplit = target.subjectId === draggedEntry.subjectId && target.teacherId !== draggedEntry.teacherId;
          
          if (!isValidSplit) {
            shouldReplace = true;
            entryToReplaceId = target.id;
          }
        }

        if (shouldReplace && entryToReplaceId) {
          // Replace: Fire both instantly for 0-latency feel
          deleteEntryMutation.mutate(entryToReplaceId);
          moveEntryMutation.mutate({ id: entryId, timeSlotId: slotId });
          toast({ title: "Dars siqib chiqarildi", description: "Avvalgi dars yetishmayotgan soatlar ro'yxatiga o'tdi." });
        } else {
          // Normal move or valid split class addition
          moveEntryMutation.mutate({ id: entryId, timeSlotId: slotId });
        }
      }
    }
  };

  const getSubject = (id: number) => subjects.find(s => s.id === id);
  const getTeacher = (id: number) => teachers.find(t => t.id === id);
  const getRoom = (id: number) => rooms.find(r => r.id === id);
  const teacherShortName = (id: number) => {
    const t = getTeacher(id);
    if (!t) return "";
    const fn = t.firstName || "";
    const ln = t.lastName || "";
    return ln ? `${ln} ${fn.charAt(0)}.` : fn || t.employeeId;
  };
  const classNameById = (id: number) => classes.find(c => c.id === id)?.name || "";

  const showAllClasses = selectedClassId === "all";

  const teacherEntries = useMemo(() => {
    if (!selectedTeacherId) return allEntries;
    return allEntries.filter(e => e.teacherId === selectedTeacherId);
  }, [allEntries, selectedTeacherId]);

  const classEntries = useMemo(() => {
    if (selectedClassId === "all") return allEntries;
    return allEntries.filter(e => e.classId === selectedClassId);
  }, [allEntries, selectedClassId]);

  const entries = viewMode === "teacher" ? teacherEntries : classEntries;

  const periods = useMemo(() => {
    const map = new Map<number, TimeSlot>();
    for (const slot of timeSlots) {
      if (!slot.isBreak && !map.has(slot.periodNumber)) {
        map.set(slot.periodNumber, slot);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
  }, [timeSlots]);

  const slotMap = useMemo(() => {
    const m = new Map<string, TimeSlot>();
    for (const slot of timeSlots) {
      if (!slot.isBreak) m.set(`${slot.dayOfWeek}_${slot.periodNumber}`, slot);
    }
    return m;
  }, [timeSlots]);

  const entryBySlot = useMemo(() => {
    const m = new Map<number, ScheduleEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.timeSlotId) || [];
      arr.push(e);
      m.set(e.timeSlotId, arr);
    }
    return m;
  }, [entries]);

  const generateMutation = useMutation({
    mutationFn: async ({ classIds }: { classIds?: number[] }) => {
      const res = await apiRequest("POST", "/api/generate-schedule", {
        weekStart, classIds: classIds || [], clearExisting
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setGeneratorResult(data);
      toast({ title: "Jadval yaratildi!", description: data.message });
    },
    onError: async (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Jadval yaratishda xatolik", variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/schedule-entries?weekStart=${weekStart}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setGeneratorResult(null);
      toast({ title: "Muvaffaqiyat", description: "Jadval tozalandi" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/schedule-entries/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      toast({ title: "Dars o'chirildi" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/schedule-entries/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      setEditEntry(null);
      toast({ title: "Dars yangilandi" });
    },
  });

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const tableData: any[][] = [];
    const headers = ["Dars", ...DAYS];
    periods.forEach((period, pi) => {
      const row = [`${pi + 1}-dars\n${period.startTime?.slice(0, 5)}–${period.endTime?.slice(0, 5)}`];
      DAYS.forEach((_, dayIdx) => {
        const slot = slotMap.get(`${dayIdx + 1}_${period.periodNumber}`);
        const slotEntries = slot ? entryBySlot.get(slot.id) || [] : [];
        const cellText = slotEntries.map(e => {
          const sub = getSubject(e.subjectId)?.name || "";
          const teacherOrClass = viewMode === "class" ? teacherShortName(e.teacherId) : classNameById(e.classId);
          const room = getRoom(e.roomId)?.roomNumber || "";
          return `${sub}\n${teacherOrClass} ${room ? `(${room})` : ""}`;
        }).join("\n---\n");
        row.push(cellText);
      });
      tableData.push(row);
    });
    const title = viewMode === "class" 
      ? (selectedClassId === "all" ? "Barcha sinflar dars jadvali" : `${classNameById(selectedClassId as number)} sinfi dars jadvali`)
      : (selectedTeacherId ? `${getTeacher(selectedTeacherId)?.firstName} ${getTeacher(selectedTeacherId)?.lastName} dars jadvali` : "Barcha o'qituvchilar dars jadvali");
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Hafta: ${weekLabel(monday)}`, 14, 22);
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2, minCellHeight: 20 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`jadval_${Date.now()}.pdf`);
  };

  const handleExportExcel = () => {
    const tableData: any[][] = [];
    const headers = ["Dars vaqti", ...DAYS];
    tableData.push(headers);
    periods.forEach((period, pi) => {
      const row = [`${pi + 1}-dars (${period.startTime?.slice(0, 5)}–${period.endTime?.slice(0, 5)})`];
      DAYS.forEach((_, dayIdx) => {
        const slot = slotMap.get(`${dayIdx + 1}_${period.periodNumber}`);
        const slotEntries = slot ? entryBySlot.get(slot.id) || [] : [];
        const cellText = slotEntries.map(e => {
          const sub = getSubject(e.subjectId)?.name || "";
          const teacherOrClass = viewMode === "class" ? teacherShortName(e.teacherId) : classNameById(e.classId);
          return `${sub} / ${teacherOrClass}`;
        }).join(" | ");
        row.push(cellText);
      });
      tableData.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadval");
    XLSX.writeFile(wb, `jadval_${Date.now()}.xlsx`);
  };

  return (
    <div className="p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dars jadvali</h1>
          <p className="text-gray-500 text-sm mt-0.5">Haftalik dars jadvalini boshqarish va yaratish</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-red-600 border-red-200 hover:bg-red-50">
            <FileText className="mr-1.5 h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-green-600 border-green-200 hover:bg-green-50">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="text-gray-600">
            <Printer className="mr-1.5 h-4 w-4" />Chop etish
          </Button>
          <Button
            variant="outline" size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />Tozalash
          </Button>
          <Button
            onClick={() => { setShowGenerator(!showGenerator); setGeneratorResult(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Wand2 className="mr-2 h-4 w-4" />Jadval yaratish
          </Button>
        </div>
      </div>

      {/* Generator Panel */}
      {showGenerator && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Avtomatik jadval yaratish</h3>
                  <p className="text-xs text-gray-500">Cheklovlar asosida optimal jadval tuziladi</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowGenerator(false); setGeneratorResult(null); }}>✕</Button>
            </div>

            {/* Pre-flight check */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Sinflar", count: classes.length, ok: classes.length > 0, icon: GraduationCap },
                { label: "O'qituvchilar", count: teachers.length, ok: teachers.length > 0, icon: Users },
                { label: "Xonalar", count: rooms.length, ok: rooms.length > 0, icon: DoorOpen },
              ].map(({ label, count, ok, icon: Icon }) => (
                <div key={label} className={`flex items-center space-x-2 p-2.5 rounded-lg ${ok ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                  <Icon className={`h-4 w-4 ${ok ? "text-green-600" : "text-red-500"}`} />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{label}</p>
                    <p className={`text-sm font-bold ${ok ? "text-green-700" : "text-red-600"}`}>{count} ta</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-3 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-gray-700">Mavjud jadvalini tozalab yangi yaratish</span>
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                onClick={() => generateMutation.mutate({})}
                disabled={generateMutation.isPending || classes.length === 0 || rooms.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generateMutation.isPending
                  ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Yaratilmoqda...</>
                  : <><Wand2 className="mr-2 h-4 w-4" />Barcha sinflar uchun jadval yaratish</>}
              </Button>
              {selectedClassId !== "all" && viewMode === "class" && (
                <Button variant="outline" onClick={() => generateMutation.mutate({ classIds: [selectedClassId as number] })} disabled={generateMutation.isPending}>
                  Faqat "{classes.find(c => c.id === selectedClassId)?.name}" sinfi uchun
                </Button>
              )}
            </div>

            {(classes.length === 0 || rooms.length === 0) && (
              <p className="text-xs text-red-600 mt-2">⚠ Jadval yaratish uchun avval sinflar va xonalar qo'shing, keyin sinflarga fan va o'qituvchi belgilang.</p>
            )}

            {/* Generation result summary */}
            {generatorResult && (
              <div className="mt-4 border-t border-blue-100 pt-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-gray-800">{generatorResult.count} ta dars yaratildi — {generatorResult.coverage}% qoplanish</span>
                </div>
                {generatorResult.classResults?.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {generatorResult.classResults.map((r: any) => (
                      <div key={r.className} className={`text-xs px-2.5 py-1.5 rounded-lg border ${r.coverage >= 100 ? "bg-green-50 border-green-200 text-green-700" : r.coverage >= 70 ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                        <span className="font-semibold">{r.className}</span>
                        <span className="ml-1 opacity-75">{r.scheduled}/{r.total} ({r.coverage}%)</span>
                      </div>
                    ))}
                  </div>
                )}
                {generatorResult.warnings?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {generatorResult.warnings.map((w: string, i: number) => (
                      <div key={i} className="flex items-center space-x-1.5 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main schedule card */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Week nav */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekOffset(w => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center space-x-2 px-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">{weekLabel(monday)}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekOffset(w => w + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 text-blue-600" onClick={() => setWeekOffset(0)}>
                  Bugungi hafta
                </Button>
              )}
            </div>
            {/* Conflicts */}
            <div className="flex items-center space-x-2">
              {conflicts.length > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="mr-1 h-3 w-3" />{conflicts.length} ta ziddiyat
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />Ziddiyatsiz
                </Badge>
              )}
              <span className="text-xs text-gray-400">{entries.length} ta dars</span>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center space-x-3 mt-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("class")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "class" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Sinf bo'yicha</span>
              </button>
              <button
                onClick={() => setViewMode("teacher")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "teacher" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>O'qituvchi bo'yicha</span>
              </button>
            </div>

            {/* Class tabs */}
            {viewMode === "class" && (
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  onClick={() => setSelectedClassId("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${selectedClassId === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Barchasi
                </button>
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${selectedClassId === cls.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            )}

            {/* Teacher selector */}
            {viewMode === "teacher" && (
              <div className="flex items-center space-x-2 flex-1">
                <Select
                  value={selectedTeacherId ? String(selectedTeacherId) : "all"}
                  onValueChange={v => setSelectedTeacherId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger className="h-8 text-xs w-56">
                    <SelectValue placeholder="O'qituvchi tanlang..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha o'qituvchilar</SelectItem>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {`${t.firstName} ${t.lastName}`.trim() || t.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTeacherId && (
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                    <span>{teacherEntries.length} ta dars</span>
                    {teachers.find(t => t.id === selectedTeacherId)?.maxHoursPerWeek && (
                      <span className="text-gray-400">/ {teachers.find(t => t.id === selectedTeacherId)?.maxHoursPerWeek} max</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Missing Lessons Indicator */}
          {missingLessons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-start space-x-2">
              <span className="text-xs font-semibold text-gray-500 whitespace-nowrap mt-0.5">Yetishmayotgan soatlar:</span>
              <div className="flex flex-wrap gap-1.5">
                {missingLessons.map((ml, idx) => (
                  <div key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center space-x-1 shadow-sm" style={{ borderColor: ml.color, backgroundColor: `${ml.color}15`, color: ml.color }}>
                    <span>{ml.subjectName}</span>
                    <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center font-bold">{ml.missingHours}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loadingEntries ? (
            <div className="space-y-2">
              {Array(6).fill(0).map((_, i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />)}
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-600">Vaqt uyalari yuklanmoqda...</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <DndContext 
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 w-24">Dars</th>
                      {DAYS.map((day, i) => (
                        <th key={day} className="text-center py-2 px-1 text-xs font-semibold text-gray-700 w-1/5">
                          <div>{day}</div>
                          <div className="text-gray-400 font-normal">{(() => {
                            const d = new Date(monday);
                            d.setDate(monday.getDate() + i);
                            return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
                          })()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period, pi) => (
                      <tr key={period.id} className={pi % 2 === 0 ? "bg-gray-50/50" : "bg-white"}>
                        <td className="py-2 px-3">
                          <div className="text-xs font-semibold text-gray-700">{pi + 1}-dars</div>
                          <div className="text-xs text-gray-400 font-mono">
                            {period.startTime?.slice(0, 5)}–{period.endTime?.slice(0, 5)}
                          </div>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const dayNum = dayIdx + 1;
                          const slot = slotMap.get(`${dayNum}_${period.periodNumber}`);
                          if (!slot) return <td key={dayIdx} className="py-1 px-1" />;
                          const slotEntries = entryBySlot.get(slot.id) || [];

                          return (
                            <DroppableCell 
                              key={dayIdx} 
                              id={`slot-${slot.id}`}
                              status={getSlotStatus(slot.id)}
                            >
                              {slotEntries.map(entry => {
                                const sub = getSubject(entry.subjectId);
                                const room = getRoom(entry.roomId);
                                
                                return (
                                  <DraggableEntry
                                    key={entry.id}
                                    entry={entry}
                                    subject={sub}
                                    room={room}
                                    teacherName={teacherShortName(entry.teacherId)}
                                    className={classNameById(entry.classId)}
                                    viewMode={viewMode}
                                    showAllClasses={showAllClasses}
                                    isOptimistic={(entry as any).isOptimistic}
                                    onEdit={() => {
                                      setEditEntry(entry);
                                      setEditForm({ subjectId: entry.subjectId, teacherId: entry.teacherId, roomId: entry.roomId });
                                    }}
                                    onDelete={() => deleteEntryMutation.mutate(entry.id)}
                                  />
                                );
                              })}
                            </DroppableCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <DragOverlay dropAnimation={{
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                      active: {
                        opacity: '0.4',
                      },
                    },
                  }),
                }}>
                  {activeDragEntry ? (
                    <DraggableEntry
                      entry={activeDragEntry}
                      subject={getSubject(activeDragEntry.subjectId)}
                      room={getRoom(activeDragEntry.roomId)}
                      teacherName={teacherShortName(activeDragEntry.teacherId)}
                      className={classNameById(activeDragEntry.classId)}
                      viewMode={viewMode}
                      showAllClasses={showAllClasses}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editEntry && editForm && (
        <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Darsni tahrirlash</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Fan</label>
                <Select value={String(editForm.subjectId)} onValueChange={v => setEditForm(p => p ? { ...p, subjectId: parseInt(v) } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">O'qituvchi</label>
                <Select value={String(editForm.teacherId)} onValueChange={v => setEditForm(p => p ? { ...p, teacherId: parseInt(v) } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {`${t.firstName} ${t.lastName}`.trim() || t.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Xona</label>
                <Select value={String(editForm.roomId)} onValueChange={v => setEditForm(p => p ? { ...p, roomId: parseInt(v) } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.roomNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white mr-auto order-first"
                variant="destructive"
                onClick={() => { deleteEntryMutation.mutate(editEntry.id); setEditEntry(null); }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />O'chirish
              </Button>
              <Button variant="outline" onClick={() => setEditEntry(null)}>Bekor qilish</Button>
              <Button
                onClick={() => updateEntryMutation.mutate({ id: editEntry.id, data: editForm })}
                disabled={updateEntryMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Conflict Warning Dialog */}
      {conflictWarning && (
        <Dialog open={!!conflictWarning} onOpenChange={() => setConflictWarning(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                O'qituvchi band!
              </DialogTitle>
            </DialogHeader>
            <div className="py-3">
              <p className="text-sm text-gray-700">
                Bu o'qituvchining ushbu vaqtda <strong>{conflictWarning.conflictingClassName}</strong> sinfida darsi bor.
                <br /><br />
                O'sha darsni zaxiraga (yetishmayotganlar ro'yxatiga) olib, darsni bu yerga joylashtiraylikmi?
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConflictWarning(null)}>Bekor qilish</Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  deleteEntryMutation.mutate(conflictWarning.conflictingEntryId);
                  moveEntryMutation.mutate({ id: conflictWarning.draggedEntryId, timeSlotId: conflictWarning.targetSlotId });
                  setConflictWarning(null);
                  toast({ title: "O'zgartirildi", description: "Dars ko'chirildi va avvalgisi zaxiraga olindi." });
                }}
              >
                Ha, almashtirish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
