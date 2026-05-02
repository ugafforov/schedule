import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, BookOpen, X, Clock, DoorOpen, Zap, CheckSquare, Square, GraduationCap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ROOM_TYPE_LABELS } from "@shared/schema";
import type { Subject } from "@shared/schema";

interface SubjectFormData {
  name: string; code: string; description: string;
  color: string; weeklyHours: number; requiredRoomType: string;
}

const EMPTY_FORM: SubjectFormData = {
  name: "", code: "", description: "", color: "#3B82F6", weeklyHours: 4, requiredRoomType: "any",
};

const COLORS = [
  { hex: "#3B82F6", label: "Ko'k" },     { hex: "#10B981", label: "Yashil" },
  { hex: "#8B5CF6", label: "Binafsha" },  { hex: "#F59E0B", label: "Sariq" },
  { hex: "#EF4444", label: "Qizil" },     { hex: "#06B6D4", label: "Moviy" },
  { hex: "#EC4899", label: "Pushti" },    { hex: "#14B8A6", label: "Zangori" },
  { hex: "#F97316", label: "To'q sariq" },{ hex: "#6366F1", label: "Indigo" },
];

const ROOM_TYPE_COLORS: Record<string, string> = {
  any: "bg-gray-100 text-gray-600 border-gray-200",
  classroom: "bg-blue-50 text-blue-700 border-blue-200",
  lab: "bg-green-50 text-green-700 border-green-200",
  gym: "bg-orange-50 text-orange-700 border-orange-200",
  computer: "bg-purple-50 text-purple-700 border-purple-200",
  music: "bg-pink-50 text-pink-700 border-pink-200",
  art: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

/* ── DTS 2025-2026 fanlar ro'yxati ───────────────────────────────────────── */
interface DtsSubject {
  name: string; code: string; color: string;
  weeklyHours: number; requiredRoomType: string; description: string;
}

const DTS_GROUPS: { label: string; sinf: string; color: string; subjects: DtsSubject[] }[] = [
  {
    label: "Boshlang'ich ta'lim", sinf: "1–4-sinf", color: "blue",
    subjects: [
      { name: "Ona tili va o'qish savodxonligi", code: "ONA4",  color: "#3B82F6", weeklyHours: 8, requiredRoomType: "classroom", description: "Boshlang'ich sinflar uchun ona tili" },
      { name: "Matematika",                       code: "MATH4", color: "#EF4444", weeklyHours: 5, requiredRoomType: "classroom", description: "" },
      { name: "Atrofimizdagi olam",               code: "ATRO",  color: "#10B981", weeklyHours: 2, requiredRoomType: "classroom", description: "Dunyo bilish, tabiat va jamiyat" },
      { name: "Xorijiy til",                      code: "XORT4", color: "#06B6D4", weeklyHours: 3, requiredRoomType: "classroom", description: "Ingliz / Rus tili (2–4-sinflar)" },
      { name: "Informatika va AT",                code: "INF4",  color: "#6366F1", weeklyHours: 1, requiredRoomType: "computer",  description: "3-sinfdan boshlab (2025-2026 yangiligi)" },
      { name: "Musiqa",                           code: "MUS",   color: "#EC4899", weeklyHours: 1, requiredRoomType: "music",     description: "" },
      { name: "Tasviriy san'at",                  code: "TASV",  color: "#F59E0B", weeklyHours: 1, requiredRoomType: "art",       description: "" },
      { name: "Jismoniy tarbiya",                 code: "JT4",   color: "#F97316", weeklyHours: 3, requiredRoomType: "gym",       description: "" },
      { name: "Texnologiya",                      code: "TECH4", color: "#8B5CF6", weeklyHours: 1, requiredRoomType: "classroom", description: "Mehnat ta'limi" },
    ],
  },
  {
    label: "Asosiy ta'lim", sinf: "5–9-sinf", color: "emerald",
    subjects: [
      { name: "Ona tili va adabiyoti",            code: "ONA9",  color: "#3B82F6", weeklyHours: 4, requiredRoomType: "classroom", description: "" },
      { name: "Ingliz tili",                      code: "ING",   color: "#06B6D4", weeklyHours: 3, requiredRoomType: "classroom", description: "" },
      { name: "Algebra",                          code: "ALG",   color: "#EF4444", weeklyHours: 3, requiredRoomType: "classroom", description: "" },
      { name: "Geometriya",                       code: "GEOM",  color: "#F97316", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "Informatika va AT",                code: "INF9",  color: "#6366F1", weeklyHours: 2, requiredRoomType: "computer",  description: "" },
      { name: "Fizika",                           code: "FIZ",   color: "#8B5CF6", weeklyHours: 3, requiredRoomType: "lab",       description: "" },
      { name: "Kimyo",                            code: "KIM",   color: "#10B981", weeklyHours: 2, requiredRoomType: "lab",       description: "" },
      { name: "Biologiya",                        code: "BIO",   color: "#14B8A6", weeklyHours: 2, requiredRoomType: "lab",       description: "" },
      { name: "Geografiya",                       code: "GEOG",  color: "#06B6D4", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "O'zbekiston tarixi",               code: "UZBT",  color: "#F59E0B", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "Jahon tarixi",                     code: "JTAR",  color: "#F59E0B", weeklyHours: 1, requiredRoomType: "classroom", description: "" },
      { name: "Huquq asoslari",                   code: "HUQ",   color: "#EC4899", weeklyHours: 1, requiredRoomType: "classroom", description: "" },
      { name: "Iqtisodiyot asoslari",             code: "IQT",   color: "#14B8A6", weeklyHours: 1, requiredRoomType: "classroom", description: "Yuqori sinflarda" },
      { name: "Musiqa (5–9)",                     code: "MUS9",  color: "#EC4899", weeklyHours: 1, requiredRoomType: "music",     description: "" },
      { name: "Tasviriy san'at (5–9)",            code: "TASV9", color: "#F59E0B", weeklyHours: 1, requiredRoomType: "art",       description: "" },
      { name: "Texnologiya (5–9)",                code: "TECH9", color: "#8B5CF6", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "Jismoniy tarbiya (5–9)",           code: "JT9",   color: "#F97316", weeklyHours: 3, requiredRoomType: "gym",       description: "" },
    ],
  },
  {
    label: "O'rta ta'lim", sinf: "10–11-sinf", color: "purple",
    subjects: [
      { name: "Ona tili va adabiyoti (10–11)",    code: "ONA11",  color: "#3B82F6", weeklyHours: 4, requiredRoomType: "classroom", description: "" },
      { name: "O'zbek tili",                      code: "UZB",    color: "#3B82F6", weeklyHours: 2, requiredRoomType: "classroom", description: "Boshqa tilda o'qitiladigan maktablar" },
      { name: "Xorijiy til (10–11)",              code: "XORT11", color: "#06B6D4", weeklyHours: 3, requiredRoomType: "classroom", description: "" },
      { name: "Matematika (chuqurlashtirilgan)",   code: "MATH11", color: "#EF4444", weeklyHours: 5, requiredRoomType: "classroom", description: "10–11-sinf uchun" },
      { name: "Fizika (10–11)",                   code: "FIZ11",  color: "#8B5CF6", weeklyHours: 3, requiredRoomType: "lab",       description: "" },
      { name: "Kimyo (10–11)",                    code: "KIM11",  color: "#10B981", weeklyHours: 2, requiredRoomType: "lab",       description: "" },
      { name: "Biologiya (10–11)",                code: "BIO11",  color: "#14B8A6", weeklyHours: 2, requiredRoomType: "lab",       description: "" },
      { name: "Geografiya (10–11)",               code: "GEOG11", color: "#06B6D4", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "O'zbekiston tarixi (10–11)",       code: "UZBT11", color: "#F59E0B", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "Jahon tarixi (10–11)",             code: "JTAR11", color: "#F59E0B", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
      { name: "Davlat va huquq asoslari",         code: "DHQ",    color: "#EC4899", weeklyHours: 1, requiredRoomType: "classroom", description: "" },
      { name: "Informatika va AT (10–11)",        code: "INF11",  color: "#6366F1", weeklyHours: 2, requiredRoomType: "computer",  description: "" },
      { name: "Jismoniy tarbiya (10–11)",         code: "JT11",   color: "#F97316", weeklyHours: 2, requiredRoomType: "gym",       description: "" },
      { name: "Texnologiya (10–11)",              code: "TECH11", color: "#8B5CF6", weeklyHours: 2, requiredRoomType: "classroom", description: "" },
    ],
  },
];

const GROUP_STYLES: Record<string, { tab: string; badge: string; check: string; row: string }> = {
  blue:    { tab: "border-blue-500 text-blue-700 bg-blue-50",    badge: "bg-blue-100 text-blue-700",    check: "text-blue-600", row: "hover:bg-blue-50/50" },
  emerald: { tab: "border-emerald-500 text-emerald-700 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", check: "text-emerald-600", row: "hover:bg-emerald-50/50" },
  purple:  { tab: "border-purple-500 text-purple-700 bg-purple-50",  badge: "bg-purple-100 text-purple-700",  check: "text-purple-600", row: "hover:bg-purple-50/50" },
};

/* ── DTS dialog ──────────────────────────────────────────────────────────── */
function DtsDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [activeGroup, setActiveGroup] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const key = (gi: number, si: number) => `${gi}_${si}`;

  const toggleOne = (gi: number, si: number) => {
    const k = key(gi, si);
    setSelected(prev => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  };
  const toggleGroup = (gi: number) => {
    const allKeys = DTS_GROUPS[gi].subjects.map((_, si) => key(gi, si));
    const allSelected = allKeys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) allKeys.forEach(k => next.delete(k));
      else allKeys.forEach(k => next.add(k));
      return next;
    });
  };
  const selectAll = () => {
    const allKeys: string[] = [];
    DTS_GROUPS.forEach((g, gi) => g.subjects.forEach((_, si) => allKeys.push(key(gi, si))));
    setSelected(new Set(allKeys));
  };
  const clearAll = () => setSelected(new Set());

  const selectedList = Array.from(selected).map(k => {
    const [gi, si] = k.split("_").map(Number);
    return DTS_GROUPS[gi].subjects[si];
  });

  const handleCreate = async () => {
    if (selectedList.length === 0) { toast({ title: "Xatolik", description: "Hech bo'lmasa bitta fan tanlang", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/subjects/bulk", { subjects: selectedList });
      toast({ title: "Muvaffaqiyat", description: `${selectedList.length} ta fan qo'shildi` });
      onSuccess(); onClose(); setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const grp = DTS_GROUPS[activeGroup];
  const st = GROUP_STYLES[grp.color];
  const grpKeys = grp.subjects.map((_, si) => key(activeGroup, si));
  const grpAllSel = grpKeys.every(k => selected.has(k));
  const grpSomeSel = grpKeys.some(k => selected.has(k));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            DTS 2025–2026 fanlarini qo'shish
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Maktabgacha va Maktab Ta'limi vazirligi №121-buyrug'i (10.04.2025) asosida
          </p>
        </DialogHeader>

        {/* Group tabs */}
        <div className="flex gap-1 border-b border-gray-100 pb-0 -mb-px flex-shrink-0">
          {DTS_GROUPS.map((g, gi) => {
            const cnt = g.subjects.filter((_, si) => selected.has(key(gi, si))).length;
            const s = GROUP_STYLES[g.color];
            const isActive = activeGroup === gi;
            return (
              <button key={gi} onClick={() => setActiveGroup(gi)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  isActive ? s.tab + " border-current" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {g.label}
                <span className="text-[10px] text-gray-400">{g.sinf}</span>
                {cnt > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${s.badge}`}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Group header */}
          <div className="flex items-center justify-between px-1 py-2 sticky top-0 bg-white border-b border-gray-50">
            <button onClick={() => toggleGroup(activeGroup)}
              className={`flex items-center gap-2 text-sm font-medium ${st.check} hover:opacity-80 transition-opacity`}>
              {grpAllSel
                ? <CheckSquare className="h-4 w-4" />
                : grpSomeSel
                ? <div className="h-4 w-4 border-2 border-current rounded flex items-center justify-center"><div className="w-2 h-0.5 bg-current rounded" /></div>
                : <Square className="h-4 w-4" />
              }
              {grpAllSel ? "Hammasini bekor qilish" : "Hammasini tanlash"}
            </button>
            <span className="text-xs text-gray-400">{grpKeys.filter(k => selected.has(k)).length}/{grp.subjects.length} ta tanlangan</span>
          </div>

          {/* Subject rows */}
          <div className="divide-y divide-gray-50">
            {grp.subjects.map((sub, si) => {
              const k = key(activeGroup, si);
              const isSel = selected.has(k);
              return (
                <button key={si} onClick={() => toggleOne(activeGroup, si)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${st.row} ${isSel ? "bg-gray-50" : ""}`}>
                  <div className={`flex-shrink-0 ${isSel ? st.check : "text-gray-300"} transition-colors`}>
                    {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{sub.name}</div>
                    {sub.description && <div className="text-xs text-gray-400 truncate">{sub.description}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${ROOM_TYPE_COLORS[sub.requiredRoomType] || ROOM_TYPE_COLORS.any}`}>
                      {ROOM_TYPE_LABELS[sub.requiredRoomType] || sub.requiredRoomType}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-0.5 w-14 justify-end">
                      <Clock className="h-3 w-3" /> {sub.weeklyHours}h
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 pt-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Jami tanlangan: <span className="font-semibold text-gray-900">{selected.size} ta fan</span></span>
              <button onClick={selectAll} className="text-blue-600 hover:underline">Barchasini tanlash</button>
              {selected.size > 0 && <button onClick={clearAll} className="text-gray-400 hover:underline">Tozalash</button>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
            <Button onClick={handleCreate} disabled={loading || selected.size === 0} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Qo'shilmoqda..." : `${selected.size} ta fan qo'shish`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Subjects() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [dtsOpen, setDtsOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormData>(EMPTY_FORM);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: SubjectFormData) => {
      if (editing) await apiRequest("PATCH", `/api/subjects/${editing.id}`, data);
      else await apiRequest("POST", "/api/subjects", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      setOpen(false); setEditing(null); setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "Fan yangilandi" : "Fan qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/subjects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/subjects"] }); toast({ title: "Muvaffaqiyat", description: "Fan o'chirildi" }); },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code || "", description: s.description || "", color: s.color || "#3B82F6", weeklyHours: s.weeklyHours || 4, requiredRoomType: (s as any).requiredRoomType || "any" });
    setOpen(true);
  };

  const filtered = subjects.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fanlar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'quv fanlarini va xona talablarini boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDtsOpen(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300">
            <GraduationCap className="mr-2 h-4 w-4 text-blue-600" />
            DTS fanlarini qo'shish
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Fan qo'shish
          </Button>
        </div>
      </div>

      {/* DTS info banner — shown only when no subjects exist */}
      {!isLoading && subjects.length === 0 && (
        <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <GraduationCap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">DTS 2025–2026 bo'yicha fanlar tayyor</p>
            <p className="text-xs text-blue-700 mt-0.5">
              O'zbekiston Maktabgacha va Maktab Ta'limi vazirligining №121-buyrug'i asosida 1–11-sinf uchun 
              barcha fanlar ro'yxati kiritilgan. Bir tugma bilan qo'shishingiz mumkin.
            </p>
          </div>
          <Button size="sm" onClick={() => setDtsOpen(true)} className="bg-blue-600 hover:bg-blue-700 flex-shrink-0">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Qo'shish
          </Button>
        </div>
      )}

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <BookOpen className="mr-2 h-4 w-4 text-violet-600" />
              Fanlar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{subjects.length} ta</Badge>
            </CardTitle>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(subject => {
                const roomType = (subject as any).requiredRoomType || "any";
                return (
                  <div key={subject.id} className="group border border-gray-100 rounded-xl p-4 hover:border-violet-200 hover:shadow-sm transition-all bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: subject.color ? `${subject.color}20` : "#3B82F620" }}>
                        <BookOpen className="h-5 w-5" style={{ color: subject.color || "#3B82F6" }} />
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(subject)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(subject.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || "#3B82F6" }} />
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{subject.name}</h3>
                    </div>
                    {subject.code && <p className="text-xs text-gray-400 font-mono ml-5">#{subject.code}</p>}
                    {subject.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 ml-5">{subject.description}</p>}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROOM_TYPE_COLORS[roomType] || ROOM_TYPE_COLORS.any}`}>
                        {ROOM_TYPE_LABELS[roomType] || roomType}
                      </span>
                      <div className="flex items-center space-x-1 text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">{subject.weeklyHours || 4} soat</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "Fanlar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setDtsOpen(true)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    <GraduationCap className="mr-2 h-4 w-4" /> DTS 2025–2026 fanlarini qo'shish
                  </Button>
                  <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Bitta qo'shish</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single add/edit dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Fanni tahrirlash" : "Yangi fan qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Fan nomi *</Label>
              <Input placeholder="Masalan: Matematika" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Kod (qisqartma)</Label>
                <Input placeholder="MATH" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Haftalik soat</Label>
                <Input type="number" min={1} max={10} value={form.weeklyHours} onChange={e => setForm(p => ({ ...p, weeklyHours: parseInt(e.target.value) || 4 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tavsif</Label>
              <Input placeholder="Fan haqida qisqacha..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center space-x-1.5">
                <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
                <span>Talab qilinadigan xona turi</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setForm(p => ({ ...p, requiredRoomType: value }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${form.requiredRoomType === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Rang</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c.hex} type="button" onClick={() => setForm(p => ({ ...p, color: c.hex }))}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-110 border-2"
                    style={{ backgroundColor: c.hex, borderColor: form.color === c.hex ? "#1e40af" : "transparent" }}
                    title={c.label} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name) { toast({ title: "Xatolik", description: "Fan nomi kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DtsDialog open={dtsOpen} onClose={() => setDtsOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/subjects"] })} />
    </div>
  );
}
