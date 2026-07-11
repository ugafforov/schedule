import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, BookOpen, X, Clock, DoorOpen, Zap, CheckSquare, Square, GraduationCap, LayoutGrid, List, FileSpreadsheet } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { ROOM_TYPE_LABELS } from "@shared/schema";
import type { Subject } from "@shared/schema";
import { InlineEdit, InlineSelect } from "@/components/ui/inline-edit";
import { ExcelImportDialog } from "@/components/bulk/excel-import-dialog";

interface SubjectFormData {
  name: string; code: string; description: string;
  color: string; weeklyHours: number; requiredRoomType: string;
}

const EMPTY_FORM: SubjectFormData = {
  name: "", code: "", description: "", color: "#3B82F6", weeklyHours: 4, requiredRoomType: "any",
};

const COLORS = [
  { hex: "#3B82F6", label: "Ko'k" }, { hex: "#10B981", label: "Yashil" },
  { hex: "#8B5CF6", label: "Binafsha" }, { hex: "#F59E0B", label: "Sariq" },
  { hex: "#EF4444", label: "Qizil" }, { hex: "#06B6D4", label: "Moviy" },
  { hex: "#EC4899", label: "Pushti" }, { hex: "#14B8A6", label: "Zangori" },
  { hex: "#F97316", label: "To'q sariq" }, { hex: "#6366F1", label: "Indigo" },
];

const ROOM_TYPE_COLORS: Record<string, string> = {
  any: "bg-muted text-muted-foreground border-border",
  classroom: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  lab: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  gym: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  computer: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  music: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  art: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
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

interface DtsSubject {
  name: string; code: string; color: string;
  weeklyHours: number; requiredRoomType: string; description: string;
}

// DTS 2026-2027 — 133-son buyruq (10.04.2026)
// PDF 1-ILOVA bo'yicha har bir fan ALOHIDA (birlashtirilmagan).
// Jami 29 ta fan — 5 bo'lim: Filologiya, Ijtimoiy, Aniq, Tabiiy, Amaliy
const DTS_GROUPS: { label: string; sinf: string; color: string; subjects: DtsSubject[] }[] = [
  {
    label: "I. Filologiya", sinf: "1–11-sinf", color: "blue",
    subjects: [
      { name: "Ona tili",                               code: "ONA",      color: "#3B82F6", weeklyHours: 4, requiredRoomType: "classroom", description: "1–6: 4s | 7–9: 3s | 10–11: 2s (haftalik)" },
      { name: "O'qish savodxonligi",                    code: "OQISH",    color: "#60A5FA", weeklyHours: 4, requiredRoomType: "classroom", description: "Faqat 1–4-sinf: 1=4s, 2-4=3s" },
      { name: "Adabiyot",                               code: "ADAB",     color: "#8B5CF6", weeklyHours: 2, requiredRoomType: "classroom", description: "5–11-sinf: 2s" },
      { name: "Rus tili",                               code: "RUS",      color: "#6366F1", weeklyHours: 2, requiredRoomType: "classroom", description: "2–11-sinf: 2s" },
      { name: "Chet tili",                              code: "ING",      color: "#06B6D4", weeklyHours: 4, requiredRoomType: "classroom", description: "1=1s | 2-4=2s | 5-7=4s | 8-9=3s | 10-11=2s" },
    ],
  },
  {
    label: "II. Ijtimoiy", sinf: "1–11-sinf", color: "amber",
    subjects: [
      { name: "Tarixdan hikoyalar",                     code: "TARHIK",   color: "#F59E0B", weeklyHours: 2, requiredRoomType: "classroom", description: "Faqat 5-sinf: 2s" },
      { name: "Qadimgi dunyo tarixi",                   code: "QADTARIX", color: "#D97706", weeklyHours: 2, requiredRoomType: "classroom", description: "Faqat 6-sinf: 2s" },
      { name: "O'zbekiston tarixi",                     code: "UZBT",     color: "#B45309", weeklyHours: 2, requiredRoomType: "classroom", description: "7–9: 2s | 10–11: 1s" },
      { name: "Jahon tarixi",                           code: "JTAR",     color: "#92400E", weeklyHours: 1, requiredRoomType: "classroom", description: "7–11-sinf: 1s" },
      { name: "Davlat va huquq asoslari",               code: "DHQ",      color: "#EC4899", weeklyHours: 1, requiredRoomType: "classroom", description: "8–11-sinf: 1s" },
      { name: "Tarbiya",                                code: "TARB",     color: "#14B8A6", weeklyHours: 1, requiredRoomType: "classroom", description: "1–11-sinf: 1s (sinf soati)" },
    ],
  },
  {
    label: "III. Aniq fanlar", sinf: "1–11-sinf", color: "red",
    subjects: [
      { name: "Matematika",                             code: "MATH4",    color: "#EF4444", weeklyHours: 5, requiredRoomType: "classroom", description: "1–7-sinf: 5s" },
      { name: "Algebra",                                code: "ALG",      color: "#DC2626", weeklyHours: 3, requiredRoomType: "classroom", description: "8–11-sinf: 3s" },
      { name: "Geometriya",                             code: "GEOM",     color: "#F97316", weeklyHours: 2, requiredRoomType: "classroom", description: "8–11-sinf: 2s" },
      { name: "Informatika va axborot texnologiyalari", code: "INF4",     color: "#6366F1", weeklyHours: 1, requiredRoomType: "computer",  description: "1–8=1s | 9–11=2s (4-sinfda 1s qo'shilgan)" },
    ],
  },
  {
    label: "IV. Tabiiy fanlar", sinf: "1–11-sinf", color: "emerald",
    subjects: [
      { name: "Tabiiy fanlar (Science)",                code: "ATRO",     color: "#10B981", weeklyHours: 2, requiredRoomType: "classroom", description: "1–4=1s | 5=2s | 6=3s" },
      { name: "Fizika",                                 code: "FIZ",      color: "#8B5CF6", weeklyHours: 2, requiredRoomType: "lab",        description: "7–11-sinf: 2s" },
      { name: "Astronomiya",                            code: "ASTRO",    color: "#7C3AED", weeklyHours: 1, requiredRoomType: "lab",        description: "Faqat 11-sinf: 1s" },
      { name: "Kimyo",                                  code: "KIM",      color: "#059669", weeklyHours: 2, requiredRoomType: "lab",        description: "7–11-sinf: 2s" },
      { name: "Biologiya",                              code: "BIO",      color: "#14B8A6", weeklyHours: 2, requiredRoomType: "lab",        description: "7–11-sinf: 2s" },
      { name: "Geografiya",                             code: "GEOG",     color: "#06B6D4", weeklyHours: 2, requiredRoomType: "classroom", description: "7=2s | 8–9=1.5s | 10=2s (11-sinfda yo'q)" },
      { name: "Iqtisodiy bilim asoslari",               code: "IQT",      color: "#0891B2", weeklyHours: 1, requiredRoomType: "classroom", description: "8–9-sinf: 0.5s" },
      { name: "Tadbirkorlik asoslari",                  code: "TADBIR",   color: "#0E7490", weeklyHours: 1, requiredRoomType: "classroom", description: "Faqat 11-sinf: 1s" },
    ],
  },
  {
    label: "V. Amaliy fanlar", sinf: "1–11-sinf", color: "pink",
    subjects: [
      { name: "Musiqa madaniyati",                      code: "MUS",      color: "#EC4899", weeklyHours: 1, requiredRoomType: "music",     description: "1–7-sinf: 1s" },
      { name: "Tasviriy san'at",                        code: "TASV",     color: "#F59E0B", weeklyHours: 1, requiredRoomType: "art",       description: "1–7-sinf: 1s" },
      { name: "Chizmachilik",                           code: "CHIZMA",   color: "#78716C", weeklyHours: 1, requiredRoomType: "classroom", description: "8–9-sinf: 1s" },
      { name: "Texnologiya",                            code: "TECH4",    color: "#8B5CF6", weeklyHours: 2, requiredRoomType: "classroom", description: "1–4=1s | 5–7=2s | 8–9=1s" },
      { name: "Jismoniy tarbiya",                       code: "JT4",      color: "#F97316", weeklyHours: 2, requiredRoomType: "gym",       description: "1=1s | 2–11=2s" },
      { name: "Chaqiruvga qadar boshlang'ich tayyorgarlik", code: "CHQBT", color: "#EF4444", weeklyHours: 2, requiredRoomType: "gym",      description: "10–11-sinf: 2s" },
    ],
  },
];

const GROUP_STYLES: Record<string, { tab: string; badge: string; check: string; row: string; border: string; bg: string }> = {
  blue:    { tab: "border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-500/10",       badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",       check: "text-blue-600 dark:text-blue-400",    row: "hover:bg-blue-500/5", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  amber:   { tab: "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/10",    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",    check: "text-amber-600 dark:text-amber-400",   row: "hover:bg-amber-500/5", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  red:     { tab: "border-red-500 text-red-700 dark:text-red-400 bg-red-500/10",          badge: "bg-red-500/10 text-red-700 dark:text-red-400",        check: "text-red-600 dark:text-red-400",     row: "hover:bg-red-500/5", border: "border-red-500/30", bg: "bg-red-500/10" },
  emerald: { tab: "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", check: "text-emerald-600 dark:text-emerald-400", row: "hover:bg-emerald-500/5", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  pink:    { tab: "border-pink-500 text-pink-700 dark:text-pink-400 bg-pink-500/10",       badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400",      check: "text-pink-600 dark:text-pink-400",    row: "hover:bg-pink-500/5", border: "border-pink-500/30", bg: "bg-pink-500/10" },
};

function DtsDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [activeGroup, setActiveGroup] = useState(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const key = (gi: number, si: number) => `${gi}_${si}`;
  const toggleOne = (gi: number, si: number) => {
    const k = key(gi, si);
    setSelected(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  };
  const toggleGroup = (gi: number) => {
    const allKeys = gi === -1
      ? DTS_GROUPS.flatMap((g, gIdx) => g.subjects.map((_, si) => key(gIdx, si)))
      : DTS_GROUPS[gi].subjects.map((_, si) => key(gi, si));
    const allSelected = allKeys.every(k => selected.has(k));
    setSelected(prev => { const next = new Set(prev); allSelected ? allKeys.forEach(k => next.delete(k)) : allKeys.forEach(k => next.add(k)); return next; });
  };
  const selectAll = () => {
    const allKeys: string[] = [];
    DTS_GROUPS.forEach((g, gi) => g.subjects.forEach((_, si) => allKeys.push(key(gi, si))));
    setSelected(new Set(allKeys));
  };
  const clearAll = () => setSelected(new Set());
  const selectedList = Array.from(selected).map(k => { const [gi, si] = k.split("_").map(Number); return DTS_GROUPS[gi].subjects[si]; });
  const handleCreate = async () => {
    if (selectedList.length === 0) { toast({ title: "Xatolik", description: "Hech bo'lmasa bitta fan tanlang", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/subjects/bulk", { subjects: selectedList.map(s => ({
        name: s.name,
        code: s.code,
        description: s.description,
        color: s.color,
        weeklyHours: s.weeklyHours,
        requiredRoomType: s.requiredRoomType
      })) });
      toast({ title: "Muvaffaqiyat", description: `${selectedList.length} ta fan qo'shildi` });
      onSuccess();
      onClose();
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const isAllGroup = activeGroup === -1;
  const grpKeys = isAllGroup
    ? DTS_GROUPS.flatMap((g, gi) => g.subjects.map((_, si) => key(gi, si)))
    : DTS_GROUPS[activeGroup].subjects.map((_, si) => key(activeGroup, si));

  const grpAllSel = grpKeys.every(k => selected.has(k));
  const grpSomeSel = grpKeys.some(k => selected.has(k));

  const currentSubjects = isAllGroup
    ? DTS_GROUPS.flatMap((g, gi) => g.subjects.map((sub, si) => ({ ...sub, gi, si })))
    : DTS_GROUPS[activeGroup].subjects.map((sub, si) => ({ ...sub, gi: activeGroup, si }));

  const st = isAllGroup
    ? { tab: "border-primary text-primary bg-primary/10", badge: "bg-primary/10 text-primary", check: "text-primary", row: "hover:bg-muted/30", bg: "bg-primary/5", border: "border-primary/20" }
    : GROUP_STYLES[DTS_GROUPS[activeGroup].color];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            DTS 2026–2027 fanlarini qo'shish
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Maktabgacha va Maktab Ta'limi vazirligi №133-buyrug'i (10.04.2026) asosida</p>
        </DialogHeader>
        <div className="flex gap-1.5 border-b border-border pb-2 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveGroup(-1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              activeGroup === -1
                ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            Barchasi
            {selected.size > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary">{selected.size}</span>}
          </button>
          {DTS_GROUPS.map((g, gi) => {
            const cnt = g.subjects.filter((_, si) => selected.has(key(gi, si))).length;
            const s = GROUP_STYLES[g.color];
            const isActive = activeGroup === gi;
            // Shorten group labels
            const shortLabel = g.label.replace(/^(I|II|III|IV|V)\.\s+/, "").replace(/\s+fanlar$/, "");
            
            return (
              <button
                key={gi}
                onClick={() => setActiveGroup(gi)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  isActive
                    ? `${s.bg} ${s.check} border-primary/20 shadow-sm`
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {shortLabel}
                {cnt > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${s.badge}`}>{cnt}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between px-1 py-2 sticky top-0 bg-card border-b border-gray-50 z-10">
            <button onClick={() => toggleGroup(activeGroup)} className={`flex items-center gap-2 text-sm font-medium ${st.check} hover:opacity-80 transition-opacity`}>
              {grpAllSel ? <CheckSquare className="h-4 w-4" /> : grpSomeSel ? <div className="h-4 w-4 border-2 border-current rounded flex items-center justify-center"><div className="w-2 h-0.5 bg-current rounded" /></div> : <Square className="h-4 w-4" />}
              {grpAllSel ? "Hammasini bekor qilish" : "Hammasini tanlash"}
            </button>
            <span className="text-xs text-muted-foreground">{grpKeys.filter(k => selected.has(k)).length}/{grpKeys.length} ta tanlangan</span>
          </div>
          <div className="divide-y divide-border/40">
            {isAllGroup ? (
              DTS_GROUPS.map((g, gi) => {
                const s = GROUP_STYLES[g.color];
                const groupLabelShort = g.label.replace(/^(I|II|III|IV|V)\.\s+/, "");
                return (
                  <div key={gi} className="py-2 first:pt-1">
                    {/* Guruh sarlavhasi (Header) */}
                    <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-muted-foreground bg-muted/20 flex items-center gap-1.5 rounded-md mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.subjects[0]?.color || '#ccc' }} />
                      {groupLabelShort}
                      <span className="text-[9px] font-normal text-muted-foreground/60 lowercase">({g.sinf})</span>
                    </div>
                    {/* Guruh fanlari */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {g.subjects.map((sub, si) => {
                        const k = key(gi, si);
                        const isSel = selected.has(k);
                        return (
                          <button
                            key={si}
                            onClick={() => toggleOne(gi, si)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 text-left rounded-lg border transition-colors ${isSel ? s.bg + ' ' + s.border + ' shadow-sm' : 'border-border hover:border-border/80 bg-card hover:bg-muted/40'}`}
                          >
                            <div className={`flex-shrink-0 transition-colors ${isSel ? s.check : "text-muted-foreground/30"}`}>
                              {isSel ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                              <span className="text-[11px] font-semibold text-foreground truncate">{sub.name}</span>
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title={`${sub.weeklyHours} soat / hafta`}>
                              <Clock className="h-3 w-3" /> {sub.weeklyHours}s
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              // Bitta guruh ko'rsatilganda
              currentSubjects.map((sub, idx) => {
                const k = key(sub.gi, sub.si);
                const isSel = selected.has(k);
                const itemStyle = GROUP_STYLES[DTS_GROUPS[sub.gi].color] || st;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleOne(sub.gi, sub.si)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${itemStyle.row} ${isSel ? "bg-muted/40" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`flex-shrink-0 transition-colors ${isSel ? itemStyle.check : "text-muted-foreground/30"}`}>
                        {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground truncate">{sub.name}</span>
                        {sub.description && (
                          <span className="text-[10px] text-muted-foreground truncate font-normal">
                            {sub.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROOM_TYPE_COLORS[sub.requiredRoomType] || ROOM_TYPE_COLORS.any}`}>
                        {ROOM_TYPE_LABELS[sub.requiredRoomType] || sub.requiredRoomType}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5 w-12 justify-end">
                        <Clock className="h-3 w-3" /> {sub.weeklyHours}s
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="border-t border-border pt-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Jami tanlangan: <span className="font-semibold text-foreground">{selected.size} ta fan</span></span>
              <button onClick={selectAll} className="text-blue-600 hover:underline">Barchasini tanlash</button>
              {selected.size > 0 && <button onClick={clearAll} className="text-muted-foreground hover:underline">Tozalash</button>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
            <Button onClick={handleCreate} disabled={loading || selected.size === 0} className="bg-primary hover:bg-primary/90">
              {loading ? "Qo'shilmoqda..." : `${selected.size} ta fan qo'shish`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, title, onCancel, onConfirm }: { open: boolean; title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>O'chirishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>O'chirish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectCard({ subject, openEdit, onDelete, onSave, isUpdating }: { subject: Subject; openEdit: (s: Subject) => void; onDelete: (id: number) => void; onSave: (data: Partial<Subject>) => void; isUpdating?: boolean }) {
  const roomType = (subject as any).requiredRoomType || "any";
  const roomTypeOptions = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="group border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card text-card-foreground">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: subject.color ? `${subject.color}20` : "#3B82F620" }}>
          <BookOpen className="h-5 w-5" style={{ color: subject.color || "#3B82F6" }} />
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground" onClick={() => openEdit(subject)} disabled={isUpdating}><Edit className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-500/10" onClick={() => onDelete(subject.id)} disabled={isUpdating}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="flex items-center space-x-2 mb-1">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || "#3B82F6" }} />
        <InlineEdit
          value={subject.name}
          onSave={(name) => onSave({ name })}
          placeholder="Fan nomi"
          className="font-semibold text-foreground text-sm leading-tight truncate flex-1"
          disabled={isUpdating}
        />
      </div>
      <div className="ml-5">
        <InlineEdit
          value={subject.code || ""}
          onSave={(code) => onSave({ code: code.toUpperCase() })}
          placeholder="KOD"
          className="text-xs text-muted-foreground/60 font-mono"
          disabled={isUpdating}
        />
      </div>
      <div className="ml-5 mt-1.5">
        <InlineEdit
          value={subject.description || ""}
          onSave={(description) => onSave({ description })}
          placeholder="Tavsif..."
          className="text-xs text-muted-foreground line-clamp-2"
          disabled={isUpdating}
        />
      </div>
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
        <InlineSelect
          value={roomType}
          options={roomTypeOptions}
          onSave={(val) => onSave({ requiredRoomType: val })}
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROOM_TYPE_COLORS[roomType] || ROOM_TYPE_COLORS.any}`}
          disabled={isUpdating}
        />
        <div className="flex items-center space-x-1 text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          <InlineEdit
            value={subject.weeklyHours || 4}
            onSave={(val) => onSave({ weeklyHours: parseInt(val) || 4 })}
            type="number"
            min={1}
            max={12}
            className="text-xs w-8 text-foreground"
            disabled={isUpdating}
          />
          <span className="text-xs">soat</span>
        </div>
      </div>
    </div>
  );
}

function SubjectRow({ subject, openEdit, onDelete, onSave, isUpdating }: { subject: Subject; openEdit: (s: Subject) => void; onDelete: (id: number) => void; onSave: (data: Partial<Subject>) => void; isUpdating?: boolean }) {
  const roomType = (subject as any).requiredRoomType || "any";
  const roomTypeOptions = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="group grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_130px] gap-4 px-4 py-3 items-center border border-border rounded-xl hover:border-primary/50 hover:bg-muted/40 transition-all bg-card text-card-foreground">
      <div className="flex items-center space-x-2 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: subject.color ? `${subject.color}20` : "#3B82F620" }}>
          <BookOpen className="h-4 w-4" style={{ color: subject.color || "#3B82F6" }} />
        </div>
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={subject.name}
            onSave={(name) => onSave({ name })}
            placeholder="Fan nomi"
            className="font-semibold text-foreground text-sm truncate"
            disabled={isUpdating}
          />
          <InlineEdit
            value={subject.code || ""}
            onSave={(code) => onSave({ code: code.toUpperCase() })}
            placeholder="KOD"
            className="text-xs text-muted-foreground/60 font-mono block"
            disabled={isUpdating}
          />
        </div>
      </div>
      <div className="min-w-0">
        <InlineEdit
          value={subject.description || ""}
          onSave={(description) => onSave({ description })}
          placeholder="Tavsif..."
          className="text-sm text-muted-foreground truncate block"
          disabled={isUpdating}
        />
      </div>
      <InlineSelect
        value={roomType}
        options={roomTypeOptions}
        onSave={(val) => onSave({ requiredRoomType: val })}
        className={`text-xs px-2 py-1 rounded-full border font-medium w-fit ${ROOM_TYPE_COLORS[roomType] || ROOM_TYPE_COLORS.any}`}
        disabled={isUpdating}
      />
      <div className="flex items-center justify-end space-x-2">
        <div className="flex items-center space-x-1 text-muted-foreground/60">
          <Clock className="h-3.5 w-3.5" />
          <InlineEdit
            value={subject.weeklyHours || 4}
            onSave={(val) => onSave({ weeklyHours: parseInt(val) || 4 })}
            type="number"
            min={1}
            max={12}
            className="text-xs w-8 text-foreground"
            disabled={isUpdating}
          />
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground" onClick={() => openEdit(subject)} disabled={isUpdating}><Edit className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-500/10" onClick={() => onDelete(subject.id)} disabled={isUpdating}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [dtsOpen, setDtsOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormData>(EMPTY_FORM);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
  const upsertMutation = useMutation({
    mutationFn: async (data: SubjectFormData) => {
      const method = editing ? "PATCH" : "POST";
      const url = editing ? `/api/subjects/${editing.id}` : "/api/subjects";
      await apiRequest(method, url, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "Fan yangilandi" : "Fan qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subjects/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/subjects"] }); toast({ title: "Muvaffaqiyat", description: "Fan o'chirildi" }); },
  });
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/subjects/clear-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Muvaffaqiyat", description: "Barcha fanlar tozalandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  // Inline update mutation
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Subject> }) => {
      await apiRequest("PATCH", `/api/subjects/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Saqlanmadi", variant: "destructive" }),
  });

  // Room type options for inline select
  const roomTypeOptions = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code || "", description: s.description || "", color: s.color || "#3B82F6", weeklyHours: s.weeklyHours || 4, requiredRoomType: (s as any).requiredRoomType || "any" });
    setOpen(true);
  };
  const filtered = subjects.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fanlar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">O'quv fanlarini va xona talablarini boshqarish</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => subjects.length > 0 && setClearOpen(true)}
            disabled={clearAllMutation.isPending || subjects.length === 0}
            className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Barchasini tozalash
          </Button>
          <Button variant="outline" onClick={() => setExcelImportOpen(true)} className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel Import
          </Button>
          <Button variant="outline" onClick={() => setDtsOpen(true)} className="border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30">
            <GraduationCap className="mr-2 h-4 w-4 text-primary" /> DTS fanlarini qo'shish
          </Button>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> Fan qo'shish</Button>
        </div>
      </div>

      {!isLoading && subjects.length === 0 && (
        <div className="flex items-start gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <GraduationCap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">DTS 2026–2027 bo'yicha fanlar tayyor</p>
            <p className="text-xs text-blue-600/90 dark:text-blue-400/90 mt-0.5">O'zbekiston Maktabgacha va Maktab Ta'limi vazirligining №121-buyrug'i asosida 1–11-sinf uchun barcha fanlar ro'yxati kiritilgan. Bir tugma bilan qo'shishingiz mumkin.</p>
          </div>
          <Button size="sm" onClick={() => setDtsOpen(true)} className="bg-primary hover:bg-primary/90 flex-shrink-0"><Zap className="mr-1.5 h-3.5 w-3.5" /> Qo'shish</Button>
        </div>
      )}

      <Card className="border border-border shadow-sm bg-card text-card-foreground">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <BookOpen className="mr-2 h-4 w-4 text-violet-600" /> Fanlar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs bg-muted text-foreground">{subjects.length} ta</Badge>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4 w-4" />
                <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-lg">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("grid")} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} aria-label="List view">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-3"}>
              {Array(8).fill(0).map((_, i) => <div key={i} className={viewMode === "grid" ? "h-32 bg-muted animate-pulse rounded-xl" : "h-20 bg-muted animate-pulse rounded-xl"} />)}
            </div>
          ) : filtered.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(subject => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    openEdit={openEdit}
                    onDelete={id => setDeleteId(id)}
                    onSave={(data) => inlineUpdateMutation.mutate({ id: subject.id, data })}
                    isUpdating={inlineUpdateMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_130px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 rounded-xl border border-border">
                  <div>Fan</div><div>Tavsif</div><div>Xona turi</div><div className="text-right">Soat / Amal</div>
                </div>
                {filtered.map(subject => (
                  <SubjectRow
                    key={subject.id}
                    subject={subject}
                    openEdit={openEdit}
                    onDelete={id => setDeleteId(id)}
                    onSave={(data) => inlineUpdateMutation.mutate({ id: subject.id, data })}
                    isUpdating={inlineUpdateMutation.isPending}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16 max-w-xl mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                {search ? <Search className="h-7 w-7 text-muted-foreground/40" /> : <BookOpen className="h-7 w-7 text-muted-foreground/40" />}
              </div>
              <h3 className="text-lg font-bold text-foreground">{search ? "Qidiruv bo'yicha hech narsa topilmadi" : "Fanlar ro'yxati bo'sh"}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {search 
                  ? `"${search}" qidiruv so'roviga mos keluvchi fan topilmadi. Qidiruv matnini o'zgartirib ko'ring.` 
                  : "Dars jadvalini yaratish uchun dastlab fanlarni kiriting. Davlat ta'lim standarti (DTS) bo'yicha tayyor ro'yxatni yuklashingiz yoki yangi fan qo'shishingiz mumkin."}
              </p>
              {search ? (
                <Button variant="outline" className="mt-6 border-border hover:bg-muted text-foreground rounded-xl" onClick={() => setSearch("")}>Qidiruvni tozalash</Button>
              ) : (
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" onClick={() => setDtsOpen(true)} className="border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl h-10 px-4 gap-2">
                    <GraduationCap className="h-4 w-4" /> DTS 2026–2027 fanlarini yuklash
                  </Button>
                  <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl h-10 px-4 gap-2 shadow-sm">
                    <Plus className="h-4 w-4" /> Fan qo'shish
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Fanni tahrirlash" : "Yangi fan qo'shish"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-sm">Fan nomi *</Label><Input placeholder="Masalan: Matematika" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm">Kod (qisqartma)</Label><Input placeholder="MATH" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Haftalik soat</Label><Input type="number" min={1} max={10} value={form.weeklyHours} onChange={e => setForm(p => ({ ...p, weeklyHours: parseInt(e.target.value) || 4 }))} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-sm">Tavsif</Label><Input placeholder="Fan haqida qisqacha..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center space-x-1.5"><DoorOpen className="h-3.5 w-3.5 text-muted-foreground" /><span>Talab qilinadigan xona turi</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (<button key={value} type="button" onClick={() => setForm(p => ({ ...p, requiredRoomType: value }))} className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${form.requiredRoomType === value ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted"}`}>{label}</button>))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Rang</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (<button key={c.hex} type="button" onClick={() => setForm(p => ({ ...p, color: c.hex }))} className="w-8 h-8 rounded-lg transition-transform hover:scale-110 border-2" style={{ backgroundColor: c.hex, borderColor: form.color === c.hex ? "#1e40af" : "transparent" }} title={c.label} />))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name) { toast({ title: "Xatolik", description: "Fan nomi kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }} disabled={upsertMutation.isPending} className="bg-primary hover:bg-primary/90">{editing ? "Saqlash" : "Qo'shish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DtsDialog open={dtsOpen} onClose={() => setDtsOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/subjects"] })} />

      <ClearAllDialog
        open={clearOpen}
        title="Barcha fanlar o'chirilsinmi?"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          clearAllMutation.mutate();
        }}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        title="Fan o'chiriladi. Davom etasizmi?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
      />

      <ExcelImportDialog
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        type="subjects"
      />
    </div>
  );
}
