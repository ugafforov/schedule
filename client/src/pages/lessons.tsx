import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, RotateCcw, Save, Plus, Trash2, Pencil, Zap, CheckCircle, AlertTriangle, UtensilsCrossed,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { TimeSlot } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
type RowType = "lesson" | "lunch";

interface SlotRow {
  key: string;
  type: RowType;
  periodNumber: number; // lesson number (1,2,3…); 0 for lunch
  startTime: string;
  endTime: string;
  meta?: "day-lunch" | "evening-lunch";
}

interface GenConfig {
  schoolStart: string;
  schoolEnd: string;
  lessonMin: number;
  breakMin: number;
  useLunch: boolean;
  lunchAfterLesson: number;
  lunchMin: number;
  useEveningLunch: boolean;
  eveningLunchAfterLesson: number;
  eveningLunchMin: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toHHMM(t: string) { return (t || "").slice(0, 5); }

function minutesToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMin(t: string, m: number) { return minutesToHHMM(toMin(t) + m); }
function diff(a: string, b: string) { return toMin(b) - toMin(a); }

let _k = 0;
const mk = () => `r-${++_k}-${Date.now()}`;

// ─── Generator ────────────────────────────────────────────────────────────────
function generate(cfg: GenConfig): SlotRow[] {
  const rows: SlotRow[] = [];
  let cur = cfg.schoolStart;
  let num = 0;

  while (true) {
    const end = addMin(cur, cfg.lessonMin);
    if (toMin(end) > toMin(cfg.schoolEnd)) break;

    num++;
    rows.push({ key: mk(), type: "lesson", periodNumber: num, startTime: cur, endTime: end });
    cur = end;

    if (cfg.useLunch && num === cfg.lunchAfterLesson) {
      const lend = addMin(cur, cfg.lunchMin);
      rows.push({ key: mk(), type: "lunch", periodNumber: 0, startTime: cur, endTime: lend, meta: "day-lunch" });
      cur = lend;
    } else if (cfg.useEveningLunch && num === cfg.eveningLunchAfterLesson) {
      const lend = addMin(cur, cfg.eveningLunchMin);
      rows.push({ key: mk(), type: "lunch", periodNumber: 0, startTime: cur, endTime: lend, meta: "evening-lunch" });
      cur = lend;
    } else {
      cur = addMin(cur, cfg.breakMin);
    }
  }
  return rows;
}

// ─── Load from DB ─────────────────────────────────────────────────────────────
function fromSlots(slots: TimeSlot[]): SlotRow[] {
  const day1 = slots.filter(s => s.dayOfWeek === 1);
  if (!day1.length) return [];
  return day1
    .sort((a, b) => toMin(toHHMM(a.startTime)) - toMin(toHHMM(b.startTime)))
    .map(s => ({
      key: mk(),
      type: (s.isBreak && (s.name || "").toLowerCase().includes("tushlik") ? "lunch" : "lesson") as RowType,
      periodNumber: s.periodNumber,
      startTime: toHHMM(s.startTime),
      endTime: toHHMM(s.endTime),
      meta: s.isBreak && (s.name || "").toLowerCase().includes("kechki")
        ? "evening-lunch"
        : s.isBreak && (s.name || "").toLowerCase().includes("tushlik")
          ? "day-lunch"
          : undefined,
    }));
}

function deriveCfgFromRows(rows: SlotRow[]): GenConfig {
  const lessons = rows.filter(r => r.type === "lesson");
  const lunches = rows.filter(r => r.type === "lunch");
  const dayLunch = lunches.find(r => r.meta === "day-lunch");
  const eveningLunch = lunches.find(r => r.meta === "evening-lunch");

  if (lessons.length === 0) return { ...DEFAULT_CFG };

  // Calculate breakMin by finding the first gap between two consecutive lessons
  let breakMin = DEFAULT_CFG.breakMin;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].type === "lesson" && rows[i + 1].type === "lesson") {
      breakMin = diff(rows[i].endTime, rows[i + 1].startTime);
      break;
    }
  }

  // Find which lesson number lunch comes after
  const getAfterLesson = (lunchRow: SlotRow | undefined) => {
    if (!lunchRow) return 1;
    const beforeLessons = lessons.filter(l => toMin(l.endTime) <= toMin(lunchRow.startTime));
    return beforeLessons.length > 0 ? beforeLessons.length : 1;
  };

  return {
    schoolStart: lessons[0].startTime,
    schoolEnd: lessons[lessons.length - 1].endTime,
    lessonMin: diff(lessons[0].startTime, lessons[0].endTime),
    breakMin: breakMin,
    useLunch: Boolean(dayLunch),
    lunchAfterLesson: getAfterLesson(dayLunch),
    lunchMin: dayLunch ? diff(dayLunch.startTime, dayLunch.endTime) : DEFAULT_CFG.lunchMin,
    useEveningLunch: Boolean(eveningLunch),
    eveningLunchAfterLesson: getAfterLesson(eveningLunch),
    eveningLunchMin: eveningLunch ? diff(eveningLunch.startTime, eveningLunch.endTime) : DEFAULT_CFG.eveningLunchMin,
  };
}

// Reindex lesson numbers sequentially
function reindex(rows: SlotRow[]): SlotRow[] {
  let n = 0;
  return rows.map(r => r.type === "lesson" ? { ...r, periodNumber: ++n } : { ...r, periodNumber: 0 });
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
function EditDialog({ row, open, onClose, onSave }: {
  row: SlotRow | null; open: boolean; onClose: () => void; onSave: (u: Partial<SlotRow>) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => { if (row) { setStart(row.startTime); setEnd(row.endTime); } }, [row]);
  const d = diff(start, end);
  const title = row?.type === "lesson"
    ? `${row.periodNumber}-dars vaqtini o'zgartirish`
    : "Tushlik vaqtini o'zgartirish";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />{title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Boshlanish</Label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tugash</Label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="font-mono" />
            </div>
          </div>
          {d > 0
            ? <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle className="h-4 w-4" />Davomiyligi: <strong>{d} daqiqa</strong>
              </div>
            : <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4" />Vaqt noto'g'ri
              </div>
          }
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => { onSave({ startTime: start, endTime: end }); onClose(); }}
            disabled={d <= 0} className="bg-primary hover:bg-primary/90">Saqlash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Dialog ───────────────────────────────────────────────────────────────
function AddDialog({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void; onAdd: (r: Omit<SlotRow, "key">) => void;
}) {
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:45");
  const [type, setType] = useState<RowType>("lesson");
  const d = diff(start, end);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />Yangi qator qo'shish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button size="sm" variant={type === "lesson" ? "default" : "outline"} onClick={() => setType("lesson")} className={type === "lesson" ? "bg-primary hover:bg-primary/90" : ""}>Dars</Button>
            <Button size="sm" variant={type === "lunch" ? "default" : "outline"} onClick={() => setType("lunch")} className={type === "lunch" ? "bg-orange-500 hover:bg-orange-600 text-primary-foreground" : ""}>Tushlik</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Boshlanish</Label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tugash</Label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="font-mono" />
            </div>
          </div>
          {d > 0 && <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle className="h-4 w-4" />Davomiyligi: <strong>{d} daqiqa</strong>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button
            onClick={() => { onAdd({ type, periodNumber: 0, startTime: start, endTime: end }); onClose(); }}
            disabled={d <= 0} className="bg-primary hover:bg-primary/90">Qo'shish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const DEFAULT_CFG: GenConfig = {
  schoolStart: "08:00", schoolEnd: "14:00",
  lessonMin: 45, breakMin: 10,
  useLunch: false, lunchAfterLesson: 3, lunchMin: 30,
  useEveningLunch: false, eveningLunchAfterLesson: 5, eveningLunchMin: 20,
};

export default function Darslar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: savedSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots"],
  });

  const [cfg, setCfg] = useState<GenConfig>({ ...DEFAULT_CFG });
  const [rows, setRows] = useState<SlotRow[]>([]);
  const [editTarget, setEditTarget] = useState<SlotRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const built = fromSlots(savedSlots);
    if (savedSlots.length > 0) {
      loadedRef.current = true;
      if (built.length > 0) {
        setRows(built);
        setCfg(deriveCfgFromRows(built));
      }
    } else if (!loadedRef.current) {
      setRows([]);
    }
  }, [savedSlots, isLoading]);

  function handleGenerate() {
    setRows(reindex(generate(cfg)));
  }

  function handleReset() {
    setCfg({ ...DEFAULT_CFG });
    setRows(reindex(generate(DEFAULT_CFG)));
  }

  function handleEditSave(upd: Partial<SlotRow>) {
    if (!editTarget) return;
    setRows(prev => reindex(prev.map(r => r.key === editTarget.key ? { ...r, ...upd } : r)));
    setEditTarget(null);
  }

  function handleAdd(data: Omit<SlotRow, "key">) {
    const nr: SlotRow = { ...data, key: mk() };
    setRows(prev => reindex(
      [...prev, nr].sort((a, b) => toMin(a.startTime) - toMin(b.startTime))
    ));
  }

  function handleDelete(key: string) {
    setRows(prev => reindex(prev.filter(r => r.key !== key)));
    setDeleteKey(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/time-slots/save", { rows: rows.map(r => ({
        type: r.type,
        periodNumber: r.periodNumber,
        startTime: r.startTime,
        endTime: r.endTime,
        meta: r.meta
      })) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/time-slots"] });
      toast({ title: "Saqlandi", description: "Qo'ng'iroq jadvali saqlandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const lessonCount = rows.filter(r => r.type === "lesson").length;
  const lunchCount = rows.filter(r => r.type === "lunch").length;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dars soatlari</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Avtomatik qo'ng'iroq jadvalini tuzing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="text-foreground">
            <RotateCcw className="mr-2 h-4 w-4" />Standartga qaytarish
          </Button>
          <Button onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || rows.length === 0}
            className="bg-primary hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" />Saqlash
          </Button>
        </div>
      </div>

      {/* Generator */}
      <Card className="border border-blue-500/20 bg-blue-500/10 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Zap className="h-4 w-4" />Avtomatik jadval generatori
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Maktab boshlanishi</Label>
              <Input type="time" value={cfg.schoolStart}
                onChange={e => setCfg(p => ({ ...p, schoolStart: e.target.value }))}
                className="font-mono bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Maktab tugashi</Label>
              <Input type="time" value={cfg.schoolEnd}
                onChange={e => setCfg(p => ({ ...p, schoolEnd: e.target.value }))}
                className="font-mono bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dars davomiyligi (daq)</Label>
              <Input type="number" min={20} max={90} value={cfg.lessonMin}
                onChange={e => setCfg(p => ({ ...p, lessonMin: Number(e.target.value) }))}
                className="bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tanaffus (daq)</Label>
              <Input type="number" min={5} max={30} value={cfg.breakMin}
                onChange={e => setCfg(p => ({ ...p, breakMin: Number(e.target.value) }))}
                className="bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Tushlik tanaffusi</p>
                  <p className="text-xs text-muted-foreground">Kun o‘rtasidagi tushlik vaqti.</p>
                </div>
                <Switch checked={cfg.useLunch} id="lunch-sw" onCheckedChange={v => setCfg(p => ({ ...p, useLunch: v }))} />
              </div>
              {cfg.useLunch && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nechi darsdan keyin</Label>
                    <Input type="number" min={1} max={8} value={cfg.lunchAfterLesson} onChange={e => setCfg(p => ({ ...p, lunchAfterLesson: Number(e.target.value) }))} className="w-full bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tushlik davomiyligi (daq)</Label>
                    <Input type="number" min={10} max={60} value={cfg.lunchMin} onChange={e => setCfg(p => ({ ...p, lunchMin: Number(e.target.value) }))} className="w-full bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Kechki tushlik</p>
                  <p className="text-xs text-muted-foreground">Ikkinchi tushlik varianti.</p>
                </div>
                <Switch checked={cfg.useEveningLunch} id="evening-lunch-sw" onCheckedChange={v => setCfg(p => ({ ...p, useEveningLunch: v }))} />
              </div>
              {cfg.useEveningLunch && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nechi darsdan keyin</Label>
                    <Input type="number" min={1} max={8} value={cfg.eveningLunchAfterLesson} onChange={e => setCfg(p => ({ ...p, eveningLunchAfterLesson: Number(e.target.value) }))} className="w-full bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Davomiyligi (daq)</Label>
                    <Input type="number" min={10} max={60} value={cfg.eveningLunchMin} onChange={e => setCfg(p => ({ ...p, eveningLunchMin: Number(e.target.value) }))} className="w-full bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                  </div>
                </div>
              )}
          </div>

          <Button onClick={handleGenerate} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            <Zap className="mr-2 h-4 w-4" />Jadval tuzish
          </Button>
        </CardContent>
      </Card>

      {/* Schedule list */}
      <Card className="border border-border shadow-sm bg-card text-card-foreground">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Dars jadvali soatlari
              <Badge variant="secondary" className="text-xs ml-1 bg-muted text-foreground">{lessonCount} ta dars</Badge>
              {lunchCount > 0 && (
                <Badge className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
                  {lunchCount} ta tushlik
                </Badge>
              )}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}
              className="text-primary border-primary/20 hover:bg-primary/10">
              <Plus className="h-4 w-4 mr-1" />Qo'shish
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">Bu vaqtlar Dushanba–Juma barcha kunlarga qo'llaniladi</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/60 space-y-2">
              <Clock className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm">Hozircha jadval yo'q</p>
              <p className="text-xs">Yuqoridagi generatorni ishlatib jadval tuzing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(row => {
                const isLesson = row.type === "lesson";
                const d = diff(row.startTime, row.endTime);
                return (
                  <div key={row.key}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${
                      isLesson
                        ? "bg-card hover:bg-muted/40 border-border text-card-foreground"
                        : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    }`}>

                    {/* Badge */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLesson ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"}`}>
                      {isLesson ? <span className="font-bold text-sm">{row.periodNumber}</span> : <UtensilsCrossed className="h-4 w-4" />}
                    </div>

                    {/* Label */}
                    <div className="w-20 flex-shrink-0">
                      <span className={`text-sm font-medium ${isLesson ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                        {isLesson ? `${row.periodNumber}-dars` : "Tushlik"}
                      </span>
                    </div>

                    {/* Times */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <Input type="time" value={row.startTime}
                        onChange={e => setRows(prev => reindex(prev.map(r =>
                          r.key === row.key ? { ...r, startTime: e.target.value } : r
                        )))}
                        className="h-8 w-28 text-sm font-mono bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                      <span className="text-gray-300">—</span>
                      <Input type="time" value={row.endTime}
                        onChange={e => setRows(prev => reindex(prev.map(r =>
                          r.key === row.key ? { ...r, endTime: e.target.value } : r
                        )))}
                        className="h-8 w-28 text-sm font-mono bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                    </div>

                    {/* Duration */}
                    <div className="flex-shrink-0">
                      {d > 0
                        ? <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                            <CheckCircle className="h-3 w-3 mr-1" />{d} daqiqa
                          </Badge>
                        : <Badge variant="outline" className="text-xs text-red-500 border-red-500/20 bg-red-500/10">
                            <AlertTriangle className="h-3 w-3 mr-1" />Noto'g'ri
                          </Badge>
                      }
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                        onClick={() => setEditTarget(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => setDeleteKey(row.key)}>
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
      <Card className="border border-amber-500/20 bg-amber-500/10 shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Eslatma</p>
              <p className="text-xs mt-0.5 text-amber-600/90 dark:text-amber-400/90">
                Dars soatlarini o'zgartirgandan so'ng, mavjud jadval qayta generatsiya qilinishi kerak bo'ladi.
                Vaqtlar barcha darslar uchun bir xil qo'llaniladi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditDialog row={editTarget} open={!!editTarget}
        onClose={() => setEditTarget(null)} onSave={handleEditSave} />

      <AddDialog open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />

      <Dialog open={!!deleteKey} onOpenChange={v => { if (!v) setDeleteKey(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />O'chirishni tasdiqlang
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Bu qatorni o'chirishni xohlaysizmi?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKey(null)}>Bekor</Button>
            <Button variant="destructive" onClick={() => deleteKey && handleDelete(deleteKey)}>O'chirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
