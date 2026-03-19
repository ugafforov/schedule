import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, BookOpen, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Subject } from "@shared/schema";

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  color: string;
  weeklyHours: number;
}

const COLORS = [
  { hex: "#3B82F6", label: "Ko'k" },
  { hex: "#10B981", label: "Yashil" },
  { hex: "#8B5CF6", label: "Binafsha" },
  { hex: "#F59E0B", label: "Sariq" },
  { hex: "#EF4444", label: "Qizil" },
  { hex: "#06B6D4", label: "Moviy" },
  { hex: "#EC4899", label: "Pushti" },
  { hex: "#14B8A6", label: "Zangori" },
];

export default function Subjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<SubjectFormData>({ name: "", code: "", description: "", color: "#3B82F6", weeklyHours: 4 });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subjects, isLoading } = useQuery({ queryKey: ["/api/subjects"] });

  const createMutation = useMutation({
    mutationFn: (data: SubjectFormData) => apiRequest("POST", "/api/subjects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Muvaffaqiyat", description: "Fan qo'shildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "Fan qo'shilmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Muvaffaqiyat", description: "Fan o'chirildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "O'chirishda xato", variant: "destructive" }),
  });

  const resetForm = () => setFormData({ name: "", code: "", description: "", color: "#3B82F6", weeklyHours: 4 });

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: "Xatolik", description: "Fan nomi kiritilishi shart", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredSubjects = (subjects as Subject[] || []).filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fanlar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'quv fanlarini boshqarish</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
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
              {subjects && (
                <Badge variant="secondary" className="ml-2 text-xs">{(subjects as Subject[]).length} ta</Badge>
              )}
            </CardTitle>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
            </div>
          ) : filteredSubjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSubjects.map((subject) => (
                <div key={subject.id} className="group border border-gray-100 rounded-xl p-4 hover:border-violet-200 hover:shadow-sm transition-all bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: subject.color ? `${subject.color}20` : "#3B82F620" }}
                    >
                      <BookOpen className="h-5 w-5" style={{ color: subject.color || "#3B82F6" }} />
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
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
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{subject.name}</h3>
                  </div>
                  
                  {subject.code && (
                    <p className="text-xs text-gray-400 font-mono ml-5">#{subject.code}</p>
                  )}

                  {subject.description && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{subject.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <Badge variant={subject.isActive ? "default" : "secondary"} className="text-xs py-0">
                      {subject.isActive ? "Faol" : "Faol emas"}
                    </Badge>
                    <span className="text-xs text-gray-400">{(subject as any).weeklyHours || 4} soat/hafta</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {searchTerm ? "Qidiruv bo'yicha natija topilmadi" : "Fanlar ro'yxati bo'sh"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!searchTerm && "Yangi fan qo'shish uchun yuqoridagi tugmani bosing"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi fan qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Fan nomi *</Label>
              <Input placeholder="Masalan: Matematika" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Kod (qisqartma)</Label>
                <Input placeholder="Masalan: MATH" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Haftalik soat</Label>
                <Input type="number" min={1} max={10} value={formData.weeklyHours} onChange={e => setFormData(p => ({ ...p, weeklyHours: parseInt(e.target.value) || 4 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tavsif (ixtiyoriy)</Label>
              <Input placeholder="Fan haqida qisqacha..." value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Rang</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, color: c.hex }))}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-110 border-2"
                    style={{ backgroundColor: c.hex, borderColor: formData.color === c.hex ? "#1e40af" : "transparent" }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">Qo'shish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
