import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "./input";
import { Check, X, Loader2 } from "lucide-react";

interface InlineEditProps {
  value: string | number;
  onSave: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  type = "text",
  min,
  max,
  placeholder,
  className = "",
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (editValue === String(value)) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1000);
      setIsEditing(false);
    } catch {
      // Error handled by parent
      setEditValue(String(value));
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(String(value));
    setIsEditing(false);
    onCancel?.();
  }, [value, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (disabled) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          min={min}
          max={max}
          placeholder={placeholder}
          className={`h-7 py-0.5 px-2 text-sm ${className}`}
          disabled={isLoading}
        />
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 flex-shrink-0" />
        ) : (
          <>
            <button
              onClick={handleSave}
              className="p-0.5 hover:bg-green-100 rounded text-green-600 flex-shrink-0"
              title="Saqlash"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-0.5 hover:bg-red-100 rounded text-red-600 flex-shrink-0"
              title="Bekor qilish"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5 transition-colors group flex items-center gap-1 min-w-0 ${className}`}
      title="Tahrirlash uchun bosing"
    >
      <span className="truncate">{value || <span className="text-muted-foreground italic">{placeholder || "—"}</span>}</span>
      {showSuccess ? (
        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      ) : (
        <span className="opacity-0 group-hover:opacity-100 text-muted-foreground text-xs flex-shrink-0">✎</span>
      )}
    </div>
  );
}

// Select variant for dropdown inline editing
interface InlineSelectProps {
  value: string;
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}

export function InlineSelect({
  value,
  options,
  onSave,
  className = "",
  disabled = false,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    };
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isEditing]);

  const handleSelect = async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false);
      return;
    }
    setIsLoading(true);
    try {
      await onSave(newValue);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  const selectedOption = options.find((o) => o.value === value);
  const SelectedIcon = selectedOption?.icon;

  if (disabled) {
    return (
      <span className={`flex items-center gap-1.5 ${className}`}>
        {SelectedIcon && <SelectedIcon className="h-3.5 w-3.5" />}
        {selectedOption?.label || value}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="absolute z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] max-h-48 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </div>
          ) : (
            options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2 ${
                    option.value === value ? "bg-blue-50 text-blue-700" : "text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {option.label}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5 transition-colors group flex items-center gap-1.5 min-w-0 ${className}`}
      title="O'zgartirish uchun bosing"
    >
      {SelectedIcon && <SelectedIcon className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="truncate">{selectedOption?.label || value}</span>
      <span className="opacity-0 group-hover:opacity-100 text-muted-foreground text-xs flex-shrink-0">▼</span>
    </div>
  );
}
