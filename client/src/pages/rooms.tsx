import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, DoorOpen, Users, Building2, X, FlaskConical, BookOpen, Music, Dumbbell, Monitor, Palette, Zap, LayoutGrid, List } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ROOM_TYPE_LABELS } from "@shared/schema";
import type { Room } from "@shared/schema";

interface RoomFormData { name: string; roomNumber: string; building: string; floor: string; capacity: number; roomType: string; }

const EMPTY_FORM: RoomFormData = { name: "", roomNumber: "", building: "", floor: "", capacity: 30, roomType: "classroom" };
function DeleteConfirmDialog({ open, title, onCancel, onConfirm }: { open: boolean; title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>O'chirishni tasdiqlash</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">{title}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Bekor qilish</Button>
          <Button variant="destructive" onClick={onConfirm}>O'chirish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROOM_TYPE_DISPLAY: Record<string, { icon: any; bg: string; color: string; badge: string }> = {
  classroom: { icon: BookOpen,     bg: "bg-blue-50",   color: "text-blue-600",   badge: "bg-blue-100 text-blue-700 border-blue-200" },
  lab:       { icon: FlaskConical, bg: "bg-green-50",  color: "text-green-600",  badge: "bg-green-100 text-green-700 border-green-200" },
  gym:       { icon: Dumbbell,     bg: "bg-orange-50", color: "text-orange-600", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  computer:  { icon: Monitor,      bg: "bg-purple-50", color: "text-purple-600", badge: "bg-purple-100 text-purple-700 border-purple-200" },
  music:     { icon: Music,        bg: "bg-pink-50",   color: "text-pink-600",   badge: "bg-pink-100 text-pink-700 border-pink-200" },
  art:       { icon: Palette,      bg: "bg-yellow-50", color: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};
const getTypeDisplay = (type: string) => ROOM_TYPE_DISPLAY[type] || ROOM_TYPE_DISPLAY.classroom;

/* ── Bulk add rooms dialog ───────────────────────────────────────────────── */
function BulkAddRooms({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [startNum, setStartNum] = useState(101);
  const [endNum, setEndNum] = useState(115);
  const [prefix, setPrefix] = useState("");
  const [roomType, setRoomType] = useState("classroom");
  const [capacity, setCapacity] = useState(30);
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = endNum >= startNum && endNum - startNum < 100;
  const preview = isValid
    ? Array.from({ length: endNum - startNum + 1 }, (_, i) => {
        const num = String(startNum + i);
        return { roomNumber: `${prefix}${num}`, name: `${prefix}${num}-xona` };
      })
    : [];

  const handleCreate = async () => {
    if (preview.length === 0) { toast({ title: "Xatolik", description: "Xona diapazoni noto'g'ri", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const rooms = preview.map(p => ({ name: p.name, roomNumber: p.roomNumber, capacity, roomType, building: building || null, floor: floor || null }));
      await apiRequest("POST", "/api/rooms/bulk", { rooms });
      toast({ title: "Muvaffaqiyat", description: `${rooms.length} ta xona yaratildi` });
      onSuccess(); onClose();
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Ko'p xona yaratish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Number range */}
          <div className="space-y-1.5">
            <Label className="text-sm">Xona raqam diapazoni</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={999} value={startNum} onChange={e => setStartNum(parseInt(e.target.value) || 101)} className="w-24 text-center font-mono" />
              <span className="text-gray-400 text-sm">dan</span>
              <Input type="number" min={1} max={999} value={endNum} onChange={e => setEndNum(parseInt(e.target.value) || 115)} className="w-24 text-center font-mono" />
              <span className="text-gray-400 text-sm">gacha</span>
            </div>
            {endNum - startNum >= 100 && <p className="text-xs text-red-500">Bir vaqtda ko'pi bilan 99 ta xona yaratish mumkin</p>}
          </div>

          {/* Prefix */}
          <div className="space-y-1.5">
            <Label className="text-sm">Prefiks (ixtiyoriy)</Label>
            <Input placeholder="Masalan: A- yoki Lab-" value={prefix} onChange={e => setPrefix(e.target.value)} />
            <p className="text-xs text-gray-400">Nomi: <span className="font-mono bg-gray-100 px-1 rounded">{prefix || ""}101-xona</span></p>
          </div>

          {/* Room type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Xona turi</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(ROOM_TYPE_DISPLAY).map(([value, info]) => {
                const Icon = info.icon;
                return (
                  <button key={value} type="button" onClick={() => setRoomType(value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${roomType === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 hover:border-gray-200 text-gray-600"}`}>
                    <Icon className={`h-4 w-4 ${roomType === value ? "text-blue-600" : "text-gray-400"}`} />
                    <span className="leading-tight text-center">{ROOM_TYPE_LABELS[value]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Sig'im</Label>
              <Input type="number" min={5} max={500} value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 30)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Bino</Label>
              <Input placeholder="A-bino" value={building} onChange={e => setBuilding(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Qavat</Label>
              <Input placeholder="1" value={floor} onChange={e => setFloor(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Ko'rinish — <span className="text-blue-600 font-semibold">{preview.length} ta xona</span> yaratiladi:</Label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-100">
                {preview.map(r => (
                  <span key={r.roomNumber} className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-700">{r.roomNumber}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleCreate} disabled={loading || preview.length === 0 || !isValid} className="bg-blue-600 hover:bg-blue-700">
            {loading ? "Yaratilmoqda..." : `${preview.length} ta xona yaratish`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Rooms() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomFormData>(EMPTY_FORM);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rooms = [], isLoading } = useQuery<Room[]>({ queryKey: ["/api/rooms"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: RoomFormData) => {
      if (editing) await apiRequest("PATCH", `/api/rooms/${editing.id}`, data);
      else await apiRequest("POST", "/api/rooms", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false); setEditing(null); setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: editing ? "Xona yangilandi" : "Xona qo'shildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/rooms/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Muvaffaqiyat", description: "Xona o'chirildi" });
    },
  });
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(rooms.map((r) => apiRequest("DELETE", `/api/rooms/${r.id}`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Muvaffaqiyat", description: "Barcha xonalar tozalandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({ name: r.name, roomNumber: r.roomNumber, building: r.building || "", floor: r.floor || "", capacity: r.capacity, roomType: r.roomType });
    setOpen(true);
  };

  const filtered = rooms.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.roomNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.building?.toLowerCase().includes(search.toLowerCase())
  );

  const typeCounts = rooms.reduce((acc, r) => { acc[r.roomType] = (acc[r.roomType] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xonalar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Xona va auditoriyalarni boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (rooms.length === 0) return;
              if (confirm("Barcha xonalar o'chirilsinmi?")) clearAllMutation.mutate();
            }}
            disabled={clearAllMutation.isPending || rooms.length === 0}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Barchasini tozalash
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300">
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            Ko'p yaratish
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Xona qo'shish
          </Button>
        </div>
      </div>

      {/* Room type summary pills */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeCounts).map(([type, cnt]) => {
            const d = getTypeDisplay(type); const Icon = d.icon;
            return (
              <div key={type} className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${d.badge}`}>
                <Icon className="h-3 w-3" /><span>{ROOM_TYPE_LABELS[type] || type}</span><span className="opacity-70">— {cnt} ta</span>
              </div>
            );
          })}
        </div>
      )}

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <DoorOpen className="mr-2 h-4 w-4 text-orange-600" />
              Xonalar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{rooms.length} ta</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
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
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-3"}>
              {Array(8).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {filtered.map(room => {
                const d = getTypeDisplay(room.roomType); const Icon = d.icon;
                return (
                  <div key={room.id} className="group border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 ${d.bg} rounded-xl flex items-center justify-center`}><Icon className={`${d.color} h-5 w-5`} /></div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(room)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(room.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{room.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">#{room.roomNumber}</p>
                    {(room.building || room.floor) && (
                      <div className="flex items-center space-x-1 mt-1.5">
                        <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500">{room.building}{room.floor && `, ${room.floor}-qavat`}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${d.badge}`}>{ROOM_TYPE_LABELS[room.roomType] || room.roomType}</span>
                      <div className="flex items-center space-x-1 text-gray-500"><Users className="h-3 w-3" /><span className="text-xs">{room.capacity} o'rin</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.5fr)_110px_120px_120px_100px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  <div>Xona</div>
                  <div>Raqam</div>
                  <div>Turi</div>
                  <div>Sig'im</div>
                  <div className="text-right">Amal</div>
                </div>
                {filtered.map(room => {
                  const d = getTypeDisplay(room.roomType); const Icon = d.icon;
                  return (
                    <div key={room.id} className="grid grid-cols-[minmax(0,1.5fr)_110px_120px_120px_100px] gap-4 items-center p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 ${d.bg} rounded-xl flex items-center justify-center flex-shrink-0`}><Icon className={`${d.color} h-5 w-5`} /></div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{room.name}</h3>
                          <p className="text-xs text-gray-400 truncate">{room.building || "—"}{room.floor ? `, ${room.floor}-qavat` : ""}</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 font-mono truncate">#{room.roomNumber}</div>
                      <div className="text-sm text-gray-600 truncate">{ROOM_TYPE_LABELS[room.roomType] || room.roomType}</div>
                      <div className="text-sm text-gray-600 whitespace-nowrap">{room.capacity} o'rin</div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(room)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(room.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><DoorOpen className="h-6 w-6 text-gray-400" /></div>
              <p className="text-gray-600 font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "Xonalar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Ko'p xona yaratish (diapazon)
                  </Button>
                  <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Bitta xona qo'shish</Button>
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
            <DialogTitle>{editing ? "Xonani tahrirlash" : "Yangi xona qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm">Xona nomi *</Label><Input placeholder="Fizika xonasi" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Xona raqami *</Label><Input placeholder="201" value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm">Bino</Label><Input placeholder="A-bino" value={form.building} onChange={e => setForm(p => ({ ...p, building: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Qavat</Label><Input placeholder="2" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-sm">Sig'im (o'rindiqlar)</Label><Input type="number" min={5} max={500} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 30 }))} /></div>
            <div className="space-y-2">
              <Label className="text-sm">Xona turi</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROOM_TYPE_DISPLAY).map(([value, info]) => {
                  const Icon = info.icon;
                  return (
                    <button key={value} type="button" onClick={() => setForm(p => ({ ...p, roomType: value }))}
                      className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-all text-left ${form.roomType === value ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                      <Icon className={`h-4 w-4 ${form.roomType === value ? "text-blue-600" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${form.roomType === value ? "text-blue-700" : "text-gray-600"}`}>{ROOM_TYPE_LABELS[value]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name || !form.roomNumber) { toast({ title: "Xatolik", description: "Xona nomi va raqami kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddRooms open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ["/api/rooms"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); }} />

      <DeleteConfirmDialog
        open={deleteId !== null}
        title="Xona o'chiriladi. Davom etasizmi?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
