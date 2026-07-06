import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { apiRequest } from "@/lib/queryClient";

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  type: "teachers" | "subjects" | "classes" | "class-subjects";
}

interface ImportResult {
  successCount: number;
  errors: Array<{ row: number; message: string }>;
}

const LABELS: Record<ExcelImportDialogProps["type"], string> = {
  teachers: "O'qituvchilar",
  subjects: "Fanlar",
  classes: "Sinflar",
  "class-subjects": "Biriktirishlar (sinf-fan-o'qituvchi)",
};

const TEMPLATE_COLUMNS: Record<ExcelImportDialogProps["type"], string[]> = {
  teachers: ["firstName", "lastName", "department", "specialization", "phone", "maxHoursPerWeek", "gradeLevel"],
  subjects: ["name", "code", "description", "color", "weeklyHours"],
  classes: ["name", "grade", "section", "totalStudents", "language", "studyDays"],
  "class-subjects": ["className", "subjectName", "teacherName", "weeklyHours"],
};

const ENDPOINTS: Record<ExcelImportDialogProps["type"], { url: string; invalidate: string[] }> = {
  teachers: { url: "/api/teachers/bulk-import", invalidate: ["/api/teachers"] },
  subjects: { url: "/api/subjects/bulk-import", invalidate: ["/api/subjects"] },
  classes: { url: "/api/classes/bulk-import", invalidate: ["/api/classes"] },
  "class-subjects": { url: "/api/class-subjects/bulk-import", invalidate: ["/api/class-subjects", "/api/classes/all/subjects", "/api/teacher-load"] },
};

// Excel ustun nomlari (o'zbekcha muqobillari bilan) -> API maydonlariga normalizatsiya
function normalizeRow(type: ExcelImportDialogProps["type"], item: any) {
  if (type === "teachers") {
    return {
      firstName: item.firstName || item.Ismi || "",
      lastName: item.lastName || item.Familiyasi || "",
      department: item.department || item.Kafedra || "",
      specialization: item.specialization || item.Mutaxassislik || "",
      phone: item.phone || item.Telefon || "",
      maxHoursPerWeek: Number(item.maxHoursPerWeek || item.Soat || 30),
      employeeId: item.employeeId || item.ID || undefined,
      gradeLevel: item.gradeLevel || item.SinfDarajasi || "high",
    };
  }
  if (type === "subjects") {
    return {
      name: item.name || item.Nomi || "",
      code: item.code || item.Kodi || "",
      description: item.description || item.Tavsif || "",
      color: item.color || item.Rangi || "#1976D2",
      weeklyHours: Number(item.weeklyHours || item.HaftalikSoat || 2),
    };
  }
  if (type === "classes") {
    return {
      name: item.name || item.Nomi || "",
      grade: String(item.grade || item.Sinf || ""),
      section: item.section || item.Harf || "",
      totalStudents: Number(item.totalStudents || item.OquvchilarSoni || 25),
      language: item.language || item.Tili || "uz",
      studyDays: item.studyDays || item.OquvKunlari || "1,2,3,4,5",
    };
  }
  // class-subjects
  return {
    className: item.className || item.Sinf || "",
    subjectName: item.subjectName || item.Fan || "",
    teacherName: item.teacherName || item.Oqituvchi || "",
    weeklyHours: Number(item.weeklyHours || item.HaftalikSoat || 0) || undefined,
  };
}

export function ExcelImportDialog({ open, onClose, type }: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      parseExcel(selected);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setPreview(json.slice(0, 5));
      } catch {
        toast({ title: "Xatolik", description: "Excel faylini o'qishda xatolik yuz berdi.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const importMutation = useMutation({
    mutationFn: async (rows: any[]): Promise<ImportResult> => {
      const items = rows.map((r) => normalizeRow(type, r));
      const res = await apiRequest("POST", ENDPOINTS[type].url, { items });
      return res.json();
    },
    onSuccess: (data) => {
      for (const key of ENDPOINTS[type].invalidate) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setResult(data);
      if (data.errors.length === 0) {
        toast({ title: "Muvaffaqiyat", description: `${data.successCount} ta yozuv import qilindi.` });
        handleClose();
      } else {
        toast({
          title: "Qisman import qilindi",
          description: `${data.successCount} ta muvaffaqiyatli, ${data.errors.length} ta xato — quyida batafsil.`,
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => {
      toast({ title: "Xatolik", description: e.message || "Import qilishda xatolik yuz berdi.", variant: "destructive" });
    },
  });

  const handleImport = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);
        importMutation.mutate(json);
      } catch {
        toast({ title: "Xatolik", description: "Excel faylini import qilishda xatolik.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    onClose();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([TEMPLATE_COLUMNS[type].reduce((acc, col) => ({ ...acc, [col]: "" }), {})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${type}_template.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{LABELS[type]}ni Excel orqali import qilish</DialogTitle>
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
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="bg-card">
              Andozani yuklash
            </Button>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Faylni tanlash uchun bosing"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Faqat .xlsx yoki .xls fayllar</p>
          </div>

          {preview.length > 0 && !result && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
                Fayl mazmuni ({preview.length} ta qator ko'rsatilmoqda)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50/50">
                    <tr>
                      {Object.keys(preview[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-3 py-1.5 text-foreground truncate max-w-[100px]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {result.successCount} ta yozuv muvaffaqiyatli import qilindi
              </div>
              {result.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-xs font-semibold text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {result.errors.length} ta qatorda xato
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-50">
                    {result.errors.map((err, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs flex gap-2">
                        <span className="font-semibold text-red-600 whitespace-nowrap">{err.row}-qator:</span>
                        <span className="text-foreground">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{result ? "Yopish" : "Bekor qilish"}</Button>
          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {importMutation.isPending ? (
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
