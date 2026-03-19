import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, Briefcase, BookOpen, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Teacher } from "@shared/schema";

interface TeacherFormData {
  firstName: string;
  lastName: string;
  department: string;
  specialization: string;
  phone: string;
  maxHoursPerWeek: number;
}

export default function Teachers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<TeacherFormData>({
    firstName: "",
    lastName: "",
    department: "",
    specialization: "",
    phone: "",
    maxHoursPerWeek: 20,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teachers, isLoading } = useQuery({ queryKey: ["/api/teachers"] });

  const createMutation = useMutation({
    mutationFn: (data: TeacherFormData) => apiRequest("POST", "/api/teachers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi qo'shildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "O'qituvchi qo'shilmadi", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TeacherFormData }) =>
      apiRequest("PATCH", `/api/teachers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setEditingTeacher(null);
      resetForm();
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi ma'lumotlari yangilandi" });
    },
    onError: () => toast({ title: "Xatolik", description: "Yangilash amalga oshmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teachers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi o'chirildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "O'chirishda xato yuz berdi", variant: "destructive" }),
  });

  const resetForm = () => setFormData({ firstName: "", lastName: "", department: "", specialization: "", phone: "", maxHoursPerWeek: 20 });

  const openEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      firstName: (teacher as any).firstName || "",
      lastName: (teacher as any).lastName || "",
      department: teacher.department || "",
      specialization: teacher.specialization || "",
      phone: teacher.phone || "",
      maxHoursPerWeek: teacher.maxHoursPerWeek || 20,
    });
  };

  const handleSubmit = () => {
    if (!formData.firstName && !formData.lastName && !formData.department) {
      toast({ title: "Xatolik", description: "Iltimos, maydonlarni to'ldiring", variant: "destructive" });
      return;
    }
    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTeachers = (teachers as Teacher[] || []).filter((t) =>
    t.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TeacherDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTeacher ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Ism</Label>
              <Input placeholder="Ism" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Familiya</Label>
              <Input placeholder="Familiya" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Bo'lim / Kafedra</Label>
            <Input placeholder="Masalan: Matematika kafedrasi" value={formData.department} onChange={e => setFormData(p => ({ ...p, department: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Mutaxassislik</Label>
            <Input placeholder="Masalan: Matematika, Fizika" value={formData.specialization} onChange={e => setFormData(p => ({ ...p, specialization: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Telefon raqami</Label>
              <Input placeholder="+998 90 123 45 67" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Haftalik soat (max)</Label>
              <Input type="number" min={1} max={40} value={formData.maxHoursPerWeek} onChange={e => setFormData(p => ({ ...p, maxHoursPerWeek: parseInt(e.target.value) || 20 }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {editingTeacher ? "Saqlash" : "Qo'shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">O'qituvchilar</h1>
          <p className="text-gray-500 text-sm mt-0.5">O'qituvchilar ro'yxatini boshqarish</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingTeacher(null); setShowAddDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          O'qituvchi qo'shish
        </Button>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <Users className="mr-2 h-4 w-4 text-emerald-600" />
              O'qituvchilar ro'yxati
              {teachers && (
                <Badge variant="secondary" className="ml-2 text-xs">{(teachers as Teacher[]).length} ta</Badge>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
            </div>
          ) : filteredTeachers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher) => (
                <div key={teacher.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">
                        {(teacher.employeeId || "?")[0]}
                      </span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(teacher)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(teacher.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{teacher.employeeId || "Noma'lum"}</h3>
                  
                  {teacher.department && (
                    <div className="flex items-center space-x-1 mt-1.5">
                      <Briefcase className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">{teacher.department}</p>
                    </div>
                  )}

                  {teacher.specialization && (
                    <div className="flex items-center space-x-1 mt-1">
                      <BookOpen className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">{teacher.specialization}</p>
                    </div>
                  )}

                  {teacher.phone && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500">{teacher.phone}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <Badge variant={teacher.isActive ? "default" : "secondary"} className="text-xs py-0">
                      {teacher.isActive ? "Faol" : "Faol emas"}
                    </Badge>
                    <span className="text-xs text-gray-400">{teacher.maxHoursPerWeek || 0} soat/hafta</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {searchTerm ? "Qidiruv bo'yicha natija topilmadi" : "O'qituvchilar ro'yxati bo'sh"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!searchTerm && "Yangi o'qituvchi qo'shish uchun yuqoridagi tugmani bosing"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <TeacherDialog open={showAddDialog || !!editingTeacher} onClose={() => { setShowAddDialog(false); setEditingTeacher(null); }} />
    </div>
  );
}
