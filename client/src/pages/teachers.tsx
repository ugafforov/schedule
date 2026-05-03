import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, BookOpen, X, Clock, CalendarX, Zap, LayoutGrid, List } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Teacher, Subject } from "@shared/schema";

const DAYS = ["Du", "Se", "Ch", "Pa", "Ju"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const PERIOD_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];

interface TeacherFormData {
  firstName: string; lastName: string; department: string;
  specialization: string; phone: string; maxHoursPerWeek: number; subjectIds: number[];
}
const EMPTY_FORM: TeacherFormData = {
  firstName: "", lastName: "", department: "", specialization: "", phone: "", maxHoursPerWeek: 30, subjectIds: [],
};

/* ── Bulk add dialog ─────────────────────────────────────────────────────── */
function BulkAddTeachers({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [maxHours, setMaxHours] = useState(30);
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const normalizeName = (firstName: string, lastName: string) =>
    `${firstName} ${lastName}`.replace(/\s+/g, " ").trim().toLowerCase();
  const parsed: { firstName: string; lastName: string }[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    const key = normalizeName(firstName, lastName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parsed.push({ firstName, lastName });
  }

  const handleCreate = async () => {
    if (parsed.length === 0) { toast({ title: "Xatolik", description: "Hech bo'lmasa bitta ism kiriting", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/teachers/bulk", { teachers: parsed.map(p => ({ ...p, maxHoursPerWeek: maxHours })) });
      toast({ title: "Muvaffaqiyat", description: `${parsed.length} ta o'qituvchi qo'shildi` });
      setText(""); onSuccess(); onClose();
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Ko'p o'qituvchi qo'shish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-sm">O'qituvchilar ro'yxati</Label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"Alisher Karimov\nNilufar Yusupova\nBobur Rahimov\nMalika Toshmatova"}
              rows={8}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-400">Har bir qatorda bitta o'qituvchi: <span className="font-mono bg-gray-100 px-1 rounded">Ism Familiya</span></p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Max soat / hafta (barchasi uchun)</Label>
            <Input type="number" min={1} max={40} value={maxHours} onChange={e => setMaxHours(parseInt(e.target.value) || 30)} className="w-32" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Nechta qo'shish</Label>
            <Input type="number" min={1} max={100} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className="w-32" />
          </div>

          {parsed.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
              <p className="text-xs font-medium text-emerald-700">{parsed.length} ta o'qituvchi qo'shiladi:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parsed.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-800">
                    <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                      {p.firstName[0]}{p.lastName?.[0] || ""}
                    </div>
                    {p.firstName} {p.lastName}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick templates */}
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 font-medium">Tezkor namunalar:</p>
            <div className="flex flex-wrap gap-2">
                {[
                { label: "Bo'sh ism", make: (n: number) => Array.from({ length: n }, (_, i) => `O'qituvchi ${i + 1}`).join("\n") },
                { label: "Aniq fanlar", make: (n: number) => Array.from({ length: n }, (_, i) => ["Matematika", "Fizika", "Kimyo", "Biologiya", "Informatika"][i % 5] + " o'qituvchisi").join("\n") },
              ].map(t => (
                <button key={t.label} onClick={() => setText(t.make(count))}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleCreate} disabled={loading || parsed.length === 0} className="bg-blue-600 hover:bg-blue-700">
            {loading ? "Qo'shilmoqda..." : `${parsed.length} ta qo'shish`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Teachers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "unavail">("info");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherFormData>(EMPTY_FORM);
  const [unavailSlots, setUnavailSlots] = useState<Set<string>>(new Set());
  const [unavailLoading, setUnavailLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      let teacherId: number;
      if (editing) {
        const r = await apiRequest("PATCH", `/api/teachers/${editing.id}`, data);
        const j = await r.json(); teacherId = j.id || editing.id;
      } else {
        const r = await apiRequest("POST", "/api/teachers", data);
        const j = await r.json(); teacherId = j.id;
      }
      const slots = Array.from(unavailSlots).map(key => { const [day, period] = key.split("_").map(Number); return { dayOfWeek: day, periodNumber: period }; });
      await apiRequest("PUT", `/api/teachers/${teacherId}/unavailability`, { slots });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teachers"] });
      setOpen(false); setEditing(null); setForm(EMPTY_FORM); setUnavailSlots(new Set()); setActiveTab("info");
      toast({ title: "Muvaffaqiyat", description: editing ? "O'qituvchi yangilandi" : "O'qituvchi qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teachers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teachers"] }); toast({ title: "Muvaffaqiyat", description: "O'qituvchi o'chirildi" }); },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setUnavailSlots(new Set()); setActiveTab("info"); setOpen(true); };
  const openEdit = async (t: Teacher) => {
    setEditing(t); setActiveTab("info");
    let subjectIds: number[] = []; let unavail: Set<string> = new Set();
    setUnavailLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [subRes, unavailRes] = await Promise.all([
        fetch(`/api/teachers/${t.id}/subjects`, { headers }),
        fetch(`/api/teachers/${t.id}/unavailability`, { headers }),
      ]);
      if (subRes.ok) subjectIds = (await subRes.json()).map((ts: any) => ts.subjectId);
      if (unavailRes.ok) unavail = new Set((await unavailRes.json()).map((u: any) => `${u.dayOfWeek}_${u.periodNumber}`));
    } catch {}
    setUnavailLoading(false);
    setForm({ firstName: t.firstName || "", lastName: t.lastName || "", department: t.department || "", specialization: t.specialization || "", phone: t.phone || "", maxHoursPerWeek: t.maxHoursPerWeek || 30, subjectIds });
    setUnavailSlots(unavail); setOpen(true);
  };

  const toggleSubject = (id: number) => setForm(p => ({ ...p, subjectIds: p.subjectIds.includes(id) ? p.subjectIds.filter(x => x !== id) : [...p.subjectIds, id] }));
  const toggleUnavail = (day: number, period: number) => {
    const key = `${day}_${period}`;
    setUnavailSlots(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const filtered = teachers.filter(t => `${t.firstName} ${t.lastName} ${t.department} ${t.specialization}`.toLowerCase().includes(search.toLowerCase()));
  const fullName = (t: Teacher) => `${t.firstName} ${t.lastName}`.trim() || t.employeeId;
  const initials = (t: Teacher) => { const name = `${t.firstName} ${t.lastName}`.trim(); return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"; };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">O'qituvchilar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'qituvchilar, fanlar va band bo'lmagan vaqtlarni boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300">
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            Ko'p qo'shish
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            O'qituvchi qo'shish
          </Button>
        </div>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <Users className="mr-2 h-4 w-4 text-emerald-600" />
              O'qituvchilar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{teachers.length} ta</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Ism yoki bo'lim bo'yicha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`} onClick={() => setViewMode("grid")} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`} onClick={() => setViewMode("list")} aria-label="List view">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
              {Array(6).fill(0).map((_, i) => <div key={i} className="h-36 bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(teacher => (
                <div key={teacher.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">{initials(teacher)}</span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(teacher)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(teacher.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{fullName(teacher)}</h3>
                  {teacher.department && <p className="text-xs text-gray-500 mt-0.5">{teacher.department}</p>}
                  {teacher.specialization && <div className="flex items-center space-x-1 mt-1.5"><BookOpen className="h-3 w-3 text-gray-400 flex-shrink-0" /><p className="text-xs text-gray-500 truncate">{teacher.specialization}</p></div>}
                  {teacher.phone && <div className="flex items-center space-x-1 mt-1"><Phone className="h-3 w-3 text-gray-400 flex-shrink-0" /><p className="text-xs text-gray-500">{teacher.phone}</p></div>}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <Badge variant="secondary" className="text-xs py-0 bg-emerald-50 text-emerald-700">Faol</Badge>
                    <div className="flex items-center space-x-1 text-gray-400"><Clock className="h-3 w-3" /><span className="text-xs">{teacher.maxHoursPerWeek} soat/hafta</span></div>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_140px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  <div>O'qituvchi</div>
                  <div>Mutaxassislik</div>
                  <div>Fanlar</div>
                  <div className="text-right">Amal</div>
                </div>
                {filtered.map(teacher => (
                  <div key={teacher.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_140px] gap-4 items-center p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{initials(teacher)}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{fullName(teacher)}</h3>
                        <p className="text-xs text-gray-400 truncate">{teacher.department || "—"}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{teacher.specialization || "—"}</div>
                    <div className="text-sm text-gray-600 whitespace-nowrap">{teacher.maxHoursPerWeek || 30} soat</div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(teacher)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(teacher.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><Users className="h-6 w-6 text-gray-400" /></div>
              <p className="text-gray-600 font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "O'qituvchilar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Ko'p o'qituvchi qo'shish
                  </Button>
                  <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Bitta qo'shish</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single add/edit dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setActiveTab("info"); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="flex border-b border-gray-200 mb-4">
            <button className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "info" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab("info")}>Ma'lumotlar</button>
            <button className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-1.5 ${activeTab === "unavail" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab("unavail")}>
              <CalendarX className="h-3.5 w-3.5" /><span>Band vaqtlar</span>
              {unavailSlots.size > 0 && <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">{unavailSlots.size}</span>}
            </button>
          </div>
          {activeTab === "info" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-sm">Ism *</Label><Input placeholder="Ism" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-sm">Familiya *</Label><Input placeholder="Familiya" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-sm">Bo'lim / Kafedra</Label><Input placeholder="Matematika kafedrasi" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Mutaxassislik</Label><Input placeholder="Algebra, Geometriya" value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-sm">Telefon</Label><Input placeholder="+998 90 123 45 67" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-sm">Max soat / hafta</Label><Input type="number" min={1} max={40} value={form.maxHoursPerWeek} onChange={e => setForm(p => ({ ...p, maxHoursPerWeek: parseInt(e.target.value) || 30 }))} /></div>
              </div>
              {subjects.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">O'qitiladigan fanlar</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                    {subjects.map(sub => (
                      <button key={sub.id} type="button" onClick={() => toggleSubject(sub.id)}
                        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${form.subjectIds.includes(sub.id) ? "bg-blue-100 text-blue-800 border border-blue-200" : "bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100"}`}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || "#3B82F6" }} />
                        <span className="truncate">{sub.name}</span>
                      </button>
                    ))}
                  </div>
                  {form.subjectIds.length > 0 && <p className="text-xs text-blue-600">{form.subjectIds.length} ta fan tanlandi</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-gray-700">Dars bera olmaydigan vaqtlar</p><p className="text-xs text-gray-400 mt-0.5">Qizil katakchalar — o'qituvchi band bo'lgan vaqtlar</p></div>
                {unavailSlots.size > 0 && <button onClick={() => setUnavailSlots(new Set())} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Tozalash</button>}
              </div>
              {unavailLoading ? <div className="h-40 bg-gray-50 animate-pulse rounded-lg" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-2 text-gray-400 font-medium w-16">Dars</th>
                        {DAYS.map((d, i) => <th key={i} className="text-center py-1.5 px-1 text-gray-600 font-semibold">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(period => (
                        <tr key={period}>
                          <td className="py-1 px-2"><div className="text-gray-600 font-medium">{period}-dars</div><div className="text-gray-400 font-mono text-[10px]">{PERIOD_TIMES[period - 1]}</div></td>
                          {DAYS.map((_, dayIdx) => {
                            const day = dayIdx + 1; const key = `${day}_${period}`; const isBusy = unavailSlots.has(key);
                            return (
                              <td key={dayIdx} className="py-1 px-1 text-center">
                                <button type="button" onClick={() => toggleUnavail(day, period)}
                                  className={`w-full h-9 rounded-md border transition-all text-xs font-medium ${isBusy ? "bg-red-100 border-red-300 text-red-600 hover:bg-red-200" : "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"}`}>
                                  {isBusy ? "✕" : "✓"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center space-x-4 text-xs text-gray-500 pt-1">
                <div className="flex items-center space-x-1.5"><div className="w-3 h-3 bg-green-50 border border-green-200 rounded" /><span>Bo'sh</span></div>
                <div className="flex items-center space-x-1.5"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded" /><span>Band</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.firstName && !form.lastName) { toast({ title: "Xatolik", description: "Ism yoki familiya kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {upsertMutation.isPending ? "Saqlanmoqda..." : (editing ? "Saqlash" : "Qo'shish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddTeachers open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/teachers"] })} />
    </div>
  );
}
