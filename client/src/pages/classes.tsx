import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, GraduationCap, Users, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Class } from "@shared/schema";

interface ClassFormData {
  name: string;
  grade: string;
  section: string;
  totalStudents: number;
}

export default function Classes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState<ClassFormData>({ name: "", grade: "", section: "", totalStudents: 25 });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classes, isLoading } = useQuery({ queryKey: ["/api/classes"] });

  const createMutation = useMutation({
    mutationFn: (data: ClassFormData) => apiRequest("POST", "/api/classes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Muvaffaqiyat", description: "Sinf qo'shildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "Sinf qo'shilmadi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Muvaffaqiyat", description: "Sinf o'chirildi" });
    },
    onError: () => toast({ title: "Xatolik", description: "O'chirishda xato", variant: "destructive" }),
  });

  const resetForm = () => setFormData({ name: "", grade: "", section: "", totalStudents: 25 });

  const handleSubmit = () => {
    if (!formData.name && !formData.grade) {
      toast({ title: "Xatolik", description: "Sinf nomi yoki sinfni kiriting", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredClasses = (classes as Class[] || []).filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.grade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.section?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const gradeColors = ["bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700"];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sinflar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Sinf va bo'limlarni boshqarish</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingClass(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Sinf qo'shish
        </Button>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              <GraduationCap className="mr-2 h-4 w-4 text-blue-600" />
              Sinflar ro'yxati
              {classes && (
                <Badge variant="secondary" className="ml-2 text-xs">{(classes as Class[]).length} ta</Badge>
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
          ) : filteredClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredClasses.map((classItem, idx) => (
                <div key={classItem.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 ${gradeColors[idx % gradeColors.length].split(" ")[0]} rounded-xl flex items-center justify-center`}>
                      <span className={`font-bold text-base ${gradeColors[idx % gradeColors.length].split(" ")[1]}`}>
                        {classItem.grade || classItem.name?.[0] || "?"}
                      </span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(classItem.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900">{classItem.name || `${classItem.grade}-sinf`}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {classItem.grade && `${classItem.grade}-sinf`}
                    {classItem.section && ` "${classItem.section}" guruhi`}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Users className="h-3 w-3" />
                      <span className="text-xs">{classItem.totalStudents || 0} o'quvchi</span>
                    </div>
                    <Badge variant={classItem.isActive ? "default" : "secondary"} className="text-xs py-0">
                      {classItem.isActive ? "Faol" : "Faol emas"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {searchTerm ? "Qidiruv bo'yicha natija topilmadi" : "Sinflar ro'yxati bo'sh"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!searchTerm && "Yangi sinf qo'shish uchun yuqoridagi tugmani bosing"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi sinf qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Sinf nomi</Label>
              <Input placeholder="Masalan: 9-A yoki 10-B" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Sinf (raqam)</Label>
                <Input placeholder="Masalan: 9" value={formData.grade} onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Guruh (harf)</Label>
                <Input placeholder="Masalan: A, B" value={formData.section} onChange={e => setFormData(p => ({ ...p, section: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">O'quvchilar soni</Label>
              <Input type="number" min={1} max={50} value={formData.totalStudents} onChange={e => setFormData(p => ({ ...p, totalStudents: parseInt(e.target.value) || 25 }))} />
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
