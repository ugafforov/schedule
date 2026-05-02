import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, DoorOpen, Users, Building2, X, FlaskConical, BookOpen, Music, Dumbbell } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Room } from "@shared/schema";

interface RoomFormData {
  name: string;
  roomNumber: string;
  building: string;
  floor: string;
  capacity: number;
  roomType: string;
}

const EMPTY_FORM: RoomFormData = { name: "", roomNumber: "", building: "", floor: "", capacity: 30, roomType: "classroom" };

const ROOM_TYPES = [
  { value: "classroom", label: "Darsxona", icon: BookOpen, bg: "bg-blue-50", color: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  { value: "lab", label: "Laboratoriya", icon: FlaskConical, bg: "bg-green-50", color: "text-green-600", badge: "bg-green-100 text-green-700" },
  { value: "auditorium", label: "Auditoriya", icon: Music, bg: "bg-purple-50", color: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  { value: "gym", label: "Sporzal", icon: Dumbbell, bg: "bg-orange-50", color: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  { value: "library", label: "Kutubxona", icon: BookOpen, bg: "bg-amber-50", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
];

const getRoomTypeInfo = (type: string) => ROOM_TYPES.find(t => t.value === type) || ROOM_TYPES[0];

export default function Rooms() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomFormData>(EMPTY_FORM);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rooms = [], isLoading } = useQuery<Room[]>({ queryKey: ["/api/rooms"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: RoomFormData) => {
      if (editing) {
        await apiRequest("PATCH", `/api/rooms/${editing.id}`, data);
      } else {
        await apiRequest("POST", "/api/rooms", data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
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

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({
      name: r.name,
      roomNumber: r.roomNumber,
      building: r.building || "",
      floor: r.floor || "",
      capacity: r.capacity,
      roomType: r.roomType,
    });
    setOpen(true);
  };

  const filtered = rooms.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.roomNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.building?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xonalar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Xona va auditoriyalarni boshqarish</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Xona qo'shish
        </Button>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <DoorOpen className="mr-2 h-4 w-4 text-orange-600" />
              Xonalar ro'yxati
              <Badge variant="secondary" className="ml-2 text-xs">{rooms.length} ta</Badge>
            </CardTitle>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Qidirish..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
              {filtered.map(room => {
                const typeInfo = getRoomTypeInfo(room.roomType);
                const Icon = typeInfo.icon;
                return (
                  <div key={room.id} className="group border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 ${typeInfo.bg} rounded-xl flex items-center justify-center`}>
                        <Icon className={`${typeInfo.color} h-5 w-5`} />
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(room)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate(room.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.badge}`}>{typeInfo.label}</span>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Users className="h-3 w-3" />
                        <span className="text-xs">{room.capacity} o'rin</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DoorOpen className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {search ? "Qidiruv bo'yicha natija topilmadi" : "Xonalar ro'yxati bo'sh"}
              </p>
              {!search && <p className="text-sm text-gray-400 mt-1">Yangi xona qo'shish uchun yuqoridagi tugmani bosing</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Xonani tahrirlash" : "Yangi xona qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Xona nomi *</Label>
                <Input placeholder="Fizika xonasi" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Xona raqami *</Label>
                <Input placeholder="201" value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Bino</Label>
                <Input placeholder="A-bino" value={form.building} onChange={e => setForm(p => ({ ...p, building: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Qavat</Label>
                <Input placeholder="2" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Sig'im (o'rindiqlar)</Label>
              <Input type="number" min={5} max={500} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 30 }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Xona turi</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROOM_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, roomType: type.value }))}
                      className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-all text-left ${
                        form.roomType === type.value ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${form.roomType === type.value ? "text-blue-600" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${form.roomType === type.value ? "text-blue-700" : "text-gray-600"}`}>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => {
                if (!form.name && !form.roomNumber) {
                  toast({ title: "Xatolik", description: "Xona nomi kiritilishi shart", variant: "destructive" });
                  return;
                }
                upsertMutation.mutate(form);
              }}
              disabled={upsertMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
