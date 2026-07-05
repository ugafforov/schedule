import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Subject } from "@shared/schema";

export function TeacherSubjectDialog({
  open,
  onClose,
  subjects,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>O'qitiladigan fanlar</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto border border-border rounded-lg p-2">
          {subjects.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => toggle(sub.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                value.includes(sub.id)
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || "#3B82F6" }} />
              <span className="truncate">{sub.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
