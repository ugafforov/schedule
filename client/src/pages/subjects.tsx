import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, BookOpen, X, Clock, DoorOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ROOM_TYPE_LABELS } from "@shared/schema";
import type { Subject } from "@shared/schema";

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  color: string;
  weeklyHours: number;
  requiredRoomType: string;
}

const EMPTY_FORM: SubjectFormData = {
  name: "", code: "", description: "", color: "#3B82F6", weeklyHours: 4, requiredRoomType: "any",
};

const COLORS = [
  { hex: "#3B82F6", label: "Ko'k" },
  { hex: "#10B981", label: "Yashil" },
  { hex: "#8B5CF6", label: "Binafsha" },
  { hex: "#F59E0B", label: "Sariq" },
  { hex: "#EF4444", label: "Qizil" },
  { hex: "#06B6D4", label: "Moviy" },
  { hex: "#EC4899", label: "Pushti" },
  { hex: "#14B8A6", label: "Zangori" },
  { hex: "#F97316", label: "To'q sariq" },
  { hex: "#6366F1", label: "Indigo" },
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

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormData>(EMPTY_FORM);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });

  const upsertMutation = useMutation({
    mutationFn: async (data: SubjectFormData) => {
      if (editing) {
        await apiRequest("PATCH", `/api/subjects/${editing.id}`, data);
      } else {
        await apiRequest("POST", "/api/subjects", data);
      }
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/subjects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Muvaffaqiyat", description: "Fan o'chirildi" });
    },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code || "",
      description: s.description || "",
      color: s.color || "#3B82F6",
      weeklyHours: s.weeklyHours || 4,
      requiredRoomType: (s as any).requiredRoomType || "any",
    });
    setOpen(true);
  };

  const filtered = subjects.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoomTypeClass = (type: string) => ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.any;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fanlar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'quv fanlarini va xona talablarini boshqarish</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Fan qo'shish
        </Button>
      </div>

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
              {filtered.map((subject) => {
                const roomType = (subject as any).requiredRoomType || "any";
                return (
                  <div key={subject.id} className="group border border-gray-100 rounded-xl p-4 hover:border-violet-200 hover:shadow-sm transition-all bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: subject.color ? `${subject.color}20` : "#3B82F620" }}
                      >
                        <BookOpen className="h-5 w-5" style={{ color: subject.color || "#3B82F6" }} />
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(subject)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate(subject.id)}
                          disabled={deleteMutation.isPending}
                        >
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
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getRoomTypeClass(roomType)}`}>
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
              <p className="text-gray-600 font-medium">
                {search ? "Qidiruv bo'yicha natija topilmadi" : "Fanlar ro'yxati bo'sh"}
              </p>
              {!search && <p className="text-sm text-gray-400 mt-1">Yangi fan qo'shish uchun yuqoridagi tugmani bosing</p>}
            </div>
          )}
        </CardContent>
      </Card>

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

            {/* Required room type */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center space-x-1.5">
                <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
                <span>Talab qilinadigan xona turi</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, requiredRoomType: value }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${
                      form.requiredRoomType === value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Rang</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, color: c.hex }))}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-110 border-2"
                    style={{ backgroundColor: c.hex, borderColor: form.color === c.hex ? "#1e40af" : "transparent" }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => {
                if (!form.name) {
                  toast({ title: "Xatolik", description: "Fan nomi kiritilishi shart", variant: "destructive" });
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
