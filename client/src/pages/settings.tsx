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
import { Plus, Trash2, KeyRound, Shield, Users, Clock, Settings, RefreshCw, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { AccessCode } from "@shared/schema";

interface CodeForm {
  code: string;
  ownerName: string;
  role: string;
}

const EMPTY_FORM: CodeForm = { code: "", ownerName: "", role: "teacher" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  teacher: "O'qituvchi",
  school: "Maktab",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  teacher: "bg-blue-100 text-blue-700",
  school: "bg-green-100 text-green-700",
};

export default function SettingsPage() {
  const [open, setOpen] = useState(false);
  const [showCode, setShowCode] = useState<Record<number, boolean>>({});
  const [form, setForm] = useState<CodeForm>(EMPTY_FORM);

  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: codes = [], isLoading } = useQuery<AccessCode[]>({ queryKey: ["/api/access-codes"] });

  const createMutation = useMutation({
    mutationFn: async (data: CodeForm) => {
      await apiRequest("POST", "/api/access-codes", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/access-codes"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Muvaffaqiyat", description: "Kirish kodi yaratildi" });
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message || "Amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/access-codes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: "Muvaffaqiyat", description: "Kirish kodi o'chirildi" });
    },
  });

  const toggleShow = (id: number) => setShowCode(p => ({ ...p, [id]: !p[id] }));
  const [deleteId, setDeleteId] = useState<number | null>(null);
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

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm(p => ({ ...p, code }));
  };

  const formatDate = (d: any) => {
    if (!d) return "—";
    const date = new Date(d);
    return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sozlamalar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Tizim sozlamalari va kirish kodlarini boshqarish</p>
        </div>
      </div>

      {/* Current user info */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <Shield className="mr-2 h-4 w-4 text-blue-600" />
            Joriy foydalanuvchi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {(user?.firstName?.[0] || "?")}{user?.lastName?.[0] || ""}
              </span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{user?.firstName} {user?.lastName}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={ROLE_COLORS[user?.role || ""] || "bg-gray-100 text-gray-700"}>
                  {ROLE_LABELS[user?.role || ""] || user?.role}
                </Badge>
                <span className="text-xs text-gray-400 font-mono">@{user?.username}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access codes */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <KeyRound className="mr-2 h-4 w-4 text-amber-600" />
              Kirish kodlari
              <Badge variant="secondary" className="ml-2 text-xs">{codes.length} ta</Badge>
            </CardTitle>
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Yangi kod
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />)}
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <KeyRound className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Kirish kodlari yo'q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {codes.map(code => (
                <div key={code.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors bg-white">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <KeyRound className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{code.ownerName}</p>
                        <Badge className={`text-xs py-0 ${ROLE_COLORS[code.role] || "bg-gray-100 text-gray-700"}`}>
                          {ROLE_LABELS[code.role] || code.role}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <code className={`text-xs font-mono ${showCode[code.id] ? "text-blue-700" : "text-gray-400"}`}>
                          {showCode[code.id] ? code.code : "••••••••"}
                        </code>
                        <button
                          onClick={() => toggleShow(code.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showCode[code.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        {code.lastUsed && (
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            <Clock className="h-3 w-3 inline mr-0.5" />
                            {formatDate(code.lastUsed)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={() => setDeleteId(code.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System info */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <Settings className="mr-2 h-4 w-4 text-gray-500" />
            Tizim ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Ilova nomi", value: "Maktab Dars Jadvali" },
              { label: "Versiya", value: "1.0.0" },
              { label: "Til", value: "O'zbek" },
              { label: "Ish kunlari", value: "Dushanba – Juma" },
              { label: "Darslar soni", value: "6 ta / kun" },
              { label: "JWT muddat", value: "24 soat" },
            ].map(item => (
              <div key={item.label} className="space-y-0.5">
                <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create code dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi kirish kodi yaratish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Egasi (ism) *</Label>
              <Input placeholder="Masalan: Rahmatullayev Jahongir" value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Kirish kodi *</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="ABCD1234"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="font-mono"
                />
                <Button type="button" variant="outline" size="sm" onClick={generateCode} title="Tasodifiy yaratish">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">Kamida 4 ta belgi, faqat katta harflar va raqamlar</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Rol</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="teacher">O'qituvchi</SelectItem>
                  <SelectItem value="school">Maktab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => {
                if (!form.code || !form.ownerName) {
                  toast({ title: "Xatolik", description: "Ism va kod kiritilishi shart", variant: "destructive" });
                  return;
                }
                if (form.code.length < 4) {
                  toast({ title: "Xatolik", description: "Kod kamida 4 ta belgidan iborat bo'lishi kerak", variant: "destructive" });
                  return;
                }
                createMutation.mutate(form);
              }}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
