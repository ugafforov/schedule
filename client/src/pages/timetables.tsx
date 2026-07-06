import { useState, useMemo, useEffect, Children } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Wand2, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Printer, Clock, RefreshCw,
  BookOpen, Users, DoorOpen, GraduationCap, UserCheck, GripVertical, FileText, FileSpreadsheet,
  Move, Pencil, Link2
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
} from '@dnd-kit/core';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, Room, TimeSlot, ScheduleEntry } from "@shared/schema";

const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];

type ViewMode = "class" | "teacher";

// --- Draggable & Droppable Components ---

function DraggableSubjectCard({
  subject,
  missingHours,
  teacherId,
  teacherId2,
  classId,
  isSelected,
  onClick,
  isHoldingSubject = false
}: {
  subject: Subject;
  missingHours: number;
  teacherId?: number;
  teacherId2?: number;
  classId: number;
  isSelected?: boolean;
  onClick?: () => void;
  isHoldingSubject?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-subject-${subject.id}`,
    data: { type: 'new-subject', subjectId: subject.id, teacherId, teacherId2, classId }
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
    borderColor: subject.color,
    backgroundColor: isSelected ? `${subject.color}35` : `${subject.color}15`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-1.5 rounded border-2 hover:shadow-sm transition-[background-color,border-color,box-shadow,opacity] duration-150 cursor-pointer ${
        isSelected ? "ring-2 ring-blue-500 ring-offset-1 font-bold" : ""
      }`}
      onClick={(e) => {
        if (isHoldingSubject) {
          // Let the click bubble to DroppableSidebar
          return;
        }
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-semibold truncate" style={{ color: subject.color }}>
            {subject.name}
          </p>
          <p className="text-[8px] text-muted-foreground/60">
            {missingHours} soat
          </p>
        </div>
        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-primary-foreground" style={{ backgroundColor: subject.color }}>
          {missingHours}
        </div>
      </div>
    </div>
  );
}


function EntryCard({
  entry,
  subject,
  room,
  teacherName,
  className,
  viewMode,
  showAllClasses,
  onEdit,
  onDelete,
  onMoveSelect,
  isOverlay = false,
  isOptimistic = false,
  isDragging = false,
  dragListeners,
  dragAttributes,
  innerRef,
  style,
  isHoldingSubject = false,
  isCompact = false,
  onToggleWeekType
}: {
  entry: ScheduleEntry;
  subject?: Subject;
  room?: Room;
  teacherName: string;
  className: string;
  viewMode: ViewMode;
  showAllClasses: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveSelect?: () => void;
  isOverlay?: boolean;
  isOptimistic?: boolean;
  isDragging?: boolean;
  dragListeners?: any;
  dragAttributes?: any;
  innerRef?: (element: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isHoldingSubject?: boolean;
  isCompact?: boolean;
  onToggleWeekType?: () => void;
}) {
  const isNoRoom = !room;
  const textColor = subject?.color || "#3B82F6";
  const cardStyle: React.CSSProperties = {
    border: isNoRoom ? `1.5px dashed #EF4444` : `1.5px solid transparent`,
    borderLeft: `3px solid ${subject?.color || "#3B82F6"}`,
    backgroundColor: isOverlay ? `${subject?.color || "#3B82F6"}25` : `${subject?.color || "#3B82F6"}20`,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    ...style
  };

  return (
    <div
      ref={innerRef}
      style={cardStyle}
      className={`rounded cursor-grab active:cursor-grabbing group/cell relative shadow-sm hover:shadow-md transition-[background-color,border-color,box-shadow] duration-75 flex-1 flex flex-col justify-center ${
        isCompact ? "p-1 py-0.5" : "p-1"
      } ${isOverlay ? 'shadow-lg rotate-1 scale-[1.03] bg-card border-border z-[1000] text-card-foreground' : 'text-foreground'}`}
      onClick={(e) => {
        if (isHoldingSubject) {
          // Let click bubble to DroppableCell or DroppableSidebar
          return;
        }
        if (!isDragging && !isOptimistic && !isOverlay) {
          e.stopPropagation();
          if (onMoveSelect) {
            onMoveSelect();
          }
        }
      }}
      onDoubleClick={(e) => {
        if (isHoldingSubject) return;
        if (!isDragging && !isOptimistic && !isOverlay && onEdit) {
          e.stopPropagation();
          onEdit();
        }
      }}
    >
      <div className="flex items-start justify-between gap-0.5">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5" {...dragAttributes} {...dragListeners}>
          <div className={`flex items-center gap-1 w-full ${isCompact ? "" : "mb-0.5"}`}>
            <GripVertical className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0 -ml-1" />
            <span className={`${isCompact ? "text-[9px]" : "text-[10.5px]"} font-bold leading-tight truncate max-w-[70%]`} style={{ color: textColor }}>
              {subject?.name || "?"}
            </span>
            {entry.jointLessonId && (
              <span title="Birlashtirilgan dars">
                <Link2 className="h-3 w-3 text-muted-foreground/60 flex-shrink-0 ml-0.5" />
              </span>
            )}
            {entry.weekType && entry.weekType !== "always" && (
              <span 
                title={entry.weekType === "surat" ? "Surat (Toq hafta). Mahrajga o'tkazish uchun bosing." : "Mahraj (Juft hafta). Suratga o'tkazish uchun bosing."}
                className={`text-[6.5px] leading-none px-0.5 py-0.5 rounded font-bold ml-auto flex-shrink-0 text-primary-foreground cursor-pointer hover:opacity-80 active:scale-95 transition-all ${entry.weekType === "surat" ? "bg-emerald-600" : "bg-purple-600"}`}
                onClick={(e) => {
                  if (onToggleWeekType) {
                    e.stopPropagation();
                    onToggleWeekType();
                  }
                }}
              >
                {entry.weekType === "surat" ? "Surat" : "Mahraj"}
              </span>
            )}
          </div>
          
          {isCompact ? (
            <div className="text-[7.5px] text-muted-foreground/80 truncate flex items-center justify-between gap-1 mt-0.5 leading-none">
              <span className="truncate">
                {viewMode === "class" && showAllClasses 
                  ? className 
                  : viewMode === "class" 
                    ? teacherName 
                    : className}
              </span>
              <span className={`flex-shrink-0 ${isNoRoom ? "text-red-600 font-bold" : "text-muted-foreground/60"}`}>
                ({room?.roomNumber || "Xona yo'q"})
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 text-muted-foreground">
                {viewMode === "class" && showAllClasses ? (
                  <><GraduationCap className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" /><span className="text-[9px] font-medium truncate">{className}</span></>
                ) : viewMode === "class" ? (
                  <><UserCheck className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" /><span className="text-[9px] truncate">{teacherName}</span></>
                ) : (
                  <><GraduationCap className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" /><span className="text-[9px] font-medium truncate">{className}</span></>
                )}
              </div>

              <div className={`flex items-center gap-1 ${isNoRoom ? "text-red-600 font-semibold" : "text-muted-foreground/60"}`}>
                {isNoRoom ? <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" /> : <DoorOpen className="h-2.5 w-2.5 flex-shrink-0" />}
                <span className="text-[9px] truncate">{room?.roomNumber || "Xona yo'q"}</span>
              </div>
            </>
          )}
        </div>
        
        {!isHoldingSubject && (
          <div className="flex items-center gap-0.5 absolute right-0.5 top-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-card/90 rounded border border-border shadow-sm p-0.5">
            {!isOverlay && !isOptimistic && onEdit && (
              <button
                className="text-muted-foreground/60 hover:text-foreground p-0.5"
                onClick={e => { e.stopPropagation(); onEdit(); }}
                title="Tahrirlash"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
            {!isOverlay && !isOptimistic && onDelete && (
              <button
                className="text-red-400 hover:text-red-600 p-0.5"
                onClick={e => { e.stopPropagation(); onDelete(); }}
                title="O'chirish"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
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
  onMoveSelect,
  isSelected = false,
  isOptimistic = false,
  isHoldingSubject = false,
  isCompact = false,
  onToggleWeekType
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
  onMoveSelect?: () => void;
  isSelected?: boolean;
  isOptimistic?: boolean;
  isHoldingSubject?: boolean;
  isCompact?: boolean;
  onToggleWeekType?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: entry
  });

  return (
    <EntryCard
      entry={entry}
      subject={subject}
      room={room}
      teacherName={teacherName}
      className={className}
      viewMode={viewMode}
      showAllClasses={showAllClasses}
      onEdit={onEdit}
      onDelete={onDelete}
      onMoveSelect={onMoveSelect}
      style={isSelected ? { outline: "2px solid #2563EB", outlineOffset: "1px", fontWeight: "bold" } : undefined}
      isOptimistic={isOptimistic}
      isDragging={isDragging}
      dragListeners={listeners}
      dragAttributes={attributes}
      innerRef={setNodeRef}
      isHoldingSubject={isHoldingSubject}
      isCompact={isCompact}
      onToggleWeekType={onToggleWeekType}
    />
  );
}

function DroppableCell({ 
  id, 
  children,
  status = "idle",
  onClick
}: { 
  id: string; 
  children: React.ReactNode;
  status?: "idle" | "valid" | "invalid";
  onClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const statusClasses = {
    idle: "",
    valid: "bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset cursor-pointer hover:bg-emerald-500/20",
    invalid: "bg-red-500/10 ring-1 ring-red-500/20 ring-inset opacity-50 cursor-not-allowed"
  };

  return (
    <td 
      ref={setNodeRef} 
      style={{ height: "58px" }}
      className={`py-0.5 px-0.5 align-top h-[58px] transition-colors duration-100 ${statusClasses[status]} ${isOver && status !== "invalid" ? "bg-emerald-500/20 ring-2 ring-emerald-500/40 ring-inset" : ""}`}
      onClick={(e) => {
        if (status === "valid" && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className="space-y-0.5 h-full flex flex-col justify-center">
        {children}
      </div>
    </td>
  );
}


function DroppableSidebar({ 
  id, 
  children,
  onClick,
  isHighlighted = false
}: { 
  id: string; 
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`w-48 flex-shrink-0 space-y-2 p-2 rounded-lg border-2 border-dashed transition-all duration-200 ${
        isOver
          ? "border-red-500 bg-red-500/15 scale-[1.02] shadow-sm"
          : isHighlighted
            ? "border-red-500 bg-red-500/5 cursor-pointer hover:bg-red-500/10 shadow-sm"
            : "border-transparent bg-muted/20"
      }`}
    >
      {children}
    </div>
  );
}


// --- Main Component ---

export default function Timetables() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("class");
  const [selectedClassId, setSelectedClassId] = useState<number | "all">("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [clearExisting, setClearExisting] = useState(true);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [editForm, setEditForm] = useState<{ subjectId: number; teacherId: number; roomId: number; weekType: string } | null>(null);
  const [generatorResult, setGeneratorResult] = useState<any>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<ScheduleEntry | null>(null);
  const [activeDragNewSubject, setActiveDragNewSubject] = useState<{ subjectId: number; teacherId?: number; classId: number } | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{
    draggedEntryId: number;
    targetSlotId: number;
    conflictingEntryId: number;
    conflictingClassName: string;
  } | null>(null);
  const [selectedSubjectToPlace, setSelectedSubjectToPlace] = useState<{
    subjectId: number;
    teacherId?: number;
    teacherId2?: number;
    classId: number;
    sourceEntryId?: number;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSubjectToPlace(null);
      }
    };
    
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const previewEl = document.getElementById("floating-cursor-preview");
        if (previewEl) {
          previewEl.style.transform = `translate3d(${e.clientX + 15}px, ${e.clientY + 15}px, 0)`;
        }
      });
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (!selectedSubjectToPlace) return;
      const target = e.target as HTMLElement;

      // 1. If clicked inside a valid timetable slot, allow it to place
      const validCell = target.closest('td[data-status="valid"]');
      if (validCell) return;

      // 2. If clicked on a card to select it (in sidebar or grid), allow it
      const isCardClick = target.closest('.cursor-pointer') || target.closest('.cursor-grab') || target.closest('[id="sidebar"]') || target.closest('[title="Tahrirlash"]');
      if (isCardClick) return;

      // Otherwise, cancel the selection and return it to the sidebar
      setSelectedSubjectToPlace(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleDocumentClick, true); // Use capture phase
    
    if (selectedSubjectToPlace) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selectedSubjectToPlace]);





  const { toast } = useToast();
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );


  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ["/api/classes"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: teachers = [] } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ["/api/rooms"] });
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({ queryKey: ["/api/time-slots"] });
  const { data: conflicts = [] } = useQuery<any[]>({
    queryKey: ["/api/schedule-conflicts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schedule-conflicts");
      return res.json();
    }
  });
  const { data: unavail = [] } = useQuery<any[]>({ queryKey: ["/api/teachers/unavailability"] });
  const { data: classSubjects = [] } = useQuery<any[]>({ queryKey: ["/api/class-subjects"] });

  const unavailSet = useMemo(() => new Set(unavail.map(u => `${u.teacherId}_${u.dayOfWeek}_${u.periodNumber}`)), [unavail]);

  const daysToRender = useMemo(() => {
    const defaultDays = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];
    
    // If viewing a specific class
    if (selectedClassId && selectedClassId !== "all") {
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls && cls.studyDays) {
        const days = cls.studyDays.split(",").map(Number);
        if (days.includes(6)) {
          return [...defaultDays, "Shanba"];
        }
      }
      return defaultDays;
    }
    
    // If viewing "All" classes or "By Teacher", show Saturday if ANY class has Saturday enabled
    const anyClassHasSaturday = classes.some(c => c.studyDays && c.studyDays.includes("6"));
    if (anyClassHasSaturday) {
      return [...defaultDays, "Shanba"];
    }
    return defaultDays;
  }, [selectedClassId, classes]);

  const { data: allEntries = [], isLoading: loadingEntries } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule-entries"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schedule-entries");
      return res.json();
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/schedule-entries", data);
      return res.json();
    },
    onMutate: async (data: any) => {
      await qc.cancelQueries({ queryKey: ["/api/schedule-entries"] });
      const previousEntries = qc.getQueryData<ScheduleEntry[]>(["/api/schedule-entries"]);
      // Optimistic: create a fake entry with a negative temp ID
      const tempEntry: any = {
        id: -Date.now(),
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        timeSlotId: data.timeSlotId,
        weekType: data.weekType || "always",
        isActive: true,
        createdAt: new Date(),
        isOptimistic: true,
      };
      if (previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], [...previousEntries, tempEntry]);
      }
      return { previousEntries };
    },
    onSuccess: () => {
      toast({ title: "Dars qo'shildi" });
    },
    onError: (err, variables, context) => {
      if (context?.previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], context.previousEntries);
      }
      toast({ title: "Xatolik", description: "Darsni qo'shib bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
    },
  });

  const missingLessons = useMemo(() => {
    if (viewMode !== "class" || selectedClassId === "all") return [];
    
    const required = classSubjects.filter(cs => cs.classId === selectedClassId);
    const scheduled = allEntries.filter(e => e.classId === selectedClassId);
    
    const missing: { subjectName: string; missingHours: number; color: string }[] = [];
    
    for (const req of required) {
      const scheduledInSlot = scheduled.filter(e => e.subjectId === req.subjectId);
      const scheduledCount = scheduledInSlot.reduce((sum, e) => sum + (e.weekType === "surat" || e.weekType === "mahraj" ? 0.5 : 1), 0);
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

  const classMissingHoursMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const cls of classes) {
      const required = classSubjects.filter(cs => cs.classId === cls.id);
      const scheduled = allEntries.filter(e => e.classId === cls.id);
      let missingHoursSum = 0;
      
      for (const req of required) {
        const scheduledInSlot = scheduled.filter(e => e.subjectId === req.subjectId);
        const scheduledCount = scheduledInSlot.reduce((sum, e) => sum + (e.weekType === "surat" || e.weekType === "mahraj" ? 0.5 : 1), 0);
        const isSplit = !!req.teacherId2;
        const actualScheduledCount = isSplit ? Math.floor(scheduledCount / 2) : scheduledCount;
        
        const missing = req.weeklyHours - actualScheduledCount;
        if (missing > 0) {
          missingHoursSum += missing;
        }
      }
      if (missingHoursSum > 0) {
        map[cls.id] = missingHoursSum;
      }
    }
    return map;
  }, [classes, classSubjects, allEntries]);


  // moveEntryMutation with Optimistic UI
  const moveEntryMutation = useMutation({
    mutationFn: async ({ id, timeSlotId }: { id: number; timeSlotId: number }) => {
      const res = await apiRequest("PATCH", `/api/schedule-entries/${id}`, { timeSlotId });
      return res.json();
    },
    onMutate: async ({ id, timeSlotId }) => {
      await qc.cancelQueries({ queryKey: ["/api/schedule-entries"] });
      const previousEntries = qc.getQueryData<ScheduleEntry[]>(["/api/schedule-entries"]);
      if (previousEntries) {
        qc.setQueryData(["/api/schedule-entries"],
          previousEntries.map(e => e.id === id ? { ...e, timeSlotId, isOptimistic: true } : e)
        );
      }
      return { previousEntries };
    },
    onError: (err, variables, context) => {
      if (context?.previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], context.previousEntries);
      }
      toast({ title: "Xatolik", description: "Darsni ko'chirib bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/schedule-conflicts"] });
    },
  });

  const getSlotStatus = (slotId: number): "idle" | "valid" | "invalid" => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return "idle";

    // Support both active drag-and-drop and click-to-place selections
    const activeSubject = activeDragNewSubject || (selectedSubjectToPlace && !selectedSubjectToPlace.sourceEntryId ? selectedSubjectToPlace : null);
    const activeEntry = activeDragEntry || (selectedSubjectToPlace && selectedSubjectToPlace.sourceEntryId ? allEntries.find(e => e.id === selectedSubjectToPlace.sourceEntryId) : null);

    if (activeSubject) {
      const { subjectId, teacherId, classId } = activeSubject;
      const isClassBusy = allEntries.some(e => e.timeSlotId === slotId && e.classId === classId && (!activeEntry || e.id !== activeEntry.id));
      const isTeacherBusy = teacherId ? allEntries.some(e => e.timeSlotId === slotId && e.teacherId === teacherId && (!activeEntry || e.id !== activeEntry.id)) : false;
      const isTeacherUnavail = teacherId ? unavailSet.has(`${teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`) : false;
      if (isClassBusy || isTeacherBusy || isTeacherUnavail) return "invalid";
      return "valid";
    }

    if (activeEntry) {
      const isJoint = !!activeEntry.jointLessonId;
      const isTeacherBusy = allEntries.some(e => 
        e.id !== activeEntry.id && 
        (!isJoint || e.jointLessonId !== activeEntry.jointLessonId) &&
        e.timeSlotId === slotId && 
        e.teacherId === activeEntry.teacherId
      );
      const isTeacherUnavail = unavailSet.has(`${activeEntry.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`);
      const isClassBusy = allEntries.some(e => 
        e.id !== activeEntry.id && 
        (!isJoint || e.jointLessonId !== activeEntry.jointLessonId) &&
        e.timeSlotId === slotId && 
        e.classId === activeEntry.classId
      );
      
      if (isTeacherBusy || isTeacherUnavail || isClassBusy) return "invalid";
      return "valid";
    }

    return "idle";
  };


  const handleDragStart = (event: any) => {
    const { active } = event;
    const data = active.data.current as any;
    if (data?.type === 'new-subject') {
      setActiveDragNewSubject({ subjectId: data.subjectId, teacherId: data.teacherId, classId: data.classId });
    } else {
      setActiveDragEntry(data as ScheduleEntry);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragEntry(null);
    setActiveDragNewSubject(null);

    if (over && active.id !== over.id) {
      const activeData = active.data.current as any;
      
      // NEW: Handle dragging entry back to sidebar to remove it
      if (over.id === 'sidebar') {
        const entryId = parseInt(String(active.id).replace('entry-', ''));
        if (!isNaN(entryId)) {
          deleteEntryMutation.mutate(entryId);
          toast({ title: "Dars olib tashlandi" });
          return;
        }
      }

      // NEW: Handle dragging from sidebar (new subject)
      if (activeData?.type === 'new-subject') {
        const slotId = parseInt(String(over.id).replace('slot-', ''));
        if (isNaN(slotId)) return;

        const slot = timeSlots.find(s => s.id === slotId);
        if (!slot) return;

        const { subjectId, teacherId, teacherId2, classId } = activeData;

        // Check conflicts
        const existingInSlot = allEntries.filter(e => e.timeSlotId === slotId && e.classId === classId);
        
        let targetWeekType = "always";

        if (existingInSlot.length > 0) {
          const hasAlways = existingInSlot.some(e => e.weekType === "always");
          const isFullAlternate = existingInSlot.length >= 2;
          
          if (hasAlways || isFullAlternate) {
            toast({ title: "Bu uyada allaqachon dars bor", variant: "destructive" });
            return;
          }

          const target = existingInSlot[0];
          if (target.weekType === "surat") {
            targetWeekType = "mahraj";
          } else if (target.weekType === "mahraj") {
            targetWeekType = "surat";
          } else {
            toast({ title: "Bu uyada allaqachon dars bor", variant: "destructive" });
            return;
          }
        }

        // Teacher conflict check
        if (teacherId) {
          const teacherConflict = allEntries.find(e => 
            e.timeSlotId === slotId && 
            e.teacherId === teacherId && 
            e.classId !== classId &&
            (e.weekType === "always" || targetWeekType === "always" || e.weekType === targetWeekType)
          );
          if (teacherConflict) {
            toast({ title: "O'qituvchi bu vaqtda boshqa sinfda", variant: "destructive" });
            return;
          }
          const isUnavail = unavailSet.has(`${teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`);
          if (isUnavail) {
            toast({ title: "O'qituvchi bu vaqtda mavjud emas", variant: "destructive" });
            return;
          }
        }

        // Find available room
        const roomsInUse = allEntries
          .filter(e => e.timeSlotId === slotId && (e.weekType === "always" || targetWeekType === "always" || e.weekType === targetWeekType))
          .map(e => e.roomId);
        const availableRoom = rooms.find(r => !roomsInUse.includes(r.id));
        
        if (!availableRoom) {
          toast({ title: "Bu vaqtda bo'sh xona yo'q", variant: "destructive" });
          return;
        }

        // Create new entry
        createEntryMutation.mutate({
          classId,
          subjectId,
          teacherId: teacherId || 0,
          roomId: availableRoom.id,
          timeSlotId: slotId,
          weekType: targetWeekType,
        });
        return;
      }

      // EXISTING: Move existing entry
      const entryId = parseInt(String(active.id).replace('entry-', ''));
      const slotId = parseInt(String(over.id).replace('slot-', ''));
      
      if (!isNaN(entryId) && !isNaN(slotId)) {
        const draggedEntry = allEntries.find(e => e.id === entryId);

        // If dropping onto the SAME slot and it is an alternating week entry, toggle its weekType!
        if (draggedEntry && draggedEntry.timeSlotId === slotId && draggedEntry.weekType !== "always") {
          const newWeekType = draggedEntry.weekType === "surat" ? "mahraj" : "surat";
          updateEntryMutation.mutate({
            id: entryId,
            data: {
              subjectId: draggedEntry.subjectId,
              teacherId: draggedEntry.teacherId,
              roomId: draggedEntry.roomId,
              weekType: newWeekType
            }
          });
          toast({ title: newWeekType === "surat" ? "Dars Suratga o'tkazildi" : "Dars Mahrajga o'tkazildi" });
          return;
        }

        const teacherConflict = allEntries.find(e => 
          e.timeSlotId === slotId && 
          e.teacherId === draggedEntry?.teacherId && 
          e.classId !== draggedEntry?.classId &&
          e.id !== entryId &&
          draggedEntry &&
          (e.weekType === "always" || draggedEntry.weekType === "always" || e.weekType === draggedEntry.weekType)
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
          const isOverlap = target.weekType === "always" || draggedEntry.weekType === "always" || target.weekType === draggedEntry.weekType;
          
          if (isOverlap) {
            const isValidSplit = target.subjectId === draggedEntry.subjectId && target.teacherId !== draggedEntry.teacherId;
            if (!isValidSplit) {
              shouldReplace = true;
              entryToReplaceId = target.id;
            }
          }
        }

        if (shouldReplace && entryToReplaceId) {
          deleteEntryMutation.mutate(entryToReplaceId);
          moveEntryMutation.mutate({ id: entryId, timeSlotId: slotId });
          toast({ title: "Dars siqib chiqarildi", description: "Avvalgi dars yetishmayotgan soatlar ro'yxatiga o'tdi." });
        } else {
          moveEntryMutation.mutate({ id: entryId, timeSlotId: slotId });
        }
      }
    }
  };

  const handleCellClick = (slotId: number) => {
    if (!selectedSubjectToPlace) return;

    const { subjectId, teacherId, teacherId2, classId, sourceEntryId } = selectedSubjectToPlace;

    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;

    if (sourceEntryId) {
      // Move existing entry
      const draggedEntry = allEntries.find(e => e.id === sourceEntryId);
      if (!draggedEntry) return;

      const teacherConflict = allEntries.find(e => 
        e.timeSlotId === slotId && 
        e.teacherId === draggedEntry.teacherId && 
        e.classId !== draggedEntry.classId &&
        e.id !== sourceEntryId
      );

      if (teacherConflict) {
        setConflictWarning({
          draggedEntryId: sourceEntryId,
          targetSlotId: slotId,
          conflictingEntryId: teacherConflict.id,
          conflictingClassName: classes.find(c => c.id === teacherConflict.classId)?.name || "Boshqa sinf"
        });
        setSelectedSubjectToPlace(null);
        return;
      }

      const existingEntriesInSlot = allEntries.filter(e => e.timeSlotId === slotId && e.classId === draggedEntry.classId && e.id !== sourceEntryId);

      let shouldReplace = false;
      let entryToReplaceId: number | null = null;

      if (existingEntriesInSlot.length > 0) {
        const target = existingEntriesInSlot[0];
        const isValidSplit = target.subjectId === draggedEntry.subjectId && target.teacherId !== draggedEntry.teacherId;
        
        if (!isValidSplit) {
          shouldReplace = true;
          entryToReplaceId = target.id;
        }
      }

      if (shouldReplace && entryToReplaceId) {
        deleteEntryMutation.mutate(entryToReplaceId);
        moveEntryMutation.mutate({ id: sourceEntryId, timeSlotId: slotId });
        toast({ title: "Dars siqib chiqarildi", description: "Avvalgi dars yetishmayotgan soatlar ro'yxatiga o'tdi." });
      } else {
        moveEntryMutation.mutate({ id: sourceEntryId, timeSlotId: slotId });
      }
    } else {
      // Place new subject
      const existingInSlot = allEntries.filter(e => e.timeSlotId === slotId && e.classId === classId);
      
      let targetWeekType = "always";

      if (existingInSlot.length > 0) {
        const hasAlways = existingInSlot.some(e => e.weekType === "always");
        const isFullAlternate = existingInSlot.length >= 2;
        
        if (hasAlways || isFullAlternate) {
          toast({ title: "Bu uyada allaqachon dars bor", variant: "destructive" });
          return;
        }

        const target = existingInSlot[0];
        if (target.weekType === "surat") {
          targetWeekType = "mahraj";
        } else if (target.weekType === "mahraj") {
          targetWeekType = "surat";
        } else {
          toast({ title: "Bu uyada allaqachon dars bor", variant: "destructive" });
          return;
        }
      }

      if (teacherId) {
        const teacherConflict = allEntries.find(e => 
          e.timeSlotId === slotId && 
          e.teacherId === teacherId && 
          e.classId !== classId &&
          (e.weekType === "always" || targetWeekType === "always" || e.weekType === targetWeekType)
        );
        if (teacherConflict) {
          toast({ title: "O'qituvchi bu vaqtda boshqa sinfda", variant: "destructive" });
          return;
        }
        const isUnavail = unavailSet.has(`${teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`);
        if (isUnavail) {
          toast({ title: "O'qituvchi bu vaqtda mavjud emas", variant: "destructive" });
          return;
        }
      }

      const roomsInUse = allEntries
        .filter(e => e.timeSlotId === slotId && (e.weekType === "always" || targetWeekType === "always" || e.weekType === targetWeekType))
        .map(e => e.roomId);
      const availableRoom = rooms.find(r => !roomsInUse.includes(r.id));
      
      if (!availableRoom) {
        toast({ title: "Bu vaqtda bo'sh xona yo'q", variant: "destructive" });
        return;
      }

      createEntryMutation.mutate({
        classId,
        subjectId,
        teacherId: teacherId || 0,
        roomId: availableRoom.id,
        timeSlotId: slotId,
        weekType: targetWeekType,
      });
    }

    setSelectedSubjectToPlace(null);
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
        classIds: classIds || [], clearExisting
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
      await apiRequest("DELETE", "/api/schedule-entries");
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
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["/api/schedule-entries"] });
      const previousEntries = qc.getQueryData<ScheduleEntry[]>(["/api/schedule-entries"]);
      if (previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], previousEntries.filter(e => e.id !== id));
      }
      return { previousEntries };
    },
    onError: (err, id, context) => {
      if (context?.previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], context.previousEntries);
      }
      toast({ title: "Xatolik", description: "Darsni o'chirib bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/schedule-conflicts"] });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/schedule-entries/${id}`, data);
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["/api/schedule-entries"] });
      const previousEntries = qc.getQueryData<ScheduleEntry[]>(["/api/schedule-entries"]);
      if (previousEntries) {
        qc.setQueryData(["/api/schedule-entries"],
          previousEntries.map(e => e.id === id ? { ...e, ...data, isOptimistic: true } : e)
        );
      }
      return { previousEntries };
    },
    onError: (err, variables, context) => {
      if (context?.previousEntries) {
        qc.setQueryData(["/api/schedule-entries"], context.previousEntries);
      }
      toast({ title: "Xatolik", description: "Darsni yangilab bo'lmadi", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/schedule-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/schedule-conflicts"] });
    },
    onSuccess: () => {
      setEditEntry(null);
      toast({ title: "Dars yangilandi" });
    },
  });

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const tableData: any[][] = [];
    const headers = ["Dars", ...daysToRender];
    periods.forEach((period, pi) => {
      const row = [`${pi + 1}-dars\n${period.startTime?.slice(0, 5)}–${period.endTime?.slice(0, 5)}`];
      daysToRender.forEach((_, dayIdx) => {
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
    doc.text("Haftalik dars jadvali", 14, 22);
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
    if (allEntries.length === 0) {
      toast({ title: "Eksport qilish uchun jadval yo'q", description: "Avval dars jadvalini yarating", variant: "destructive" });
      return;
    }

    // --- Styling constants (shared by all sheets) ---

    const HEADER_BG = "1E3A5F";       // deep navy
    const HEADER_FG = "FFFFFF";       // white
    const TITLE_BG = "2563EB";        // blue-600
    const WEEK_BG = "EFF6FF";         // blue-50
    const TIME_COL_BG = "F0F7FF";     // very light blue
    const ROW_EVEN_BG = "FFFFFF";     // white
    const ROW_ODD_BG = "F8FAFC";      // slate-50
    const BORDER_COLOR = "CBD5E1";    // slate-300
    const SUBJECT_PREFIX = "◆ ";       // subject bullet

    const thinBorder = {
      top:    { style: "thin" as const, color: { rgb: BORDER_COLOR } },
      bottom: { style: "thin" as const, color: { rgb: BORDER_COLOR } },
      left:   { style: "thin" as const, color: { rgb: BORDER_COLOR } },
      right:  { style: "thin" as const, color: { rgb: BORDER_COLOR } },
    };

    const centerAlign: any = { horizontal: "center", vertical: "center", wrapText: true };
    const leftAlign: any   = { horizontal: "left",   vertical: "center", wrapText: true };

    // --- Workbook level: school name from classes metadata ---
    const schoolName = classes.length > 0 ? "UMUMTA'LIM MAKTABI" : "MAKTAB";

    // --- Helpers ---
    const usedSheetNames = new Set<string>();
    const getUniqueSheetName = (name: string): string => {
      let base = (name || "Varaq").substring(0, 25).replace(/[\\/?*\[\]:]/g, "_");
      let final = base;
      let i = 2;
      while (usedSheetNames.has(final)) {
        final = `${base}_${i}`.substring(0, 31);
        i++;
      }
      usedSheetNames.add(final);
      return final;
    };

    type SheetSpec = {
      title: string;
      sheetName: string;
      filterFn: (e: ScheduleEntry) => boolean;
      cellLabelFn: (e: ScheduleEntry) => string;
    };

    // --- Single‑sheet builder ---
    const buildSheet = (spec: SheetSpec) => {
      const filtered = allEntries.filter(spec.filterFn);
      const bySlot = new Map<number, ScheduleEntry[]>();
      for (const e of filtered) {
        const arr = bySlot.get(e.timeSlotId) || [];
        arr.push(e);
        bySlot.set(e.timeSlotId, arr);
      }

      const colCount = daysToRender.length + 1;                     // 1 time-col + days count
      const totalRows = 4 + periods.length;                  // rows 0-3 are header blocks

      // Build text grid (array of arrays)
      const grid: string[][] = [];
      grid.push([schoolName]);                                          // row 0
      grid.push([spec.title]);                                          // row 1
      grid.push(["Haftalik dars jadvali"]);                       // row 2
      grid.push([]);                                                    // row 3 (spacer)
      grid.push(["Dars vaqti", ...daysToRender]);                               // row 4 (column headers)

      periods.forEach((period, pi) => {
        const row = [`${pi + 1}-dars\n${period.startTime?.slice(0, 5)}–${period.endTime?.slice(0, 5)}`];
        daysToRender.forEach((_, dayIdx) => {
          const slot = slotMap.get(`${dayIdx + 1}_${period.periodNumber}`);
          const slotEntries = slot ? bySlot.get(slot.id) || [] : [];
          const parts: string[] = [];
          slotEntries.forEach(e => {
            const subName = getSubject(e.subjectId)?.name || "—";
            const subColor = getSubject(e.subjectId)?.color || "#475569";
            const label = spec.cellLabelFn(e);
            const roomNum = getRoom(e.roomId)?.roomNumber || "";
            const roomPart = roomNum ? `${roomNum}-xona` : "";
            // Build per-entry block: subject (with prefix), teacher/class, room
            const lines = [subName];
            if (label) lines.push(label);
            if (roomPart) lines.push(roomPart);
            parts.push(lines.join("\n"));
          });
          row.push(parts.join("\n\n"));
        });
        grid.push(row);
      });

      // Extend rows to colCount width for merged header rows
      for (let r = 0; r <= 3; r++) {
        while (grid[r].length < colCount) grid[r].push("");
      }

      // Create sheet
      const ws = XLSX.utils.aoa_to_sheet(grid);

      // --- Merges ---
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
      ];

      // --- Column widths & row heights ---
      ws["!cols"] = [
        { wch: 18 },             // time column
        ...daysToRender.map(() => ({ wch: 24 })),
      ];
      ws["!rows"] = Array.from({ length: totalRows }, (_, i) => {
        if (i === 0) return { hpt: 32 };            // school name
        if (i === 1) return { hpt: 26 };            // class title
        if (i === 2) return { hpt: 20 };            // week
        if (i === 3) return { hpt: 6 };             // spacer
        if (i === 4) return { hpx: 30 };            // header
        return { hpt: 56 };                          // data rows
      });

      // --- Freeze panes (header row always visible) ---
      ws["!freeze"] = { xSplit: 0, ySplit: 5, topLeftCell: "A6" };

      // --- Print settings ---
      ws["!pageSetup"] = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,          // A4
        margins: {
          left: 0.5, right: 0.5,
          top: 0.6, bottom: 0.6,
          header: 0.3, footer: 0.3,
        },
      };

      // --- Cell‑by‑cell styling ---
      for (let row = 0; row < totalRows; row++) {
        const isDataRow = row >= 5;
        const dataRowIdx = row - 5;          // 0-based period index
        const isOddDataRow = dataRowIdx % 2 === 1;
        const colorRowBg = isOddDataRow ? ROW_ODD_BG : ROW_EVEN_BG;

        for (let col = 0; col < colCount; col++) {
          const addr = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[addr]) continue;
          const s: any = (ws[addr].s = {});

          // ---------- ROW 0: school name ----------
          if (row === 0) {
            s.font = { name: "Calibri", sz: 16, bold: true, color: { rgb: HEADER_FG } };
            s.fill = { patternType: "solid", fgColor: { rgb: HEADER_BG } };
            s.alignment = { ...centerAlign };
            s.border = { ...thinBorder };
            continue;
          }
          // ---------- ROW 1: class / teacher title ----------
          if (row === 1) {
            s.font = { name: "Calibri", sz: 13, bold: true, color: { rgb: HEADER_FG } };
            s.fill = { patternType: "solid", fgColor: { rgb: TITLE_BG } };
            s.alignment = { ...centerAlign };
            s.border = { ...thinBorder };
            continue;
          }
          // ---------- ROW 2: week label ----------
          if (row === 2) {
            s.font = { name: "Calibri", sz: 10, italic: true, color: { rgb: "334155" } };
            s.fill = { patternType: "solid", fgColor: { rgb: WEEK_BG } };
            s.alignment = { ...centerAlign };
            s.border = { ...thinBorder };
            continue;
          }
          // ---------- ROW 3: spacer ----------
          if (row === 3) {
            s.font = { name: "Calibri", sz: 4, color: { rgb: "FFFFFF" } };
            s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
            continue;
          }
          // ---------- ROW 4: column headers ----------
          if (row === 4) {
            s.font = { name: "Calibri", sz: 11, bold: true, color: { rgb: HEADER_FG } };
            s.fill = { patternType: "solid", fgColor: { rgb: HEADER_BG } };
            s.alignment = { ...centerAlign };
            s.border = {
              top:    { style: "medium" as const, color: { rgb: "0F172A" } },
              bottom: { style: "medium" as const, color: { rgb: "0F172A" } },
              left:   { style: "thin" as const,   color: { rgb: BORDER_COLOR } },
              right:  { style: "thin" as const,   color: { rgb: BORDER_COLOR } },
            };
            continue;
          }

          // ---------- DATA ROWS (row >= 5) ----------
          s.border = { ...thinBorder };
          s.alignment = { ...(col === 0 ? centerAlign : leftAlign) };

          if (col === 0) {
            // Time column
            s.font = { name: "Calibri", sz: 9, bold: true, color: { rgb: "1E3A5F" } };
            s.fill = { patternType: "solid", fgColor: { rgb: TIME_COL_BG } };
            s.alignment = { ...centerAlign };
          } else {
            // Subject cells
            s.font = { name: "Calibri", sz: 10, color: { rgb: "1E293B" } };
            s.fill = { patternType: "solid", fgColor: { rgb: colorRowBg } };

            // Try to color the subject name line using the subject's color
            const cellText = grid[row]?.[col] || "";
            if (cellText && cellText !== "") {
              const subjectLine = cellText.split("\n")[0];
              if (subjectLine && subjectLine !== "—") {
                const subjectName = subjectLine;
                // Make subject name bold if there's content
                s.font.bold = true;
                // Find subject color and use it as cell left border accent
                for (const entry of Array.from(bySlot.values()).flat()) {
                  const subColor = getSubject(entry.subjectId)?.color;
                  if (subColor && cellText.includes(getSubject(entry.subjectId)?.name || "")) {
                    const hexClean = subColor.replace("#", "");
                    s.border = {
                      ...thinBorder,
                      left: { style: "medium" as const, color: { rgb: hexClean } },
                    };
                    break;
                  }
                }
              }
            }
          }
        }
      }

      return ws;
    };

    // --- Build sheet list based on view mode ---
    const sheets: SheetSpec[] = [];

    if (viewMode === "class") {
      if (selectedClassId === "all") {
        const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name, "uz"));
        for (const cls of sorted) {
          sheets.push({
            title: `${cls.name} sinfi — Dars jadvali`,
            sheetName: getUniqueSheetName(cls.name),
            filterFn: (e) => e.classId === cls.id,
            cellLabelFn: (e) => teacherShortName(e.teacherId),
          });
        }
      } else {
        const cls = classes.find(c => c.id === selectedClassId);
        const name = cls?.name || "Sinf";
        sheets.push({
          title: `${name} sinfi — Dars jadvali`,
          sheetName: getUniqueSheetName("Jadval"),
          filterFn: (e) => e.classId === selectedClassId,
          cellLabelFn: (e) => teacherShortName(e.teacherId),
        });
      }
    } else {
      if (selectedTeacherId) {
        const t = getTeacher(selectedTeacherId);
        const name = t ? `${t.lastName} ${t.firstName}`.trim() : "O'qituvchi";
        sheets.push({
          title: `${name} — Dars jadvali`,
          sheetName: getUniqueSheetName("Jadval"),
          filterFn: (e) => e.teacherId === selectedTeacherId,
          cellLabelFn: (e) => classNameById(e.classId),
        });
      } else {
        const teachersWithEntries = teachers
          .filter(t => allEntries.some(e => e.teacherId === t.id))
          .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "uz"));
        for (const t of teachersWithEntries) {
          const name = `${t.lastName} ${t.firstName}`.trim();
          sheets.push({
            title: `${name} — Dars jadvali`,
            sheetName: getUniqueSheetName(t.lastName || t.firstName || `O'qituvchi_${t.id}`),
            filterFn: (e) => e.teacherId === t.id,
            cellLabelFn: (e) => classNameById(e.classId),
          });
        }
      }
    }

    if (sheets.length === 0) {
      toast({ title: "Eksport uchun ma'lumot yo'q", variant: "destructive" });
      return;
    }

    // --- Build workbook ---
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title:  viewMode === "class" ? "Sinf dars jadvali" : "O'qituvchi dars jadvali",
      Subject: "Haftalik dars jadvali",
      CreatedDate: new Date(),
    };

    for (const spec of sheets) {
      const ws = buildSheet(spec);
      XLSX.utils.book_append_sheet(wb, ws, spec.sheetName);
    }

    // --- Filename ---
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = viewMode === "class"
      ? (selectedClassId === "all"
        ? `barcha_sinflar_dars_jadvali_${dateStr}.xlsx`
        : `${(classes.find(c => c.id === selectedClassId)?.name || "sinf").replace(/[^a-zA-Z0-9-]/g, "_")}_dars_jadvali_${dateStr}.xlsx`)
      : (selectedTeacherId
        ? `${(getTeacher(selectedTeacherId)?.lastName || "oqituvchi").replace(/[^a-zA-Z0-9]/g, "_")}_dars_jadvali_${dateStr}.xlsx`
        : `barcha_oqituvchilar_dars_jadvali_${dateStr}.xlsx`);

    XLSX.writeFile(wb, fileName);

    const label = viewMode === "class"
      ? "sinf"
      : "o'qituvchi";
    toast({
      title: "Excel fayl yuklandi",
      description: sheets.length === 1
        ? `1 ta ${label} jadvali eksport qilindi`
        : `${sheets.length} ta ${label} jadvali alohida varaqlarda eksport qilindi`,
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-full text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dars jadvali</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Haftalik dars jadvalini boshqarish va yaratish</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-red-500 border-red-500/20 hover:bg-red-500/10">
            <FileText className="mr-1.5 h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="text-muted-foreground/80 hover:text-foreground border-border">
            <Printer className="mr-1.5 h-4 w-4" />Chop etish
          </Button>
          <Button
            variant="outline" size="sm"
            className="text-red-500 border-red-500/20 hover:bg-red-500/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />Tozalash
          </Button>
          <Button
            onClick={() => { setShowGenerator(!showGenerator); setGeneratorResult(null); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Wand2 className="mr-2 h-4 w-4" />Jadval yaratish
          </Button>
        </div>
      </div>

      {/* Generator Panel */}
      {showGenerator && (
        <Card className="border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Avtomatik jadval yaratish</h3>
                  <p className="text-xs text-muted-foreground">Cheklovlar asosida optimal jadval tuziladi</p>
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
                <div key={label} className={`flex items-center space-x-2 p-2.5 rounded-lg ${ok ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                  <Icon className={`h-4 w-4 ${ok ? "text-emerald-500" : "text-red-500"}`} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className={`text-sm font-bold ${ok ? "text-emerald-500" : "text-red-500"}`}>{count} ta</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-3 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} className="w-4 h-4 text-blue-600 rounded bg-muted/20 border-border" />
                <span className="text-sm text-muted-foreground">Mavjud jadvalini tozalab yangi yaratish</span>
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                onClick={() => generateMutation.mutate({})}
                disabled={generateMutation.isPending || classes.length === 0 || rooms.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {generateMutation.isPending
                  ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Yaratilmoqda...</>
                  : <><Wand2 className="mr-2 h-4 w-4" />Barcha sinflar uchun jadval yaratish</>}
              </Button>
              {selectedClassId !== "all" && viewMode === "class" && (
                <Button variant="outline" onClick={() => generateMutation.mutate({ classIds: [selectedClassId as number] })} disabled={generateMutation.isPending} className="border-border">
                  Faqat "{classes.find(c => c.id === selectedClassId)?.name}" sinfi uchun
                </Button>
              )}
            </div>

            {(classes.length === 0 || rooms.length === 0) && (
              <p className="text-xs text-red-500 mt-2">⚠ Jadval yaratish uchun avval sinflar va xonalar qo'shing, keyin sinflarga fan va o'qituvchi belgilang.</p>
            )}

            {/* Generation result summary */}
            {generatorResult && (
              <div className="mt-4 border-t border-blue-500/20 pt-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-foreground">{generatorResult.count} ta dars yaratildi — {generatorResult.coverage}% qoplanish</span>
                </div>
                {generatorResult.classResults?.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {generatorResult.classResults.map((r: any) => (
                      <div key={r.className} className={`text-xs px-2.5 py-1.5 rounded-lg border ${r.coverage >= 100 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : r.coverage >= 70 ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-red-500/10 border-red-500/20 text-red-500"}`}>
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
      <Card className="border border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-2 pt-3">
          {/* Row 1: Week nav + View toggle + Conflicts */}
          <div className="flex items-center justify-between gap-2">
            {/* Title */}
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold text-foreground">Maktab haftalik dars jadvali</span>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("class")}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${viewMode === "class" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <GraduationCap className="h-3 w-3" />
                <span>Sinf bo'yicha</span>
              </button>
              <button
                onClick={() => setViewMode("teacher")}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${viewMode === "teacher" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <UserCheck className="h-3 w-3" />
                <span>O'qituvchi bo'yicha</span>
              </button>
            </div>

            {/* Conflicts + Count */}
            <div className="flex items-center space-x-2">
              {conflicts.length > 0 ? (
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="destructive" 
                        className="text-[10px] h-5 px-1.5 cursor-pointer hover:bg-red-600 transition-colors shadow-sm select-none"
                        onClick={() => setLocation("/")}
                      >
                        <AlertTriangle className="mr-0.5 h-2.5 w-2.5 animate-bounce" />{conflicts.length} ta ziddiyat
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="w-80 p-3 max-h-60 overflow-y-auto bg-card border border-border shadow-lg text-card-foreground rounded-lg z-50">
                      <div className="space-y-2">
                        <p className="font-bold text-xs text-foreground border-b border-border pb-1 mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          Mavjud ziddiyatlar:
                        </p>
                        {conflicts.map((c: any, idx: number) => (
                          <div key={c.id || idx} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-foreground">
                            <p className="font-bold text-red-500 mb-0.5">
                              {c.conflictType === "room" ? "Xona ziddiyati" :
                               c.conflictType === "teacher" ? "O'qituvchi ziddiyati" :
                               c.conflictType === "unavailability" ? "Bandlik ziddiyati" :
                               c.conflictType === "schedule_overlap" ? "SanPiN/yuklama ziddiyati" : "Sinf ziddiyati"}
                            </p>
                            <p className="leading-relaxed text-muted-foreground">{c.description}</p>
                          </div>
                        ))}
                        <p className="text-[9px] text-blue-500 dark:text-blue-400 text-center pt-1 border-t border-border mt-1.5 font-medium cursor-pointer">
                          Bosh sahifaga o'tish va to'liq ko'rish uchun bosing
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />Ziddiyatsiz
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground/60">{entries.length} ta dars</span>
            </div>
          </div>

          {/* Row 2: Class tabs or Teacher selector */}
          <div className="flex items-center gap-2 mt-2 min-w-0">
            {viewMode === "class" ? (
              <div className="flex gap-1 overflow-x-auto max-w-[50%] scrollbar-none pb-0.5">
                <button
                  onClick={() => setSelectedClassId("all")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap flex-shrink-0 ${selectedClassId === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Barchasi
                </button>
                {classes.map(cls => {
                  const missingHours = classMissingHoursMap[cls.id] || 0;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                        selectedClassId === cls.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <span>{cls.name}</span>
                      {missingHours > 0 && (
                        <span className={`inline-flex items-center justify-center px-1 text-[8px] font-bold rounded-full min-w-[14px] h-3.5 ${
                          selectedClassId === cls.id 
                            ? "bg-card text-primary" 
                            : "bg-red-500 text-primary-foreground shadow-sm"
                        }`}>
                          {missingHours}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center space-x-2 flex-1">
                <Select
                  value={selectedTeacherId ? String(selectedTeacherId) : "all"}
                  onValueChange={v => setSelectedTeacherId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger className="h-7 text-[10px] w-48 bg-muted/20 border-border text-foreground">
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
                  <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
                    <span>{teacherEntries.length} ta dars</span>
                    {teachers.find(t => t.id === selectedTeacherId)?.maxHoursPerWeek && (
                      <span className="text-muted-foreground/60">/ {teachers.find(t => t.id === selectedTeacherId)?.maxHoursPerWeek} max</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Missing Lessons Indicator - inline */}
            {missingLessons.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">Yetishmayotgan:</span>
                {missingLessons.slice(0, 2).map((ml, idx) => (
                  <div key={idx} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium border flex items-center gap-0.5 whitespace-nowrap" style={{ borderColor: ml.color, backgroundColor: `${ml.color}15`, color: ml.color }}>
                    <span className="max-w-[60px] truncate">{ml.subjectName}</span>
                    <span className="w-3 h-3 rounded-full bg-card flex items-center justify-center font-bold text-[8px] flex-shrink-0">{ml.missingHours}</span>
                  </div>
                ))}
                {missingLessons.length > 2 && (
                  <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">+{missingLessons.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Legend / Guide */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground bg-muted/40 p-2 rounded-lg mb-3 border border-border">
            <div className="font-bold text-foreground mr-1 flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-primary" /> Yo'riqnoma:
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              <span>Fan rangi (har bir fanning o'z rangi)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3 w-3 text-muted-foreground/60" />
              <span>O'qituvchi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3 text-muted-foreground/60" />
              <span>Sinf nomi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DoorOpen className="h-3 w-3 text-muted-foreground/60" />
              <span>Xona raqami</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">Xona biriktirilmagan!</span>
            </div>
          </div>

          {loadingEntries ? (
            <div className="space-y-2">
              {Array(6).fill(0).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/60">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">Vaqt uyalari yuklanmoqda...</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
            <div className="flex gap-3 justify-between">
              {/* Left sidebar: Available subjects to drag */}
              {viewMode === "class" && selectedClassId !== "all" && (
                <DroppableSidebar 
                  id="sidebar"
                  isHighlighted={!!selectedSubjectToPlace?.sourceEntryId}
                  onClick={(e) => {
                    if (selectedSubjectToPlace?.sourceEntryId) {
                      e.stopPropagation();
                      deleteEntryMutation.mutate(selectedSubjectToPlace.sourceEntryId);
                      setSelectedSubjectToPlace(null);
                      toast({ title: "Dars olib tashlandi" });
                    }
                  }}
                >
                  <div className="text-[10px] font-semibold text-muted-foreground/60 mb-1.5">Mavjud fanlar</div>
                  {missingLessons.length === 0 ? (
                    <div className="text-[9px] text-muted-foreground/60 italic py-2">Barcha fanlar biriktirilgan</div>
                  ) : (
                    <div className="space-y-1">
                      {missingLessons.map((ml, idx) => {
                        const sub = subjects.find(s => s.name === ml.subjectName);
                        const cs = classSubjects.find(c => c.classId === selectedClassId && c.subjectId === sub?.id);
                        const isCardSelected = selectedSubjectToPlace?.subjectId === sub?.id && !selectedSubjectToPlace?.sourceEntryId;
                        
                        return (
                          <DraggableSubjectCard
                            key={idx}
                            subject={sub!}
                            missingHours={ml.missingHours}
                            teacherId={cs?.teacherId}
                            teacherId2={cs?.teacherId2}
                            classId={selectedClassId as number}
                            isSelected={isCardSelected}
                            isHoldingSubject={!!selectedSubjectToPlace}
                            onClick={() => {
                              if (isCardSelected) {
                                setSelectedSubjectToPlace(null);
                              } else {
                                setSelectedSubjectToPlace({
                                  subjectId: sub!.id,
                                  teacherId: cs?.teacherId,
                                  teacherId2: cs?.teacherId2,
                                  classId: selectedClassId as number
                                });
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </DroppableSidebar>
              )}
              
              {/* Right: Schedule table */}
              <div className="w-full lg:w-1/2 lg:ml-auto -mx-2 shadow-sm border border-border rounded-lg p-2 bg-card text-card-foreground">
                {selectedSubjectToPlace && (
                  <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 animate-pulse">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">Tanlandi:</span>
                      <Badge style={{ backgroundColor: getSubject(selectedSubjectToPlace.subjectId)?.color }} className="text-primary-foreground text-[9px] px-1.5 py-0">
                        {getSubject(selectedSubjectToPlace.subjectId)?.name}
                      </Badge>
                      <span>— Joylashtirish uchun yashil katakchani bosing.</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 px-1.5 py-0 ml-2" 
                      onClick={() => setSelectedSubjectToPlace(null)}
                    >
                      Bekor qilish (ESC)
                    </Button>
                  </div>
                )}
                
                <table className="w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-muted-foreground/60 w-20">Dars</th>
                      {daysToRender.map((day, i) => (
                        <th key={day} style={{ width: `${100 / daysToRender.length}%` }} className="text-center py-1.5 px-1 text-[10px] font-semibold text-muted-foreground">
                          <div>{day}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period, pi) => (
                      <tr key={period.id} className={pi % 2 === 0 ? "bg-muted/40" : "bg-card"}>
                        <td className="py-1 px-2 align-middle border-b border-border/50" style={{ height: "58px" }}>
                          <div className="flex flex-col justify-center h-full">
                            <div className="text-[10px] font-semibold text-foreground">{pi + 1}-dars</div>
                            <div className="text-[9px] text-muted-foreground/60 font-mono">
                              {period.startTime?.slice(0, 5)}–{period.endTime?.slice(0, 5)}
                            </div>
                          </div>
                        </td>
                        {daysToRender.map((_, dayIdx) => {
                          const dayNum = dayIdx + 1;
                          const slot = slotMap.get(`${dayNum}_${period.periodNumber}`);
                          if (!slot) return <td key={dayIdx} className="py-1 px-1 border-b border-border/50" style={{ height: "58px" }} />;
                          const slotEntries = entryBySlot.get(slot.id) || [];

                          return (
                            <DroppableCell 
                              key={dayIdx} 
                              id={`slot-${slot.id}`}
                              status={getSlotStatus(slot.id)}
                              onClick={() => handleCellClick(slot.id)}
                            >
                              {(() => {
                                // Sort entries so "surat" is first (on top) and "mahraj" is second (on bottom)
                                const sortedEntries = [...slotEntries].sort((a, b) => {
                                  if (a.weekType === "surat" && b.weekType === "mahraj") return -1;
                                  if (a.weekType === "mahraj" && b.weekType === "surat") return 1;
                                  return 0;
                                });

                                // Check if we have alternating week entries
                                const hasSurat = sortedEntries.some(e => e.weekType === "surat");
                                const hasMahraj = sortedEntries.some(e => e.weekType === "mahraj");

                                if (sortedEntries.length === 1 && (hasSurat || hasMahraj)) {
                                  // Only one alternating week entry exists
                                  const entry = sortedEntries[0];
                                  const sub = getSubject(entry.subjectId);
                                  const room = getRoom(entry.roomId);
                                  const card = (
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
                                      isSelected={selectedSubjectToPlace?.sourceEntryId === entry.id}
                                      isHoldingSubject={!!selectedSubjectToPlace}
                                      isCompact={true}
                                      onToggleWeekType={() => {
                                        const newWeekType = entry.weekType === "surat" ? "mahraj" : "surat";
                                        updateEntryMutation.mutate({
                                          id: entry.id,
                                          data: {
                                            subjectId: entry.subjectId,
                                            teacherId: entry.teacherId,
                                            roomId: entry.roomId,
                                            weekType: newWeekType
                                          }
                                        });
                                      }}
                                      onMoveSelect={() => {
                                        if (selectedSubjectToPlace?.sourceEntryId === entry.id) {
                                          setSelectedSubjectToPlace(null);
                                        } else {
                                          setSelectedSubjectToPlace({
                                            subjectId: entry.subjectId,
                                            teacherId: entry.teacherId,
                                            classId: entry.classId,
                                            sourceEntryId: entry.id
                                          });
                                        }
                                      }}
                                      onEdit={() => {
                                        setEditEntry(entry);
                                        setEditForm({ subjectId: entry.subjectId, teacherId: entry.teacherId, roomId: entry.roomId, weekType: entry.weekType });
                                      }}
                                      onDelete={() => deleteEntryMutation.mutate(entry.id)}
                                    />
                                  );

                                  const spacer = <div key="spacer" className="flex-1" />;

                                  if (entry.weekType === "surat") {
                                    return [card, spacer];
                                  } else {
                                    return [spacer, card];
                                  }
                                }

                                return sortedEntries.map(entry => {
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
                                      isSelected={selectedSubjectToPlace?.sourceEntryId === entry.id}
                                      isHoldingSubject={!!selectedSubjectToPlace}
                                      isCompact={true}
                                      onToggleWeekType={() => {
                                        if (entry.weekType === "always") return;
                                        const newWeekType = entry.weekType === "surat" ? "mahraj" : "surat";
                                        updateEntryMutation.mutate({
                                          id: entry.id,
                                          data: {
                                            subjectId: entry.subjectId,
                                            teacherId: entry.teacherId,
                                            roomId: entry.roomId,
                                            weekType: newWeekType
                                          }
                                        });
                                      }}
                                      onMoveSelect={() => {
                                        if (selectedSubjectToPlace?.sourceEntryId === entry.id) {
                                          setSelectedSubjectToPlace(null);
                                        } else {
                                          setSelectedSubjectToPlace({
                                            subjectId: entry.subjectId,
                                            teacherId: entry.teacherId,
                                            classId: entry.classId,
                                            sourceEntryId: entry.id
                                          });
                                        }
                                      }}
                                      onEdit={() => {
                                        setEditEntry(entry);
                                        setEditForm({ subjectId: entry.subjectId, teacherId: entry.teacherId, roomId: entry.roomId, weekType: entry.weekType });
                                      }}
                                      onDelete={() => deleteEntryMutation.mutate(entry.id)}
                                    />
                                  );
                                });
                              })()}
                            </DroppableCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <DragOverlay dropAnimation={null}>
                  {activeDragEntry ? (
                    <EntryCard
                      entry={activeDragEntry}
                      subject={getSubject(activeDragEntry.subjectId)}
                      room={getRoom(activeDragEntry.roomId)}
                      teacherName={teacherShortName(activeDragEntry.teacherId)}
                      className={classNameById(activeDragEntry.classId)}
                      viewMode={viewMode}
                      showAllClasses={showAllClasses}
                      isOverlay
                      isCompact={true}
                    />
                  ) : activeDragNewSubject ? (
                    <div
                      className="p-1.5 rounded border-2 shadow-lg rotate-1 cursor-grabbing bg-card min-w-[120px] max-w-[180px]"
                      style={{
                        borderColor: getSubject(activeDragNewSubject.subjectId)?.color,
                        backgroundColor: `${getSubject(activeDragNewSubject.subjectId)?.color}15`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-semibold truncate" style={{ color: getSubject(activeDragNewSubject.subjectId)?.color }}>
                            {getSubject(activeDragNewSubject.subjectId)?.name}
                          </p>
                          <p className="text-[8px] text-muted-foreground">
                            Yangi dars
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </div>
            </div>
            </DndContext>
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
                <label className="text-sm font-medium text-foreground">Fan</label>
                <Select value={String(editForm.subjectId)} onValueChange={v => setEditForm(p => p ? { ...p, subjectId: parseInt(v) } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">O'qituvchi</label>
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
                <label className="text-sm font-medium text-foreground">Xona</label>
                <Select value={String(editForm.roomId)} onValueChange={v => setEditForm(p => p ? { ...p, roomId: parseInt(v) } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.roomNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Dars turi</label>
                <Select value={editForm.weekType} onValueChange={v => setEditForm(p => p ? { ...p, weekType: v } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Doimiy (Har hafta)</SelectItem>
                    <SelectItem value="surat">Surat (Toq hafta)</SelectItem>
                    <SelectItem value="mahraj">Mahraj (Juft hafta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-red-600 hover:bg-red-700 text-primary-foreground mr-auto order-first"
                variant="destructive"
                onClick={() => { deleteEntryMutation.mutate(editEntry.id); setEditEntry(null); }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />O'chirish
              </Button>
              <Button variant="outline" onClick={() => setEditEntry(null)}>Bekor qilish</Button>
              <Button
                onClick={() => updateEntryMutation.mutate({ id: editEntry.id, data: editForm })}
                disabled={updateEntryMutation.isPending}
                className="bg-primary hover:bg-primary/90"
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
              <p className="text-sm text-foreground">
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

      {/* Floating preview for select-to-place */}
      {selectedSubjectToPlace && (
        <div
          id="floating-cursor-preview"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: "translate3d(-9999px, -9999px, 0)",
            pointerEvents: "none",
            zIndex: 9999,
            borderColor: getSubject(selectedSubjectToPlace.subjectId)?.color || "#3B82F6",
            backgroundColor: `${getSubject(selectedSubjectToPlace.subjectId)?.color || "#3B82F6"}15`,
            borderWidth: '2px',
            borderRadius: '0.375rem',
            padding: '0.375rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            willChange: 'transform',
            transition: 'none'
          }}
          className="bg-card min-w-[100px] max-w-[150px] border border-solid border-border"
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold truncate" style={{ color: getSubject(selectedSubjectToPlace.subjectId)?.color }}>
                {getSubject(selectedSubjectToPlace.subjectId)?.name}
              </p>
              <p className="text-[8px] text-muted-foreground">
                {selectedSubjectToPlace.sourceEntryId ? "Ko'chirilmoqda" : "Joylashtirilmoqda"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
