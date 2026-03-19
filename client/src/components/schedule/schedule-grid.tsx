import { useState } from "react";
import { useDragDrop } from "@/hooks/use-drag-drop";
import { ScheduleCard } from "./schedule-card";

const timeSlots = [
  { label: "08:00 – 08:45", key: "t1" },
  { label: "09:00 – 09:45", key: "t2" },
  { label: "10:00 – 10:45", key: "t3" },
  { label: "TANAFFUS", key: "break", isBreak: true },
  { label: "11:05 – 11:50", key: "t4" },
  { label: "12:00 – 12:45", key: "t5" },
  { label: "13:00 – 13:45", key: "t6" },
];

const weekDays = [
  { key: "dushanba", label: "Dushanba" },
  { key: "seshanba", label: "Seshanba" },
  { key: "chorshanba", label: "Chorshanba" },
  { key: "payshanba", label: "Payshanba" },
  { key: "juma", label: "Juma" },
];

const initialSchedule: Record<string, any> = {
  "dushanba-t1": { subject: "Matematika", teacher: "A. Karimov", room: "101-xona", class: "9-A", color: "bg-blue-50 border-blue-400 text-blue-900" },
  "seshanba-t1": { subject: "Fizika", teacher: "B. Rahimov", room: "Lab-201", class: "9-B", color: "bg-green-50 border-green-400 text-green-900" },
  "chorshanba-t2": { subject: "Kimyo", teacher: "G. Yusupova", room: "Lab-305", class: "10-A", color: "bg-purple-50 border-purple-400 text-purple-900" },
  "payshanba-t1": { subject: "Biologiya", teacher: "D. Nazarova", room: "Lab-301", class: "10-B", color: "bg-emerald-50 border-emerald-400 text-emerald-900" },
  "juma-t2": { subject: "Tarix", teacher: "E. Toshmatov", room: "102-xona", class: "9-A", color: "bg-orange-50 border-orange-400 text-orange-900" },
  "dushanba-t3": { subject: "Ingliz tili", teacher: "F. Abdullayeva", room: "205-xona", class: "9-C", color: "bg-cyan-50 border-cyan-400 text-cyan-900" },
  "seshanba-t2": { subject: "Adabiyot", teacher: "G. Mirzayev", room: "103-xona", class: "11-A", color: "bg-pink-50 border-pink-400 text-pink-900" },
  "chorshanba-t3": { subject: "Geografiya", teacher: "H. Qosimov", room: "104-xona", class: "8-B", color: "bg-amber-50 border-amber-400 text-amber-900" },
};

export function ScheduleGrid() {
  const [scheduleData, setScheduleData] = useState(initialSchedule);
  const { draggedItem, handleDragStart, handleDragEnd, handleDrop } = useDragDrop();

  const moveScheduleItem = (fromSlot: string, toSlot: string) => {
    if (!scheduleData[fromSlot] || fromSlot === toSlot) return;
    const item = scheduleData[fromSlot];
    const newData = { ...scheduleData };
    delete newData[fromSlot];
    newData[toSlot] = item;
    setScheduleData(newData);
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-6 gap-2 mb-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide py-2">Vaqt</div>
          {weekDays.map((day) => (
            <div key={day.key} className="text-xs font-semibold text-gray-600 uppercase tracking-wide text-center py-2 bg-gray-50 rounded-lg">
              {day.label}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {timeSlots.map((slot) => (
            <div key={slot.key} className="grid grid-cols-6 gap-2">
              <div className={`text-xs font-mono py-3 px-2 flex items-center ${slot.isBreak ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
                {slot.label}
              </div>

              {slot.isBreak ? (
                <div className="col-span-5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center py-2">
                  <span className="text-xs font-semibold text-amber-700">Tanaffus (10:45 – 11:05)</span>
                </div>
              ) : (
                weekDays.map((day) => {
                  const slotKey = `${day.key}-${slot.key}`;
                  const item = scheduleData[slotKey];

                  return (
                    <div
                      key={slotKey}
                      className={`relative min-h-[72px] rounded-xl transition-all duration-150 ${
                        item
                          ? ""
                          : "border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                      } ${draggedItem && !item ? "border-blue-300 bg-blue-50/50" : ""}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedItem) {
                          handleDrop();
                          moveScheduleItem(draggedItem, slotKey);
                        }
                      }}
                    >
                      {item ? (
                        <ScheduleCard
                          {...item}
                          slotKey={slotKey}
                          onDragStart={() => handleDragStart(slotKey)}
                          onDragEnd={handleDragEnd}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center p-2">
                          <span className="text-xs text-gray-300">+</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
