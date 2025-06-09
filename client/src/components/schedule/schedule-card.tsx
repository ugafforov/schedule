import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ScheduleCardProps {
  subject: string;
  teacher: string;
  room: string;
  class: string;
  color: string;
  hasConflict?: boolean;
  slotKey: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function ScheduleCard({
  subject,
  teacher,
  room,
  class: className,
  color,
  hasConflict,
  slotKey,
  onDragStart,
  onDragEnd,
}: ScheduleCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart();
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  return (
    <div
      className={`
        schedule-card relative p-3 rounded-lg border-l-4 cursor-move
        ${color}
        ${isDragging ? 'dragging' : 'hover:shadow-md'}
        transition-all duration-200
      `}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="text-sm font-medium">{subject}</div>
      <div className="text-xs opacity-80 mt-1">{teacher}</div>
      <div className="text-xs opacity-70">{room}</div>
      <div className="text-xs opacity-70">{className}</div>
      
      {hasConflict && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 text-xs px-2 py-1"
        >
          Conflict!
        </Badge>
      )}
    </div>
  );
}
