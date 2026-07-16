import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, DoorOpen, Users, Building2, X, FlaskConical, BookOpen, Music, Dumbbell, Monitor, Palette, Zap, LayoutGrid, List, MoreHorizontal } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { ROOM_TYPE_LABELS } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import type { Room } from "@shared/schema";
import { InlineEdit, InlineSelect } from "@/components/ui/inline-edit";

interface RoomFormData { name: string; roomNumber: string; building: string; floor: string; capacity: number; roomType: string; }

const EMPTY_FORM: RoomFormData = { name: "", roomNumber: "", building: "", floor: "", capacity: 30, roomType: "classroom" };

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

const ROOM_TYPE_DISPLAY: Record<string, { icon: any; bg: string; color: string; badge: string }> = {
  classroom: { icon: BookOpen,     bg: "bg-blue-500/10",   color: "text-blue-600",   badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  lab:       { icon: FlaskConical, bg: "bg-green-500/10",  color: "text-green-600",  badge: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
  gym:       { icon: Dumbbell,     bg: "bg-orange-500/10", color: "text-orange-600", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  computer:  { icon: Monitor,      bg: "bg-purple-500/10", color: "text-purple-600", badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
  music:     { icon: Music,        bg: "bg-pink-500/10",   color: "text-pink-600",   badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20" },
  art:       { icon: Palette,      bg: "bg-yellow-500/10", color: "text-yellow-600", badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
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
      const rooms = preview.map(p => ({
        name: p.name,
        roomNumber: p.roomNumber,
        capacity,
        roomType,
        building: building || null,
        floor: floor || null,
      }));
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
              <span className="text-muted-foreground text-sm">dan</span>
              <Input type="number" min={1} max={999} value={endNum} onChange={e => setEndNum(parseInt(e.target.value) || 115)} className="w-24 text-center font-mono" />
              <span className="text-muted-foreground text-sm">gacha</span>
            </div>
            {endNum - startNum >= 100 && <p className="text-xs text-red-500">Bir vaqtda ko'pi bilan 99 ta xona yaratish mumkin</p>}
          </div>

          {/* Prefix */}
          <div className="space-y-1.5">
            <Label className="text-sm">Prefiks (ixtiyoriy)</Label>
            <Input placeholder="Masalan: A- yoki Lab-" value={prefix} onChange={e => setPrefix(e.target.value)} />
            <p className="text-xs text-muted-foreground">Nomi: <span className="font-mono bg-muted px-1 rounded">{prefix || ""}101-xona</span></p>
          </div>

          {/* Room type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Xona turi</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(ROOM_TYPE_DISPLAY).map(([value, info]) => {
                const Icon = info.icon;
                return (
                  <button key={value} type="button" onClick={() => setRoomType(value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${roomType === value ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" : "border-border hover:border-border text-muted-foreground"}`}>
                    <Icon className={`h-4 w-4 ${roomType === value ? "text-blue-600" : "text-muted-foreground"}`} />
                    <span className="leading-tight text-center">{ROOM_TYPE_LABELS[value]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sig'im</Label>
              <Input type="number" min={5} max={500} value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 30)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bino</Label>
              <Input placeholder="A-bino" value={building} onChange={e => setBuilding(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Qavat</Label>
              <Input placeholder="1" value={floor} onChange={e => setFloor(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ko'rinish — <span className="text-blue-600 font-semibold">{preview.length} ta xona</span> yaratiladi:</Label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-3 bg-muted/50 rounded-xl border border-border">
                {preview.map(r => (
                  <span key={r.roomNumber} className="px-2 py-0.5 bg-card border border-border rounded-md text-xs font-mono text-foreground">{r.roomNumber}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleCreate} disabled={loading || preview.length === 0 || !isValid} className="bg-primary hover:bg-primary/90">
            {loading ? "Yaratilmoqda..." : `${preview.length} ta xona yaratish`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Room Recommendation Dialog ──────────────────────────────────────────── */
function RoomRecommendationDialog({ open, onClose, shifts, setShifts, reserve, setReserve, data, isLoading }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/rooms"] });
    qc.invalidateQueries({ queryKey: ["/api/rooms/recommendation"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  // Tavsiyani to'liq qo'llash: yangi xonalar + sig'imni oshirish + umumiy xonani fanga biriktirish
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/rooms/apply-recommendation", payload);
      return res.json();
    },
    onSuccess: (res: any) => {
      invalidate();
      toast({ title: "Tavsiya qo'llandi", description: res?.message || "Xonalar yangilandi." });
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Tavsiyani qo'llab bo'lmadi", variant: "destructive" });
    },
  });

  const suggestedRooms: any[] = data?.allSuggestedRooms || [];
  const capacityUpgrades: any[] = data?.capacityUpgrades || [];
  const roomRenames: any[] = data?.roomRenames || [];
  const actionCount = suggestedRooms.length + capacityUpgrades.length + roomRenames.length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-500" /> Xonalar ehtiyoji tahlili
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Smenalar soni</Label>
              <Select value={shifts.toString()} onValueChange={v => setShifts(parseInt(v))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 smena</SelectItem>
                  <SelectItem value="2">2 smena</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Zaxira foizi (%)</Label>
              <Select value={reserve.toString()} onValueChange={v => setReserve(parseInt(v))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (Zaxirasiz)</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Bir xona imkoniyati</Label>
              <div className="h-8 flex items-center px-3 border border-border rounded-md bg-card text-sm font-medium">
                {data?.totalCapacityPerRoom || 0} soat/hafta
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">Xona turi</th>
                  <th className="px-3 py-2 text-center">Jami soat</th>
                  <th className="px-3 py-2 text-center">Kerakli sig'im</th>
                  <th className="px-3 py-2 text-center">Mavjud / yaroqli</th>
                  <th className="px-3 py-2 text-center text-blue-600 dark:text-blue-400">Tavsiya</th>
                  <th className="px-3 py-2 text-center">Bandlik</th>
                  <th className="px-3 py-2 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Yuklanmoqda...</td></tr>
                ) : data?.recommendations?.filter((r: any) => r.needed > 0 || r.available > 0).map((r: any) => {
                  const info = ROOM_TYPE_DISPLAY[r.roomType] || ROOM_TYPE_DISPLAY.classroom;
                  const Icon = info.icon;
                  const isShortage = r.shortage > 0;
                  const hasUndersized = r.undersized?.length > 0;
                  return (
                    <tr key={r.roomType} className="hover:bg-muted/20 transition-colors align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${info.bg} ${info.color}`}><Icon className="h-4 w-4" /></div>
                          <span className="font-medium">{r.label}</span>
                        </div>
                        {r.notes?.length > 0 && (
                          <ul className="mt-1 ml-1 space-y-0.5">
                            {r.notes.map((n: string, i: number) => (
                              <li key={i} className="text-[11px] text-muted-foreground leading-snug">• {n}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{r.requiredHours}</td>
                      <td className="px-3 py-2 text-center font-mono">{r.requiredCapacity || "—"}</td>
                      <td className="px-3 py-2 text-center font-mono">
                        <span className={hasUndersized ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                          {r.available} / {r.usable}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{r.needed}</td>
                      <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                        {r.needed > 0 ? `${r.utilizationPct}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          {isShortage ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 shadow-none border-red-500/20 whitespace-nowrap">
                              {r.shortage} ta yetishmayapti
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              Yetarli
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Maxsus xonalar — fan bo'yicha taqsimot (Fizika, Kimyo, Biologiya alohida) */}
          {data?.recommendations?.filter((r: any) => r.subjects?.length > 0).map((r: any) => (
            <div key={`sub-${r.roomType}`} className="border border-border rounded-lg overflow-x-auto">
              <div className="px-3 py-2 bg-muted/60 text-xs font-semibold text-foreground">
                {r.label} — fanlar bo'yicha (har bir fanga alohida jihozlangan xona)
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-1.5">Fan</th>
                    <th className="px-3 py-1.5 text-center">Soat</th>
                    <th className="px-3 py-1.5 text-center">Sinf / o'qit.</th>
                    <th className="px-3 py-1.5">O'z xonasi</th>
                    <th className="px-3 py-1.5 text-center text-blue-600 dark:text-blue-400">Tavsiya</th>
                    <th className="px-3 py-1.5 text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {r.subjects.map((s: any) => (
                    <tr key={s.subjectId} className="hover:bg-muted/20 align-top">
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{s.subjectName}</span>
                        {s.notes?.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5">
                            {s.notes.map((n: string, i: number) => (
                              <li key={i} className="text-[11px] text-muted-foreground leading-snug">• {n}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono">{s.requiredHours}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-muted-foreground">
                        {s.classCount} / {s.teacherCount}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {s.ownRooms.length === 0 ? (
                          <span className="text-muted-foreground">— yo'q</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {s.ownRooms.map((room: any) => (
                              <li key={room.id} className={room.usable ? "" : "text-amber-600 dark:text-amber-400"}>
                                {room.name} ({room.capacity} o'rin{room.usable ? "" : " — sig'im yetmaydi"})
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                        {s.needed}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-center">
                          {s.shortage > 0 ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 shadow-none whitespace-nowrap">
                              {s.shortage} ta kerak
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              Yetarli
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {roomRenames.length > 0 && (
            <div className="p-3 rounded-lg border border-teal-500/20 bg-teal-500/10 space-y-2">
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                Mavjud xonani fanga biriktirish ({roomRenames.length} ta)
              </p>
              <p className="text-xs text-muted-foreground">
                Bu xonalar hech bir fanga atalmagan. Fan nomi bilan atalgach, jadval tuzuvchi o'sha fan darslarini
                aynan shu xonaga joylaydi — yangi xona qurishdan tejamli.
              </p>
              <ul className="space-y-1">
                {roomRenames.map((r: any) => (
                  <li key={r.roomId} className="text-xs text-foreground">
                    <span className="font-medium">{r.currentName}</span> → <span className="font-medium">{r.suggestedName}</span>
                    {r.suggestedCapacity !== r.currentCapacity && ` (${r.currentCapacity} → ${r.suggestedCapacity} o'rin)`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {capacityUpgrades.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 space-y-2">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Sig'imi yetarli bo'lmagan xonalar ({capacityUpgrades.length} ta)
              </p>
              <p className="text-xs text-muted-foreground">
                Bu xonalar jadval tuzishda ishlatilmaydi — sig'imni oshirish yangi xona qo'shishdan arzonroq yechim.
              </p>
              <ul className="space-y-1">
                {capacityUpgrades.map((u: any) => (
                  <li key={u.roomId} className="text-xs text-foreground">
                    <span className="font-medium">{u.roomName}</span>: {u.currentCapacity} → {u.suggestedCapacity} o'rin
                    <span className="text-muted-foreground"> — {u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestedRooms.length > 0 && (
            <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 space-y-2">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                Yangi qo'shiladigan xonalar ({suggestedRooms.length} ta)
              </p>
              <ul className="space-y-1">
                {suggestedRooms.map((r: any) => (
                  <li key={r.roomNumber} className="text-xs text-foreground">
                    <span className="font-medium">{r.name}</span> — {ROOM_TYPE_LABELS[r.roomType] || r.roomType},
                    {" "}{r.capacity} o'rin, {r.floor}-qavat
                    {r.subjectName && <span className="text-muted-foreground"> ({r.subjectName} fani uchun)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div>
            {actionCount > 0 && (
              <Button
                onClick={() => applyMutation.mutate({
                  create: suggestedRooms,
                  upgrades: capacityUpgrades,
                  renames: roomRenames,
                })}
                disabled={applyMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
              >
                {applyMutation.isPending
                  ? "Bajarilmoqda..."
                  : `Tavsiyani qo'llash (${actionCount} ta amal)`}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>Yopish</Button>
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
  const [clearOpen, setClearOpen] = useState(false);
  
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [analyzeShifts, setAnalyzeShifts] = useState(1);
  const [analyzeReserve, setAnalyzeReserve] = useState(15);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: recommendationData, isLoading: isRecommendationLoading } = useQuery({
    queryKey: ["/api/rooms/recommendation", analyzeShifts, analyzeReserve],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rooms/recommendation?shifts=${analyzeShifts}&reservePercent=${analyzeReserve}`);
      return res.json();
    },
    enabled: analyzeOpen, // only fetch when modal is open
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = editing ? "PATCH" : "POST";
      const url = editing ? `/api/rooms/${editing.id}` : "/api/rooms";
      await apiRequest(method, url, data);
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
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rooms/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Muvaffaqiyat", description: "Xona o'chirildi" });
    },
  });
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/rooms/clear-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Muvaffaqiyat", description: "Barcha xonalar tozalandi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  // Inline update mutation
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Room> }) => {
      await apiRequest("PATCH", `/api/rooms/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Saqlanmadi", variant: "destructive" }),
  });

  // Room type options for inline select
  const roomTypeOptions = Object.entries(ROOM_TYPE_DISPLAY).map(([value, info]) => ({
    value,
    label: ROOM_TYPE_LABELS[value] || value,
    icon: info.icon,
  }));

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
          <h1 className="text-2xl font-bold text-foreground">Xonalar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Xona va auditoriyalarni boshqarish</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => rooms.length > 0 && setClearOpen(true)}
            disabled={clearAllMutation.isPending || rooms.length === 0}
            className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Barchasini tozalash
          </Button>
          <Button variant="outline" onClick={() => setAnalyzeOpen(true)} className="border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30">
            <LayoutGrid className="mr-2 h-4 w-4 text-indigo-500" />
            Ehtiyoj tahlili
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30">
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            Ko'p yaratish
          </Button>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
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

      <Card className="border border-border shadow-sm bg-card text-card-foreground">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <DoorOpen className="mr-2 h-4 w-4 text-amber-500" />
              Xonalar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs bg-muted text-foreground">{rooms.length} ta</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4 w-4" />
                <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/50 text-foreground transition-all rounded-lg" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50 border-border">
                  <TableHead className="w-[60px] pl-4">Tur</TableHead>
                  <TableHead>Nomi</TableHead>
                  <TableHead className="w-[120px]">Raqam</TableHead>
                  <TableHead className="w-[150px]">Xona turi</TableHead>
                  <TableHead className="w-[100px]">Sig'im</TableHead>
                  <TableHead className="w-[60px] text-right pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(room => {
                  const d = getTypeDisplay(room.roomType); const Icon = d.icon;
                  const isUpdating = inlineUpdateMutation.isPending;
                  return (
                    <TableRow key={room.id} className="group border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-4">
                        <div className={`w-8 h-8 ${d.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`${d.color} h-4 w-4`} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <InlineEdit
                          value={room.name}
                          onSave={(name) => inlineUpdateMutation.mutateAsync({ id: room.id, data: { name } })}
                          placeholder="Xona nomi"
                          className="font-medium text-foreground text-sm"
                          disabled={isUpdating}
                        />
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                          {room.building || "Bino belgilanmagan"}{room.floor ? `, ${room.floor}-qavat` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        <InlineEdit
                          value={room.roomNumber}
                          onSave={(roomNumber) => inlineUpdateMutation.mutateAsync({ id: room.id, data: { roomNumber } })}
                          placeholder="#"
                          className="text-foreground"
                          disabled={isUpdating}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineSelect
                          value={room.roomType}
                          options={roomTypeOptions}
                          onSave={(roomType) => inlineUpdateMutation.mutateAsync({ id: room.id, data: { roomType } })}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          disabled={isUpdating}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        <div className="flex items-center gap-1">
                          <InlineEdit
                            value={room.capacity}
                            onSave={(val) => inlineUpdateMutation.mutateAsync({ id: room.id, data: { capacity: parseInt(val) || 30 } })}
                            type="number"
                            min={5}
                            max={500}
                            placeholder="30"
                            className="inline-block w-12"
                            disabled={isUpdating}
                          />
                          <span className="text-xs text-muted-foreground">o'rin</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="sr-only">Menyu</span>
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 border-border">
                            <DropdownMenuItem onClick={() => openEdit(room)} className="text-sm cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteId(room.id)} className="text-sm text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" /> O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3"><DoorOpen className="h-6 w-6 text-muted-foreground/40" /></div>
              <p className="text-muted-foreground font-medium">{search ? "Qidiruv bo'yicha natija topilmadi" : "Xonalar ro'yxati bo'sh"}</p>
              {!search && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Ko'p xona yaratish (diapazon)
                  </Button>
                  <Button onClick={openAdd} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> Bitta xona qo'shish</Button>
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
                      className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-all text-left ${form.roomType === value ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-border hover:bg-muted/50"}`}>
                      <Icon className={`h-4 w-4 ${form.roomType === value ? "text-blue-600" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${form.roomType === value ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground"}`}>{ROOM_TYPE_LABELS[value]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => { if (!form.name || !form.roomNumber) { toast({ title: "Xatolik", description: "Xona nomi va raqami kiritilishi shart", variant: "destructive" }); return; } upsertMutation.mutate(form); }}
              disabled={upsertMutation.isPending} className="bg-primary hover:bg-primary/90">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddRooms open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ["/api/rooms"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); }} />

      <ClearAllDialog
        open={clearOpen}
        title="Barcha xonalar o'chirilsinmi?"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          clearAllMutation.mutate();
        }}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        title="Xona o'chiriladi. Davom etasizmi?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
      />
      <RoomRecommendationDialog 
        open={analyzeOpen} 
        onClose={() => setAnalyzeOpen(false)} 
        shifts={analyzeShifts} 
        setShifts={setAnalyzeShifts} 
        reserve={analyzeReserve} 
        setReserve={setAnalyzeReserve} 
        data={recommendationData}
        isLoading={isRecommendationLoading}
      />
    </div>
  );
}
