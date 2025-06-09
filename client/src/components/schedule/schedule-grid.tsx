import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScheduleCard } from "./schedule-card";
import { useDragDrop } from "@/hooks/use-drag-drop";

const timeSlots = [
  "8:00 AM",
  "9:00 AM", 
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Mock schedule data for demonstration
const mockScheduleData = {
  "monday-8am": {
    subject: "Mathematics",
    teacher: "Prof. Smith",
    room: "Room 101",
    class: "10A",
    color: "bg-blue-50 border-blue-500 text-blue-900",
  },
  "tuesday-8am": {
    subject: "Physics", 
    teacher: "Dr. Johnson",
    room: "Lab 201",
    class: "10B",
    color: "bg-green-50 border-green-500 text-green-900",
  },
  "thursday-8am": {
    subject: "Chemistry",
    teacher: "Prof. Wilson", 
    room: "Lab 305",
    class: "10A",
    color: "bg-orange-50 border-orange-500 text-orange-900",
    hasConflict: true,
  },
  "tuesday-9am": {
    subject: "English Literature",
    teacher: "Ms. Davis",
    room: "Room 205", 
    class: "10C",
    color: "bg-blue-50 border-blue-500 text-blue-900",
  },
  "wednesday-9am": {
    subject: "Biology",
    teacher: "Dr. Brown",
    room: "Lab 301",
    class: "10B", 
    color: "bg-green-50 border-green-500 text-green-900",
  },
  "friday-9am": {
    subject: "History",
    teacher: "Mr. Taylor",
    room: "Room 102",
    class: "10A",
    color: "bg-blue-50 border-blue-500 text-blue-900",
  },
};

export function ScheduleGrid() {
  const [scheduleData, setScheduleData] = useState(mockScheduleData);
  const { draggedItem, handleDragStart, handleDragEnd, handleDrop } = useDragDrop();

  const moveScheduleItem = (fromSlot: string, toSlot: string) => {
    if (!scheduleData[fromSlot as keyof typeof scheduleData]) return;
    
    const item = scheduleData[fromSlot as keyof typeof scheduleData];
    const newData = { ...scheduleData };
    
    // Remove from old slot
    delete newData[fromSlot as keyof typeof scheduleData];
    
    // Add to new slot
    newData[toSlot as keyof typeof scheduleData] = item;
    
    setScheduleData(newData);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-6 gap-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</div>
        {weekDays.map((day) => (
          <div key={day} className="text-xs font-medium text-gray-500 uppercase tracking-wide text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Schedule Grid */}
      {timeSlots.map((time, timeIndex) => (
        <div key={time} className="grid grid-cols-6 gap-4">
          <div className="text-sm font-medium text-gray-700 py-3">{time}</div>
          
          {weekDays.map((day, dayIndex) => {
            const slotKey = `${day.toLowerCase()}-${time.replace(/[:\s]/g, '').toLowerCase()}`;
            const scheduleItem = scheduleData[slotKey as keyof typeof scheduleData];
            
            // Break time at 10:00 AM
            if (time === "10:00 AM") {
              return (
                <div key={slotKey} className="bg-gray-100 rounded-lg p-3 text-center">
                  <div className="text-sm font-medium text-gray-600">Break</div>
                </div>
              );
            }

            return (
              <div
                key={slotKey}
                className={`relative min-h-[80px] rounded-lg transition-all duration-200 ${
                  scheduleItem ? '' : 'border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedItem) {
                    handleDrop();
                    moveScheduleItem(draggedItem, slotKey);
                  }
                }}
              >
                {scheduleItem ? (
                  <ScheduleCard
                    {...scheduleItem}
                    slotKey={slotKey}
                    onDragStart={() => handleDragStart(slotKey)}
                    onDragEnd={handleDragEnd}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-xs text-gray-400">Drop here</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
