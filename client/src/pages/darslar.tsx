import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, RotateCcw, Save, Plus, Trash2, Pencil, Zap, CheckCircle, AlertTriangle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { TimeSlot } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────
type RowType = "lesson";

interface SlotRow {
  key: string;
  type: RowType;
  periodNumber: number;
  startTime: string;
  endTime: string;
}

interface GenConfig {
  schoolStart: string;
  schoolEnd: string;
  lessonMin: number;
  breakMin: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toHHMM(t: string): string {
  return (t || "").slice(0, 5);
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function HHMMtoMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minuteDiff(start: string, end: string): number {
  return HHMMtoMinutes(end) - HHMMtoMinutes(start);
}

function addMinutes(time: string, mins: number): string {
  return minutesToHHMM(HHMMtoMinutes(time) + mins);
}

let keyCounter = 0;
function newKey(): string {
  return `row-${++keyCounter}-${Date.now()}`;
}

// ─── Generator ───────────────────────────────────────────────────────────────
function generateSchedule(cfg: GenConfig): SlotRow[] {
  const rows: SlotRow[] = [];
  let current = cfg.schoolStart;
  let lessonNum = 0;

  while (true) {
    const lessonEnd = addMinutes(current, cfg.lessonMin);
    if (HHMMtoMinutes(lessonEnd) > HHMMtoMinutes(cfg.schoolEnd)) break;

    lessonNum++;
    rows.push({
      key: newKey(),
      type: "lesson",
      periodNumber: lessonNum,
      startTime: current,
      endTime: lessonEnd,
    });
    current = lessonEnd;

    current = addMinutes(current, cfg.breakMin);
  }
  return rows;
}

// ─── Build local rows from saved DB slots ────────────────────────────────────
function buildRowsFromSlots(slots: TimeSlot[]): SlotRow[] {
  const day1 = slots.filter(s => s.dayOfWeek === 1);
  if (day1.length === 0) return [];
  return day1
    .sort((a, b) => {
      const ta = HHMMtoMinutes(toHHMM(a.startTime));
      const tb = HHMMtoMinutes(toHHMM(b.startTime));
      return ta - tb;
    })
    .map(s => ({
      key: newKey(),
      type: "lesson",
      periodNumber: s.periodNumber,
      startTime: toHHMM(s.startTime),
      endTime: toHHMM(s.endTime),
    }));
}

// ─── Row type badge styles ────────────────────────────────────────────────────
function rowStyle(type: RowType) {
  if (type === "lesson") return {
    bg: "bg-white hover:bg-blue-50/40 border-gray-100",
    badge: "bg-blue-100 text-blue-700",
    icon: null as any,
    label: (n: number) => `${n}-dars`,
  };
  return {
    bg: "bg-white hover:bg-blue-50/40 border-gray-100",
    badge: "bg-blue-100 text-blue-700",
    icon: null as any,
    label: (n: number) => `${n}-dars`,
  };
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────
function EditDialog({
  row, open, onClose, onSave,
}: {
  row: SlotRow | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Partial<SlotRow>) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => {
    if (row) {
      setStart(row.startTime);
      setEnd(row.endTime);
    }
  }, [row]);

  const dur = minuteDiff(start, end);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            {`${row?.periodNumber || 0}-dars vaqtini o'zgartirish`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Boshlanish</Label>
              <Input
                type="time"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Tugash</Label>
              <Input
                type="time"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          {dur > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle className="h-4 w-4" />
              Davomiyligi: <strong>{dur} daqiqa</strong>
            </div>
          )}
          {dur <= 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4" />
              Vaqt noto'g'ri
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button
            onClick={() => { onSave({ startTime: start, endTime: end }); onClose(); }}
            disabled={dur <= 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Row Dialog ───────────────────────────────────────────────────────────
function AddDialog({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (row: Omit<SlotRow, "key">) => void;
}) {
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:45");
  const dur = minuteDiff(start, end);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />
            Yangi qator qo'shish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Boshlanish</Label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Tugash</Label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="font-mono" />
            </div>
          </div>
          {dur > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle className="h-4 w-4" />
              Davomiyligi: <strong>{dur} daqiqa</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button
            onClick={() => {
              onAdd({ type: "lesson", periodNumber: 0, startTime: start, endTime: end });
              onClose();
            }}
            disabled={dur <= 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Qo'shish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Darslar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: savedSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots"],
  });

  // Generator config state
  const [cfg, setCfg] = useState<GenConfig>({
    schoolStart: "08:00",
    schoolEnd: "14:00",
    lessonMin: 45,
    breakMin: 10,
    useLunch: false,
    lunchAfterLesson: 3,
    lunchMin: 30,
  });

  // Local editable rows
  const [rows, setRows] = useState<SlotRow[]>([]);
  const [editTarget, setEditTarget] = useState<SlotRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  // Load from saved DB on mount
  useEffect(() => {
    if (savedSlots.length > 0 && rows.length === 0) {
      const built = buildRowsFromSlots(savedSlots);
      if (built.length > 0) {
        setRows(built);
        setGenerated(true);
      }
    }
  }, [savedSlots]);

  // Recompute period numbers to be sequential
  function reindex(r: SlotRow[]): SlotRow[] {
    let n = 0;
    return r.map(row => {
      if (row.type === "lesson") {
        n++;
        return { ...row, periodNumber: n };
      }
      return { ...row, periodNumber: 0 };
    });
  }

  function handleGenerate() {
    const result = generateSchedule(cfg);
    setRows(result);
    setGenerated(true);
  }

  function handleReset() {
    const defaultCfg: GenConfig = {
      schoolStart: "08:00", schoolEnd: "14:00",
      lessonMin: 45, breakMin: 10,
      useLunch: false, lunchAfterLesson: 3, lunchMin: 30,
    };
    setCfg(defaultCfg);
    const result = generateSchedule(defaultCfg);
    setRows(result);
    setGenerated(true);
  }

  function handleDeleteRow(key: string) {
    setRows(prev => reindex(prev.filter(r => r.key !== key)));
    setShowDeleteConfirm(null);
  }

  function handleEditSave(updated: Partial<SlotRow>) {
    if (!editTarget) return;
    setRows(prev => reindex(prev.map(r =>
      r.key === editTarget.key ? { ...r, ...updated } : r
    )));
    setEditTarget(null);
  }

  function handleAdd(data: Omit<SlotRow, "key">) {
    const newRow: SlotRow = { ...data, key: newKey() };
    setRows(prev => {
      const sorted = [...prev, newRow].sort((a, b) =>
        HHMMtoMinutes(a.startTime) - HHMMtoMinutes(b.startTime)
      );
      return reindex(sorted);
    });
  }

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/time-slots/save", { rows }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/time-slots"] });
      toast({ title: "Saqlandi", description: "Qo'ng'iroq jadvali muvaffaqiyatli saqlandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const lessonCount = rows.filter(r => r.type === "lesson").length;
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dars soatlari</h1>
          <p className="text-gray-500 text-sm mt-0.5">Avtomatik qo'ng'iroq jadvalini tuzing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="text-gray-600">
            <RotateCcw className="mr-2 h-4 w-4" />
            Standartga qaytarish
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || rows.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-2 h-4 w-4" />
            Saqlash
          </Button>
        </div>
      </div>

      {/* Generator Card */}
      <Card className="border border-blue-100 bg-blue-50/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
            <Zap className="h-4 w-4" />
            Avtomatik jadval generatori
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: school start/end times */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Maktab boshlanishi</Label>
              <Input
                type="time"
                value={cfg.schoolStart}
                onChange={e => setCfg(p => ({ ...p, schoolStart: e.target.value }))}
                className="font-mono bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Maktab tugashi</Label>
              <Input
                type="time"
                value={cfg.schoolEnd}
                onChange={e => setCfg(p => ({ ...p, schoolEnd: e.target.value }))}
                className="font-mono bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Dars davomiyligi (daq)</Label>
              <Input
                type="number"
                min={20}
                max={90}
                value={cfg.lessonMin}
                onChange={e => setCfg(p => ({ ...p, lessonMin: Number(e.target.value) }))}
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Darslar oralig'i (daq)</Label>
              <Input
                type="number"
                min={5}
                max={30}
                value={cfg.breakMin}
                onChange={e => setCfg(p => ({ ...p, breakMin: Number(e.target.value) }))}
                className="bg-white"
              />
            </div>
          </div>

          {/* Row 2: Lunch settings */}
          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex items-center gap-2 mt-1">
              <Switch
                checked={cfg.useLunch}
                onCheckedChange={v => setCfg(p => ({ ...p, useLunch: v }))}
                id="lunch-toggle"
              />
              <Label htmlFor="lunch-toggle" className="text-sm text-gray-700 cursor-pointer select-none">
                Kechki tushlik vaqti
              </Label>
            </div>
            {cfg.useLunch && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Nechi darsdan keyin</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={cfg.lunchAfterLesson}
                    onChange={e => setCfg(p => ({ ...p, lunchAfterLesson: Number(e.target.value) }))}
                    className="w-24 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Tushlik davomiyligi (daq)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    value={cfg.lunchMin}
                    onChange={e => setCfg(p => ({ ...p, lunchMin: Number(e.target.value) }))}
                    className="w-28 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
          >
            <Zap className="mr-2 h-4 w-4" />
            Jadval tuzish
          </Button>
        </CardContent>
      </Card>

      {/* Schedule list */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Dars jadvali soatlari
              <Badge variant="secondary" className="text-xs ml-1">{lessonCount} ta dars</Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAdd(true)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Qo'shish
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Bu vaqtlar Dushanba–Juma barcha kunlarga qo'llaniladi</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <Clock className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm">Hozircha jadval yo'q</p>
              <p className="text-xs">Yuqoridagi generatorni ishlatib jadval tuzing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(row => {
                const style = rowStyle(row.type);
                const dur = minuteDiff(row.startTime, row.endTime);
                const Icon = style.icon;
                return (
                  <div
                    key={row.key}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${style.bg}`}
                  >
                    {/* Badge / icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.badge}`}>
                      {row.type === "lesson" ? (
                        <span className="font-bold text-sm">{row.periodNumber}</span>
                      ) : (
                        Icon && <Icon className="h-4 w-4" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="w-20 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-700">
                        {style.label(row.periodNumber)}
                      </span>
                    </div>

                    {/* Times */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <Input
                        type="time"
                        value={row.startTime}
                        onChange={e => setRows(prev => reindex(prev.map(r =>
                          r.key === row.key ? { ...r, startTime: e.target.value } : r
                        )))}
                        className="h-8 w-28 text-sm font-mono bg-white"
                      />
                      <span className="text-gray-300">—</span>
                      <Input
                        type="time"
                        value={row.endTime}
                        onChange={e => setRows(prev => reindex(prev.map(r =>
                          r.key === row.key ? { ...r, endTime: e.target.value } : r
                        )))}
                        className="h-8 w-28 text-sm font-mono bg-white"
                      />
                    </div>

                    {/* Duration badge */}
                    <div className="flex-shrink-0">
                      {dur > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {dur} daqiqa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Noto'g'ri
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => setEditTarget(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => setShowDeleteConfirm(row.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="border border-amber-100 bg-amber-50/50 shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Eslatma</p>
              <p className="text-xs mt-0.5 text-amber-700">
                Dars soatlarini o'zgartirgandan so'ng, mavjud jadval qayta generatsiya qilinishi kerak bo'ladi.
                Vaqtlar barcha darslar uchun bir xil qo'llaniladi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditDialog
        row={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
      />

      {/* Add dialog */}
      <AddDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              O'chirishni tasdiqlang
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Bu qatorni o'chirishni xohlaysizmi?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Bekor</Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteRow(showDeleteConfirm)}
            >
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
