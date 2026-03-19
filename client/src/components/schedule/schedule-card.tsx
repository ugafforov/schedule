import { useState } from "react";
import { MapPin, User, Users } from "lucide-react";

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
        relative p-2.5 rounded-xl border-l-4 cursor-grab active:cursor-grabbing select-none
        ${color}
        ${isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:-translate-y-0.5"}
        transition-all duration-150
      `}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {hasConflict && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">!</span>
        </div>
      )}

      <div className="text-xs font-bold leading-tight mb-1.5 line-clamp-1">{subject}</div>

      <div className="space-y-0.5">
        <div className="flex items-center space-x-1 opacity-70">
          <User className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[10px] leading-tight truncate">{teacher}</span>
        </div>
        <div className="flex items-center space-x-1 opacity-70">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[10px] leading-tight truncate">{room}</span>
        </div>
        <div className="flex items-center space-x-1 opacity-70">
          <Users className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[10px] leading-tight">{className}</span>
        </div>
      </div>
    </div>
  );
}
