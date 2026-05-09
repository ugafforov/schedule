import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, GraduationCap, BookOpen, Users,
  Clock, ChevronRight, AlertCircle, CheckCircle2, Zap, Info, X,
  BarChart3, UserCheck, UserX, ArrowRight, Loader2
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, ClassSubject } from "@shared/schema";
import { getAutoAssignments } from "@/lib/dts-curriculum";

type TeacherWithSubjects = Teacher & { subjectIds?: number[] };

// ─── Types ────────────────────────────────────────────────────────────────────
interface Assignment {
  subjectId: number;
  teacherId: number | null;
  weeklyHours: number;
}

interface TeacherLoadData {
  subjects: Array<{
    subjectId: number;
    subjectName: string;
    subjectColor: string;
    totalClasses: number;
    totalHours: number;
    assignedCount: number;
    teachers: Array<{ teacherId: number; teacherName: string; hours: number; classCount: number }>;
  }>;
  teachers: Array<{
    teacherId: number;
    teacherName: string;
    maxHours: number;
    totalAssignedHours: number;
    subjects: string[];
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GRADE_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700",
  "bg-red-100 text-red-700", "bg-yellow-100 text-yellow-700",
  "bg-teal-100 text-teal-700", "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];
const gradeColor = (g: string) => GRADE_COLORS[(parseInt(g) - 1) % GRADE_COLORS.length] || GRADE_COLORS[0];

function loadColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-400";
  if (pct >= 50) return "bg-blue-500";
  return "bg-emerald-500";
}
function loadBg(pct: number) {
  if (pct >= 100) return "text-red-700 bg-red-50 border-red-200";
  if (pct >= 80) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function ClearAssignmentsDialog({
  open,
  onClose,
  onConfirm,
  className,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={className || "sm:max-w-sm"}>
        <DialogHeader>
          <DialogTitle>Tez tozalashni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Ushbu sinfdagi barcha fan-o'qituvchi biriktirishlari o'chiriladi.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>Tozalash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-assign dialog ────────────────────────────────────────────────────────
function AutoAssignDialog({ open, onClose, onConfirm, selectedClass, subjects, teachers, teacherLoadMap }: {
  open: boolean; onClose: () => void;
  onConfirm: (a: Assignment[]) => void;
  selectedClass: Class | undefined;
  subjects: Subject[];
  teachers: TeacherWithSubjects[];
  teacherLoadMap: Map<number, number>;
}) {
  if (!selectedClass) return null;
  const grade = parseInt(selectedClass.grade);
  const result = getAutoAssignments(grade, subjects, (selectedClass as any).language || "uz");
  const teacherSubjectMap = new Map<number, number[]>();
  for (const teacher of teachers) {
    teacherSubjectMap.set(teacher.id, teacher.subjectIds || []);
  }
  const assignmentsWithTeachers = result.assignments.map((a) => {
    const subject = subjects.find((s) => s.id === a.subjectId);
    if (!subject) return a;
    const teacher = pickTeacherForSubject(subject, teachers, teacherLoadMap, teacherSubjectMap, selectedClass.grade);
    return { ...a, teacherId: teacher?.id ?? null };
  });
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            DTS bo'yicha avtomatik biriktirish
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            №121-buyruq (10.04.2025) — <span className="font-semibold text-gray-700">{selectedClass.name}</span> uchun
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {result.assignments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-800">Topildi — {result.assignments.length} ta fan</span>
              </div>
              <div className="space-y-1.5">
                {result.assignments.map((a, i) => {
                  const sub = subjects.find(s => s.id === a.subjectId);
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50/60">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub?.color || "#3B82F6" }} />
                      <span className="flex-1 text-sm text-gray-800 truncate">{sub?.name}</span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {a.weeklyHours} soat/hafta
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {result.missingNames.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-800">Topilmadi — {result.missingNames.length} ta fan</span>
              </div>
              <div className="space-y-1">
                {result.missingNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/60">
                    <X className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Topilmagan fanlarni avval <strong>Fanlar</strong> sahifasida DTS orqali qo'shing.
              </p>
            </div>
          )}
          {result.assignments.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">Mos fan topilmadi</p>
              <p className="text-xs text-gray-500 mt-1">Avval <strong>Fanlar</strong> sahifasida DTS fanlarini qo'shing.</p>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              O'qituvchilar <strong>avtomatik biriktirilmaydi</strong> — ularni "Yuk hisobi" tabidan bir tudma bilan biriktiring.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 pt-3 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={() => onConfirm(assignmentsWithTeachers)} disabled={assignmentsWithTeachers.length === 0} className="bg-blue-600 hover:bg-blue-700">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            {assignmentsWithTeachers.length} ta fanni biriktirish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { PRIMARY_TEACHER_ALLOWED_SUBJECTS, isPrimaryTeacherAllowedSubject } from "@shared/constants";

function pickTeacherForSubject(
  subject: Subject,
  teachers: TeacherWithSubjects[],
  teacherLoadMap: Map<number, number>,
  teacherSubjectMap: Map<number, number[]>,
  classGrade: string // Sinf darajasi: "1", "2", ..., "11"
) {
  // Sinf darajasini aniqlash
  const gradeNum = parseInt(classGrade);
  let requiredLevel: string;
  if (gradeNum >= 1 && gradeNum <= 4) {
    requiredLevel = "primary";
  } else {
    requiredLevel = "high"; // 5-11 sinf = high
  }

  // Istisno fanlar - bu fanlar uchun o'qituvchi barcha sinflarda dars bera oladi
  const universalSubjects = [
    "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
    "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
    "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik"
  ];
  const isUniversalSubject = universalSubjects.some(s => 
    subject.name.toLowerCase().includes(s.toLowerCase())
  );

  const scored = teachers
    .map((teacher) => {
      const specialization = (teacher.specialization || "").toLowerCase();
      const subjectIds = teacherSubjectMap.get(teacher.id) || [];
      const currentHours = teacherLoadMap.get(teacher.id) || 0;
      const maxHours = teacher.maxHoursPerWeek || 30;
      const currentSubjects = subjectIds.length;
      const hasSlot = currentSubjects < 2 && currentHours < maxHours;
      const subjectMatch = subjectIds.includes(subject.id);
      const specializationMatch = specialization.length > 0 && specialization.includes(subject.name.toLowerCase());
      
      // O'qituvchining sinf darajasini tekshirish
      const teacherGradeLevels = ((teacher as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
      
      // Agar fan universal bo'lsa, o'qituvchi har qanday darajada dars bera oladi
      const gradeLevelMatch = isUniversalSubject || teacherGradeLevels.includes(requiredLevel);
      
      // BOSHLANG'ICH SINF QOIDASI: Boshlang'ich sinf o'qituvchilari faqat
      // o'z sinfiga ruxsat etilgan fanlarga biriktirilishi mumkin
      const isPrimaryTeacher = teacherGradeLevels.includes("primary");
      const isPrimaryClass = requiredLevel === "primary";
      const isPrimarySubjectAllowed = isPrimaryTeacherAllowedSubject(subject.name);
      
      if (isPrimaryTeacher && isPrimaryClass && !isPrimarySubjectAllowed) {
        // Boshlang'ich sinf o'qituvchisi boshlang'ich sinfga ruxsat etilmagan fanga biriktirilmaydi
        return { teacher, score: -1, hasSlot: false, subjectMatch: false, specializationMatch: false, gradeLevelMatch: false };
      }
      
      let score = 0;
      
      // Agar o'qituvchi bu sinf darajasida dars bera olmasa, uni rad etish
      if (!gradeLevelMatch) return { teacher, score: -1, hasSlot: false, subjectMatch: false, specializationMatch: false, gradeLevelMatch: false };
      
      if (subjectMatch) score += 100;
      if (specializationMatch) score += 50;
      if (!hasSlot) score = -1;
      score -= currentHours;
      score -= currentSubjects * 5;
      return { teacher, score, hasSlot, subjectMatch, specializationMatch, gradeLevelMatch };
    })
    .filter((item) => item.score >= 0 && item.subjectMatch && item.gradeLevelMatch);

  if (scored.length === 0) return null;

  return scored
    .slice()
    .sort((a, b) => b.score - a.score || (teacherLoadMap.get(a.teacher.id) || 0) - (teacherLoadMap.get(b.teacher.id) || 0))[0]
    ?.teacher || null;
}

// ─── Bulk assign dialog (Tab 2) ────────────────────────────────────────────────
function BulkAssignDialog({ open, onClose, subject, teachers, onConfirm }: {
  open: boolean; onClose: () => void;
  subject: TeacherLoadData["subjects"][0] | null;
  teachers: TeacherWithSubjects[]; // TeacherWithSubjects tipiga o'zgartirdik
  onConfirm: (teacherId: number | null) => void;
}) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("none");
  if (!subject) return null;
  
  // Faqat shu fanni o'qitadigan o'qituvchilarni filtrlash
  const eligibleTeachers = teachers.filter(t => 
    t.subjectIds && t.subjectIds.includes(subject.subjectId)
  );
  
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setSelectedTeacherId("none"); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Barcha sinflarga biriktirish
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            "<span className="font-semibold text-gray-700">{subject.subjectName}</span>" fanini o'qitadigan{" "}
            <span className="font-semibold">{subject.totalClasses} ta sinf</span> ga bitta o'qituvchi biriktiriladi
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Current teachers for this subject */}
          {subject.teachers.length > 0 && (
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Hozirgi biriktirishlar:</p>
              <div className="space-y-1.5">
                {subject.teachers.map(t => (
                  <div key={t.teacherId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{t.teacherName}</span>
                    <span className="text-xs text-gray-500">{t.classCount} sinf · {t.hours} soat/h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {eligibleTeachers.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Bu fanni o'qitadigan o'qituvchi topilmadi</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Avval "O'qituvchilar" sahifasida o'qituvchi qo'shing va unga <strong>{subject.subjectName}</strong> fanini biriktiring.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">O'qituvchi tanlang</label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} disabled={eligibleTeachers.length === 0}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={eligibleTeachers.length === 0 ? "O'qituvchi yo'q" : "O'qituvchi tanlang..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-gray-400 flex items-center gap-2"><UserX className="h-3.5 w-3.5" /> Tayinlanmagan (tozalash)</span>
                </SelectItem>
                {eligibleTeachers.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.firstName} {t.lastName}
                    {t.specialization ? <span className="text-gray-400 ml-1">· {t.specialization}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleTeachers.length > 0 && (
              <p className="text-xs text-gray-500">
                {eligibleTeachers.length} ta o'qituvchi bu fanni o'qitadi
              </p>
            )}
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Bu amal <strong>{subject.subjectName}</strong> fanini o'tadigan barcha{" "}
              <strong>{subject.totalClasses} ta sinfdagi</strong> biriktirishni almashtiradi.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setSelectedTeacherId("none"); }}>Bekor qilish</Button>
          <Button
            onClick={() => {
              onConfirm(selectedTeacherId === "none" ? null : parseInt(selectedTeacherId));
              setSelectedTeacherId("none");
            }}
            disabled={eligibleTeachers.length === 0 && selectedTeacherId === "none"}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
            {subject.totalClasses} ta sinfga biriktirish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab 1: Class-based assignments ───────────────────────────────────────────
function ClassAssignTab({ classes, subjects, teachers }: { classes: Class[]; subjects: Subject[]; teachers: TeacherWithSubjects[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [autoDistributeUnassignedOpen, setAutoDistributeUnassignedOpen] = useState(false);
  const [autoDistributeForceOpen, setAutoDistributeForceOpen] = useState(false);
  const isLoadingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barcha sinflarning biriktirishlarini yuklash (badge uchun)
  const { data: allClassAssignments = {}, isLoading: allAssignmentsLoading } = useQuery<Record<number, ClassSubject[]>>({
    queryKey: ["/api/classes/all/subjects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/classes/all/subjects");
      if (!res.ok) {
        console.error('Failed to load all class assignments');
        return {};
      }
      const result = await res.json();
      console.log('All class assignments loaded:', result);
      return result;
    },
  });

  const { isLoading: assignLoading } = useQuery<ClassSubject[]>({
    queryKey: ["/api/classes", selectedClassId, "subjects"],
    enabled: selectedClassId !== null,
    queryFn: async () => {
      isLoadingRef.current = true;
      const res = await apiRequest("GET", `/api/classes/${selectedClassId}/subjects`);
      const data = await res.json();
      const mapped = (data || []).map((a: any) => ({ subjectId: a.subjectId, teacherId: a.teacherId ?? null, weeklyHours: a.weeklyHours }));
      setAssignments(mapped);
      setSaveStatus("idle");
      isLoadingRef.current = false;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (toSave: Assignment[]) => {
      await apiRequest("POST", `/api/classes/${selectedClassId}/subjects`, { assignments: toSave });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes/all/subjects"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 600);
    },
    onError: () => {
      setSaveStatus("error");
      toast({ title: "Saqlashda xatolik", variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/classes/${selectedClassId}/subjects`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "subjects"] });
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes/all/subjects"] });
      setAssignments([]);
      setSaveStatus("idle");
      setClearOpen(false);
      toast({ title: "Muvaffaqiyat", description: "Biriktirishlar tez tozalandi" });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Tozalash amalga oshmadi", variant: "destructive" });
    },
  });

  const autoDistributeUnassignedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/class-subjects/auto-distribute-unassigned");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "subjects"] });
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes/all/subjects"] });
      setAutoDistributeUnassignedOpen(false);
      toast({ title: "Muvaffaqiyat", description: data.message });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    },
  });

  const autoDistributeForceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/class-subjects/auto-distribute-force-reassign");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "subjects"] });
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes/all/subjects"] });
      setAutoDistributeForceOpen(false);
      toast({ title: "Muvaffaqiyat", description: data.message });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    },
  });

  // Auto-save immediately after any assignment change
  useEffect(() => {
    if (isLoadingRef.current || selectedClassId === null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    saveMutation.mutate(assignments);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [assignments]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const selectClass = (cls: Class) => {
    setSelectedClassId(cls.id);
    setAssignments([]);
    setSaveStatus("idle");
  };

  const addRow = () => setAssignments(p => [...p, { subjectId: 0, teacherId: null, weeklyHours: 2 }]);
  const updateRow = (i: number, field: keyof Assignment, val: any) => {
    // Boshlang'ich sinf qoidasi: boshlang'ich sinf o'qituvchilari faqat
    // o'z sinfiga ruxsat etilgan fanlarga biriktirilishi mumkin
    if (field === "teacherId" && val !== null && selectedClass) {
      const gradeNum = parseInt(selectedClass.grade);
      const isPrimaryClass = gradeNum >= 1 && gradeNum <= 4;
      
      if (isPrimaryClass) {
        const teacher = teachers.find(t => t.id === val);
        const teacherGradeLevels = ((teacher as any)?.gradeLevel || "high").split(",").map((s: string) => s.trim());
        const isPrimaryTeacher = teacherGradeLevels.includes("primary");
        
        if (isPrimaryTeacher) {
          const subject = subjects.find(s => s.id === assignments[i].subjectId);
          if (subject && !isPrimaryTeacherAllowedSubject(subject.name)) {
            toast({
              title: "Ruxsat etilmagan biriktirish",
              description: `Boshlang'ich sinf o'qituvchilari "${subject.name}" faniga biriktirilmaydi. Faqat: Ona tili, Matematika, O'qish savodxonligi, Tarbiya, Sinf soati.`,
              variant: "destructive"
            });
            return; // Biriktirish amalga oshmaydi
          }
        }
      }
    }
    
    setAssignments(p => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  };
  const removeRow = (i: number) => setAssignments(p => p.filter((_, idx) => idx !== i));

  const handleAutoAssign = (newA: Assignment[]) => {
    setAssignments(newA); setAutoDialogOpen(false);
    toast({ title: "Fanlar biriktirildi", description: `${newA.length} ta fan DTS bo'yicha avtomatik saqlanmoqda...` });
  };

  const totalHours = assignments.reduce((s, a) => s + (a.weeklyHours || 0), 0);

  // Teacher load lookup for dropdown hints
  const { data: loadData } = useQuery<TeacherLoadData>({
    queryKey: ["/api/teacher-load"],
  });
  const teacherHoursMap = new Map<number, number>();
  if (loadData) {
    for (const t of loadData.teachers) teacherHoursMap.set(t.teacherId, t.totalAssignedHours);
  }

  return (
    <div className="flex gap-5 min-h-[520px]">
      {/* Left: Class list */}
      <div className="w-60 flex-shrink-0">
        <Card className="border border-gray-100 shadow-sm h-full">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" /> Sinflar
              <Badge variant="secondary" className="text-xs ml-auto">{classes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {classes.length === 0 ? (
              <div className="text-center py-8 px-4">
                <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Sinflar mavjud emas</p>
              </div>
            ) : (
              <div className="space-y-1">
                {classes.map(cls => {
                  const isActive = cls.id === selectedClassId;
                  
                  // Har bir sinf uchun o'qituvchisiz fanlar sonini hisoblash
                  const classAssigns = allClassAssignments[cls.id] || [];
                  const unassignedCount = classAssigns.filter(a => a.subjectId && !a.teacherId).length;
                  
                  return (
                    <button key={cls.id} onClick={() => selectClass(cls)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${isActive ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"}`}>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${isActive ? "bg-white/20 text-white" : gradeColor(cls.grade)}`}>{cls.grade}</span>
                      <span className="flex-1 text-sm font-medium truncate">{cls.name}</span>
                      {unassignedCount > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unassignedCount}
                        </span>
                      )}
                      <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-white/70" : "text-gray-400"}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Assignments */}
      <div className="flex-1 min-w-0">
        {!selectedClassId ? (
          <Card className="border border-dashed border-gray-200 shadow-sm h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Sinf tanlang</p>
              <p className="text-sm text-gray-400 mt-1">Chapdan sinfni bosing</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-gray-100 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{selectedClass?.name}</CardTitle>
                    <p className="text-xs text-gray-500">{selectedClass?.grade}-sinf · {selectedClass?.totalStudents || 0} o'quvchi</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">
                    <Clock className="h-3 w-3 mr-1" /> Jami: {totalHours} soat/h
                  </Badge>
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saqlanmoqda...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saqlandi
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" /> Xatolik
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAutoDialogOpen(true)}
                    className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50" disabled={assignLoading}>
                    <Zap className="mr-1.5 h-3.5 w-3.5 text-blue-500" /> DTS biriktirish
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAutoDistributeUnassignedOpen(true)}
                    className="h-8 border-green-200 text-green-700 hover:bg-green-50" disabled={assignLoading}>
                    <Zap className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Faqat bo'sh fanlarni biriktirish
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAutoDistributeForceOpen(true)}
                    className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50" disabled={assignLoading}>
                    <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Barcha fanlarni qayta biriktirish
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}
                    className="h-8 border-red-200 text-red-700 hover:bg-red-50" disabled={assignLoading || assignments.length === 0}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5 text-red-500" /> Tez tozalash
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pb-4">
              {assignLoading ? (
                <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : (
                <>
                  {assignments.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <BookOpen className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">Hali fan biriktirilmagan</p>
                      <Button variant="outline" size="sm" onClick={() => setAutoDialogOpen(true)}
                        className="mt-3 border-blue-200 text-blue-600 hover:bg-blue-50">
                        <Zap className="mr-1.5 h-3.5 w-3.5" /> DTS bo'yicha avtomatik biriktirish
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[2fr_2fr_80px_36px] gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <span>Fan</span><span>O'qituvchi</span><span className="text-center">Soat/hafta</span><span />
                      </div>
                      <div className="space-y-2">
                        {assignments.map((a, i) => {
                          const sub = subjects.find(s => s.id === a.subjectId);
                          const hasConflict = assignments.some((b, j) => j !== i && b.subjectId === a.subjectId && a.subjectId !== 0);
                          return (
                            <div key={i} className={`grid grid-cols-[2fr_2fr_80px_36px] gap-2 items-center p-2 rounded-xl border transition-colors ${hasConflict ? "border-red-200 bg-red-50" : "border-gray-100 bg-white hover:border-blue-100"}`}>
                              <Select value={a.subjectId ? String(a.subjectId) : ""} onValueChange={v => updateRow(i, "subjectId", parseInt(v))}>
                                <SelectTrigger className="h-9 text-sm border-gray-200">
                                  <SelectValue placeholder="Fan tanlang">
                                    {sub ? <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || "#3B82F6" }} />{sub.name}</span> : null}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#3B82F6" }} />{s.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={a.teacherId ? String(a.teacherId) : "none"} onValueChange={v => updateRow(i, "teacherId", v === "none" ? null : parseInt(v))}>
                                <SelectTrigger className="h-9 text-sm border-gray-200">
                                  <SelectValue placeholder="O'qituvchi (ixtiyoriy)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none"><span className="text-gray-400">Tayinlanmagan</span></SelectItem>
                                  {teachers.map(t => {
                                    const hours = teacherHoursMap.get(t.id) || 0;
                                    const max = t.maxHoursPerWeek || 30;
                                    const pct = Math.round(hours / max * 100);
                                    return (
                                      <SelectItem key={t.id} value={String(t.id)}>
                                        <span className="flex items-center justify-between gap-3 w-full">
                                          <span>{t.firstName} {t.lastName}</span>
                                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pct >= 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                            {hours}/{max}h
                                          </span>
                                        </span>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>

                              <Input type="number" min={1} max={10} value={a.weeklyHours}
                                onChange={e => updateRow(i, "weeklyHours", Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-9 text-sm text-center border-gray-200" />

                              <button onClick={() => removeRow(i)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <Button variant="outline" onClick={addRow} className="mt-3 w-full border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 h-9">
                    <Plus className="mr-2 h-4 w-4" /> Fan qo'shish
                  </Button>

                  {assignments.length > 0 && (
                    <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        {assignments.every(a => a.subjectId && a.teacherId)
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          : <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                        <div className="text-xs text-gray-600 flex flex-wrap gap-x-4">
                          <span className="font-medium">{assignments.filter(a => a.subjectId && a.teacherId).length}/{assignments.length} to'liq</span>
                          <span>{totalHours} soat/h</span>
                          <span className="text-amber-600">{assignments.filter(a => !a.teacherId).length} ta o'qituvchisiz</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AutoAssignDialog
        open={autoDialogOpen}
        onClose={() => setAutoDialogOpen(false)}
        onConfirm={handleAutoAssign}
        selectedClass={selectedClass}
        subjects={subjects}
        teachers={teachers}
        teacherLoadMap={teacherHoursMap}
      />

      <ClearAssignmentsDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => clearMutation.mutate()}
      />

      <Dialog open={autoDistributeUnassignedOpen} onOpenChange={(v) => !v && setAutoDistributeUnassignedOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Faqat bo'sh fanlarni biriktirish
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Faqat o'qituvchisiz fanlar avtomatik biriktiriladi. Biriktirilgan o'qituvchilar o'zgartirilmaydi.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoDistributeUnassignedOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => autoDistributeUnassignedMutation.mutate()} disabled={autoDistributeUnassignedMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {autoDistributeUnassignedMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
              Biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={autoDistributeForceOpen} onOpenChange={(v) => !v && setAutoDistributeForceOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Barcha fanlarni qayta biriktirish
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              <strong>Ehtiyot!</strong> Barcha fanlar qayta taqsimlaniadi. Biriktirilgan o'qituvchilar o'zgarib ketishi mumkin.
            </p>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-700">
                Bu amal faqat to'liq qayta tashkil qilish kerak bo'lganda ishlating.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoDistributeForceOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => autoDistributeForceMutation.mutate()} disabled={autoDistributeForceMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {autoDistributeForceMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="mr-1.5 h-3.5 w-3.5" />}
              Qayta biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Teacher load analytics ────────────────────────────────────────────
function YukHisobi({ teachers }: { teachers: Teacher[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [bulkSubject, setBulkSubject] = useState<TeacherLoadData["subjects"][0] | null>(null);

  const { data: loadData, isLoading } = useQuery<TeacherLoadData>({ queryKey: ["/api/teacher-load"] });

  const bulkMutation = useMutation({
    mutationFn: async ({ subjectId, teacherId }: { subjectId: number; teacherId: number | null }) => {
      await apiRequest("POST", "/api/class-subjects/bulk-assign", { subjectId, teacherId });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      setBulkSubject(null);
      const teacher = teachers.find(t => t.id === vars.teacherId);
      toast({
        title: "Biriktirildi",
        description: teacher
          ? `${teacher.firstName} ${teacher.lastName} barcha sinflarga biriktirildi`
          : "Biriktirishlar tozalandi",
      });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const autoDistributeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/class-subjects/auto-distribute-all");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-load"] });
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ 
        title: "Muvaffaqiyatli", 
        description: data.message,
      });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (!loadData) return null;

  const { subjects, teachers: teacherLoad } = loadData;
  const totalAssigned = subjects.reduce((s, x) => s + x.assignedCount, 0);
  const totalSlots = subjects.reduce((s, x) => s + x.totalClasses, 0);
  const unassigned = totalSlots - totalAssigned;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "Jami fanlar", value: subjects.length, color: "text-blue-600 bg-blue-50" },
          { icon: CheckCircle2, label: "Biriktirilgan", value: totalAssigned, color: "text-emerald-600 bg-emerald-50" },
          { icon: AlertCircle, label: "O'qituvchisiz", value: unassigned, color: unassigned > 0 ? "text-amber-600 bg-amber-50" : "text-gray-400 bg-gray-50" },
          { icon: Users, label: "O'qituvchilar", value: teacherLoad.length, color: "text-purple-600 bg-purple-50" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Subject table */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" /> Fanlar bo'yicha yuk
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Har bir fan uchun "Barcha sinflarga biriktir" tugmasini bosib o'qituvchini bir martalik belgilang</p>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <Button 
            variant="outline" 
            onClick={() => autoDistributeMutation.mutate()} 
            disabled={autoDistributeMutation.isPending}
            className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 shadow-sm flex items-center justify-center gap-2"
          >
            {autoDistributeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-amber-500" />
            )}
            Bo'sh turgan barcha darslarni avtomatik taqsimlash (Smart)
          </Button>
        </CardContent>
        <CardContent className="p-0">
          {subjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Hali fan biriktirilmagan</p>
              <p className="text-xs text-gray-400 mt-1">"Fan biriktirishlar" tabidan sinfga fan biriktiring</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* Header */}
              <div className="grid grid-cols-[2fr_80px_80px_1fr_160px] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">
                <span>Fan</span>
                <span className="text-center">Sinf</span>
                <span className="text-center">Soat/h</span>
                <span>O'qituvchilar</span>
                <span />
              </div>
              {subjects.map(sub => {
                const notAssigned = sub.totalClasses - sub.assignedCount;
                return (
                  <div key={sub.subjectId} className="grid grid-cols-[2fr_80px_80px_1fr_160px] gap-3 px-4 py-3 items-center hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.subjectColor }} />
                      <span className="text-sm font-medium text-gray-900 truncate">{sub.subjectName}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-700">{sub.totalClasses}</span>
                      <span className="text-xs text-gray-400 ml-1">ta</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-700">{sub.totalHours}</span>
                      <span className="text-xs text-gray-400 ml-1">s</span>
                    </div>
                    <div className="min-w-0">
                      {sub.teachers.length === 0 ? (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          {sub.totalClasses} ta sinf tayinlanmagan
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {sub.teachers.map(t => (
                            <span key={t.teacherId} className="text-xs text-gray-600 truncate">
                              {t.teacherName}
                              <span className="text-gray-400 ml-1">({t.classCount} sinf)</span>
                            </span>
                          ))}
                          {notAssigned > 0 && (
                            <span className="text-xs text-amber-500">{notAssigned} ta sinf tayinlanmagan</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setBulkSubject(sub)}
                        className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap">
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                        Barcha sinflarga
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher load bars */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-600" /> O'qituvchilar yuki
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Har bir o'qituvchining haftalik soat yuklamasi</p>
        </CardHeader>
        <CardContent>
          {teacherLoad.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">O'qituvchilar mavjud emas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teacherLoad.map(t => {
                const pct = Math.min(100, Math.round(t.totalAssignedHours / t.maxHours * 100));
                return (
                  <div key={t.teacherId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-600">
                          {t.teacherName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate block">{t.teacherName}</span>
                          {t.subjects.length > 0 && (
                            <span className="text-xs text-gray-400 truncate block">{t.subjects.slice(0, 3).join(", ")}{t.subjects.length > 3 ? ` +${t.subjects.length - 3}` : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${loadBg(pct)}`}>
                          {t.totalAssignedHours}/{t.maxHours} soat
                        </span>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${loadColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BulkAssignDialog
        open={bulkSubject !== null}
        onClose={() => setBulkSubject(null)}
        subject={bulkSubject}
        teachers={teachers}
        onConfirm={teacherId => {
          if (!bulkSubject) return;
          bulkMutation.mutate({ subjectId: bulkSubject.subjectId, teacherId });
        }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Biriktirishlar() {
  const [tab, setTab] = useState<"biriktirish" | "yuk">("biriktirish");
  const { data: classes = [], isLoading: clsLoading } = useQuery<Class[]>({
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
  const { data: teachers = [] } = useQuery<TeacherWithSubjects[]>({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/teachers");
      const teachers = await res.json();
      
      const teachersWithSubs = [];
      for (const t of teachers) {
        const subRes = await apiRequest("GET", `/api/teachers/${t.id}/subjects`);
        const subs = subRes.ok ? await subRes.json() : [];
        teachersWithSubs.push({
          ...t,
          subjectIds: subs.map((s: any) => s.subjectId)
        });
      }
      return teachersWithSubs as any[];
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fan biriktirishlar</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Sinfga fan va o'qituvchi biriktirish · O'qituvchi yuki hisobi
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: "biriktirish", label: "Fan biriktirishlar", icon: BookOpen },
          { key: "yuk", label: "Yuk hisobi", icon: BarChart3 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap -mb-px ${
              tab === key
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {clsLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />)}</div>
      ) : tab === "biriktirish" ? (
        <ClassAssignTab classes={classes} subjects={subjects} teachers={teachers} />
      ) : (
        <YukHisobi teachers={teachers} />
      )}
    </div>
  );
}
