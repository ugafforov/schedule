import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Save, GraduationCap, BookOpen, Users,
  Clock, ChevronRight, AlertCircle, CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Class, Subject, Teacher, ClassSubject } from "@shared/schema";

interface Assignment {
  subjectId: number;
  teacherId: number | null;
  weeklyHours: number;
}

const GRADE_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-red-100 text-red-700 border-red-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];

function gradeColor(grade: string) {
  const n = parseInt(grade) || 0;
  return GRADE_COLORS[(n - 1) % GRADE_COLORS.length] || GRADE_COLORS[0];
}

export default function Biriktirishlar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: classes = [], isLoading: clsLoading } = useQuery<Class[]>({ queryKey: ["/api/classes"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: teachers = [] } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });

  const { isLoading: assignLoading } = useQuery<ClassSubject[]>({
    queryKey: ["/api/classes", selectedClassId, "subjects"],
    enabled: selectedClassId !== null,
    queryFn: async () => {
      const data = await (await fetch(`/api/classes/${selectedClassId}/subjects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })).json() as ClassSubject[];
      setAssignments(
        data.map((a: ClassSubject) => ({
          subjectId: a.subjectId,
          teacherId: a.teacherId ?? null,
          weeklyHours: a.weeklyHours,
        }))
      );
      setDirty(false);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/classes/${selectedClassId}/subjects`, { subjects: assignments }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "subjects"] });
      setDirty(false);
      toast({ title: "Saqlandi", description: "Fanlar biriktirildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const selectClass = (cls: Class) => {
    if (dirty) {
      if (!confirm("Saqllanmagan o'zgarishlar bor. Davom etasizmi?")) return;
    }
    setSelectedClassId(cls.id);
    setAssignments([]);
    setDirty(false);
  };

  const addRow = () => {
    setAssignments(prev => [...prev, { subjectId: 0, teacherId: null, weeklyHours: 2 }]);
    setDirty(true);
  };

  const updateRow = (i: number, field: keyof Assignment, val: any) => {
    setAssignments(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
    setDirty(true);
  };

  const removeRow = (i: number) => {
    setAssignments(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const totalHours = assignments.reduce((s, a) => s + (a.weeklyHours || 0), 0);
  const usedSubjectIds = assignments.map(a => a.subjectId).filter(Boolean);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fan biriktirishlar</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Har bir sinfga fan, o'qituvchi va haftalik soat biriktirib chiqing
        </p>
      </div>

      <div className="flex gap-5 min-h-[520px]">
        {/* Left: Class list */}
        <div className="w-64 flex-shrink-0">
          <Card className="border border-gray-100 shadow-sm h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                Sinflar
                <Badge variant="secondary" className="text-xs ml-auto">{classes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {clsLoading ? (
                <div className="space-y-2 px-2">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Sinflar mavjud emas</p>
                  <p className="text-xs text-gray-400 mt-1">Avval sinf qo'shing</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {classes.map(cls => {
                    const isActive = cls.id === selectedClassId;
                    return (
                      <button
                        key={cls.id}
                        onClick={() => selectClass(cls)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                          isActive ? "bg-white/20 text-white" : gradeColor(cls.grade)
                        }`}>
                          {cls.grade}
                        </span>
                        <span className="flex-1 text-sm font-medium truncate">{cls.name}</span>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{selectedClass?.name}</CardTitle>
                      <p className="text-xs text-gray-500">{selectedClass?.grade}-sinf • {selectedClass?.totalStudents || 0} o'quvchi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Jami: {totalHours} soat/hafta
                    </Badge>
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || !dirty}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 h-8"
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Saqlash
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto pb-4">
                {assignLoading ? (
                  <div className="space-y-2">
                    {Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />)}
                  </div>
                ) : (
                  <>
                    {assignments.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <BookOpen className="h-5 w-5 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">Hali fan biriktirilmagan</p>
                        <p className="text-xs text-gray-400 mt-1">Quyidagi tugmani bosib fan qo'shing</p>
                      </div>
                    ) : (
                      <>
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_2fr_1fr_40px] gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          <span>Fan</span>
                          <span>O'qituvchi</span>
                          <span className="text-center">Haftalik soat</span>
                          <span />
                        </div>

                        {/* Rows */}
                        <div className="space-y-2">
                          {assignments.map((a, i) => {
                            const sub = subjects.find(s => s.id === a.subjectId);
                            const hasConflict = assignments.some(
                              (b, j) => j !== i && b.subjectId === a.subjectId && a.subjectId !== 0
                            );
                            return (
                              <div
                                key={i}
                                className={`grid grid-cols-[2fr_2fr_1fr_40px] gap-2 items-center p-2 rounded-xl border transition-colors ${
                                  hasConflict ? "border-red-200 bg-red-50" : "border-gray-100 bg-white hover:border-blue-100"
                                }`}
                              >
                                <Select
                                  value={a.subjectId ? String(a.subjectId) : ""}
                                  onValueChange={v => updateRow(i, "subjectId", parseInt(v))}
                                >
                                  <SelectTrigger className="h-9 text-sm border-gray-200">
                                    <SelectValue placeholder="Fan tanlang">
                                      {sub ? (
                                        <span className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || "#3B82F6" }} />
                                          {sub.name}
                                        </span>
                                      ) : null}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {subjects.map(s => (
                                      <SelectItem key={s.id} value={String(s.id)}>
                                        <span className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#3B82F6" }} />
                                          {s.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Select
                                  value={a.teacherId ? String(a.teacherId) : "none"}
                                  onValueChange={v => updateRow(i, "teacherId", v === "none" ? null : parseInt(v))}
                                >
                                  <SelectTrigger className="h-9 text-sm border-gray-200">
                                    <SelectValue placeholder="O'qituvchi (ixtiyoriy)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      <span className="text-gray-400">Tayinlanmagan</span>
                                    </SelectItem>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={String(t.id)}>
                                        {t.firstName} {t.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={a.weeklyHours}
                                  onChange={e => updateRow(i, "weeklyHours", Math.max(1, parseInt(e.target.value) || 1))}
                                  className="h-9 text-sm text-center border-gray-200"
                                />

                                <button
                                  onClick={() => removeRow(i)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <Button
                      variant="outline"
                      onClick={addRow}
                      className="mt-3 w-full border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 h-9"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Fan qo'shish
                    </Button>

                    {/* Summary */}
                    {assignments.length > 0 && (
                      <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-start gap-2">
                          {assignments.every(a => a.subjectId && a.teacherId) ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <p className="font-medium">
                              {assignments.filter(a => a.subjectId && a.teacherId).length}/{assignments.length} fan to'liq biriktirilgan
                            </p>
                            <div className="flex flex-wrap gap-x-4 text-gray-500">
                              <span>{assignments.length} ta fan</span>
                              <span>{totalHours} soat/hafta</span>
                              <span>{assignments.filter(a => !a.teacherId).length} ta o'qituvchisiz</span>
                            </div>
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
      </div>
    </div>
  );
}
