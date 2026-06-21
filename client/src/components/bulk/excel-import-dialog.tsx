import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { apiRequest } from "@/lib/queryClient";

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  type: "teachers" | "subjects" | "classes";
}

export function ExcelImportDialog({ open, onClose, type }: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const labels = {
    teachers: "O'qituvchilar",
    subjects: "Fanlar",
    classes: "Sinflar"
  };

  const expectedColumns = {
    teachers: ["firstName", "lastName", "department", "specialization", "phone", "maxHoursPerWeek", "employeeId"],
    subjects: ["name", "code", "description", "color", "weeklyHours"],
    classes: ["name", "grade", "section", "totalStudents", "language"]
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parseExcel(selected);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setPreview(json.slice(0, 5)); // show first 5 rows
      } catch (err) {
        toast({ title: "Xatolik", description: "Excel faylini o'qishda xatolik yuz berdi.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const formattedData = data.map(item => {
        if (type === "teachers") {
          return {
            firstName: item.firstName || item.Ismi || "",
            lastName: item.lastName || item.Familiyasi || "",
            department: item.department || item.Kafedra || "",
            specialization: item.specialization || item.Mutaxassislik || "",
            phone: item.phone || item.Telefon || "",
            maxHoursPerWeek: Number(item.maxHoursPerWeek || item.Soat || 30),
            employeeId: item.employeeId || item.ID || `T${Date.now()}${Math.floor(Math.random() * 1000)}`,
            gradeLevel: item.gradeLevel || item.SinfDarajasi || "high"
          };
        } else if (type === "subjects") {
          return {
            name: item.name || item.Nomi || "",
            code: item.code || item.Kodi || `SUB${Date.now()}${Math.floor(Math.random() * 1000)}`,
            description: item.description || item.Tavsif || "",
            color: item.color || item.Rangi || "#1976D2",
            weeklyHours: Number(item.weeklyHours || item.HaftalikSoat || 2)
          };
        } else if (type === "classes") {
          return {
            name: item.name || item.Nomi || "",
            grade: String(item.grade || item.Sinf || ""),
            section: item.section || item.Harf || "",
            totalStudents: Number(item.totalStudents || item.OquvchilarSoni || 30),
            language: item.language || item.Tili || "uz"
          };
        }
        return item;
      });

      // Send one by one or create a bulk endpoint
      // Assuming we send one by one for now since we don't have bulk endpoints for all
      for (const item of formattedData) {
         await apiRequest("POST", `/api/${type}`, item);
      }
      return formattedData.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: [`/api/${type}`] });
      toast({ title: "Muvaffaqiyat", description: `${count} ta yozuv import qilindi.` });
      handleClose();
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Import qilishda xatolik yuz berdi.", variant: "destructive" });
    }
  });

  const handleImport = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setIsProcessing(true);
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        importMutation.mutate(json);
      } catch (err) {
        setIsProcessing(false);
        toast({ title: "Xatolik", description: "Excel faylini import qilishda xatolik.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setIsProcessing(false);
    onClose();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([expectedColumns[type].reduce((acc, col) => ({ ...acc, [col]: "" }), {})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${type}_template.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels[type]}ni Excel orqali import qilish</DialogTitle>
          <DialogDescription>
            Tizimga ma'lumotlarni ommaviy yuklash uchun Excel (.xlsx) faylni tanlang.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Andoza (Shablon) faylini yuklab oling</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="bg-white">
              Andozani yuklash
            </Button>
          </div>

          <div 
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              {file ? file.name : "Faylni tanlash uchun bosing"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Faqat .xlsx yoki .xls fayllar</p>
          </div>

          {preview.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600 flex justify-between">
                <span>Fayl mazmuni ({preview.length} ta qator ko'rsatilmoqda)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50">
                    <tr>
                      {Object.keys(preview[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700 truncate max-w-[100px]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Bekor qilish</Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isProcessing || importMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {(isProcessing || importMutation.isPending) ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yuklanmoqda...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Import qilish</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
