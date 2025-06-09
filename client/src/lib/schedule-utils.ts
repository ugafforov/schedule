import type { 
  ScheduleEntry, 
  TimeSlot, 
  Teacher, 
  Room, 
  Class,
  Subject,
  ScheduleConflict 
} from "@shared/schema";

export interface ScheduleValidationResult {
  isValid: boolean;
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  type: 'room' | 'teacher' | 'class' | 'time';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedEntries: number[];
}

export interface TimeSlotData {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  name: string;
}

// Days of the week mapping
export const DAYS_OF_WEEK = {
  1: 'Monday',
  2: 'Tuesday', 
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday'
} as const;

export const DAY_ABBREVIATIONS = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed', 
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun'
} as const;

/**
 * Validates a schedule entry for conflicts
 */
export function validateScheduleEntry(
  entry: Partial<ScheduleEntry>,
  existingEntries: ScheduleEntry[],
  timeSlots: TimeSlot[],
  teachers: Teacher[],
  rooms: Room[],
  classes: Class[]
): ScheduleValidationResult {
  const conflicts: ConflictInfo[] = [];

  if (!entry.timeSlotId || !entry.teacherId || !entry.roomId || !entry.classId) {
    return { isValid: false, conflicts: [] };
  }

  const timeSlot = timeSlots.find(ts => ts.id === entry.timeSlotId);
  if (!timeSlot) {
    return { isValid: false, conflicts: [] };
  }

  // Check for same week conflicts
  const sameWeekEntries = existingEntries.filter(e => 
    e.weekStartDate.getTime() === entry.weekStartDate?.getTime()
  );

  // Check for room conflicts
  const roomConflicts = sameWeekEntries.filter(e => 
    e.roomId === entry.roomId && 
    e.timeSlotId === entry.timeSlotId &&
    e.id !== entry.id
  );

  if (roomConflicts.length > 0) {
    conflicts.push({
      type: 'room',
      severity: 'high',
      description: `Room is already booked for ${DAYS_OF_WEEK[timeSlot.dayOfWeek]} at ${timeSlot.startTime}`,
      affectedEntries: roomConflicts.map(c => c.id)
    });
  }

  // Check for teacher conflicts
  const teacherConflicts = sameWeekEntries.filter(e => 
    e.teacherId === entry.teacherId && 
    e.timeSlotId === entry.timeSlotId &&
    e.id !== entry.id
  );

  if (teacherConflicts.length > 0) {
    conflicts.push({
      type: 'teacher',
      severity: 'high',
      description: `Teacher is already assigned to another class at this time`,
      affectedEntries: teacherConflicts.map(c => c.id)
    });
  }

  // Check for class conflicts
  const classConflicts = sameWeekEntries.filter(e => 
    e.classId === entry.classId && 
    e.timeSlotId === entry.timeSlotId &&
    e.id !== entry.id
  );

  if (classConflicts.length > 0) {
    conflicts.push({
      type: 'class',
      severity: 'high',
      description: `Class already has a subject scheduled at this time`,
      affectedEntries: classConflicts.map(c => c.id)
    });
  }

  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}

/**
 * Generates a weekly schedule grid from schedule entries
 */
export function generateWeeklyGrid(
  scheduleEntries: ScheduleEntry[],
  timeSlots: TimeSlot[],
  teachers: Teacher[],
  rooms: Room[],
  classes: Class[],
  subjects: Subject[]
) {
  const grid: Record<string, any> = {};
  
  // Sort time slots by day and time
  const sortedTimeSlots = timeSlots
    .filter(ts => !ts.isBreak)
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }
      return a.startTime.localeCompare(b.startTime);
    });

  scheduleEntries.forEach(entry => {
    const timeSlot = timeSlots.find(ts => ts.id === entry.timeSlotId);
    const teacher = teachers.find(t => t.id === entry.teacherId);
    const room = rooms.find(r => r.id === entry.roomId);
    const classData = classes.find(c => c.id === entry.classId);
    const subject = subjects.find(s => s.id === entry.subjectId);

    if (timeSlot && teacher && room && classData && subject) {
      const dayName = DAYS_OF_WEEK[timeSlot.dayOfWeek].toLowerCase();
      const timeKey = timeSlot.startTime.replace(':', '').toLowerCase();
      const slotKey = `${dayName}-${timeKey}`;

      grid[slotKey] = {
        id: entry.id,
        subject: subject.name,
        teacher: teacher.employeeId || `Teacher ${teacher.id}`,
        room: room.name,
        class: classData.name,
        color: subject.color || '#1976D2',
        timeSlot: timeSlot,
        entry: entry
      };
    }
  });

  return { grid, timeSlots: sortedTimeSlots };
}

/**
 * Calculates room utilization statistics
 */
export function calculateRoomUtilization(
  scheduleEntries: ScheduleEntry[],
  rooms: Room[],
  timeSlots: TimeSlot[]
): { roomId: number; utilization: number; scheduledSlots: number; totalSlots: number }[] {
  const workingTimeSlots = timeSlots.filter(ts => !ts.isBreak && ts.dayOfWeek <= 5);
  const totalSlotsPerWeek = workingTimeSlots.length;

  return rooms.map(room => {
    const roomEntries = scheduleEntries.filter(entry => entry.roomId === room.id);
    const scheduledSlots = roomEntries.length;
    const utilization = totalSlotsPerWeek > 0 ? (scheduledSlots / totalSlotsPerWeek) * 100 : 0;

    return {
      roomId: room.id,
      utilization: Math.round(utilization),
      scheduledSlots,
      totalSlots: totalSlotsPerWeek
    };
  });
}

/**
 * Calculates teacher workload statistics
 */
export function calculateTeacherWorkload(
  scheduleEntries: ScheduleEntry[],
  teachers: Teacher[]
): { teacherId: number; scheduledHours: number; maxHours: number; utilization: number }[] {
  return teachers.map(teacher => {
    const teacherEntries = scheduleEntries.filter(entry => entry.teacherId === teacher.id);
    const scheduledHours = teacherEntries.length; // Assuming 1 entry = 1 hour
    const maxHours = teacher.maxHoursPerWeek || 40;
    const utilization = maxHours > 0 ? (scheduledHours / maxHours) * 100 : 0;

    return {
      teacherId: teacher.id,
      scheduledHours,
      maxHours,
      utilization: Math.round(utilization)
    };
  });
}

/**
 * Finds optimal time slots for a new class
 */
export function findOptimalTimeSlots(
  requirements: {
    classId: number;
    subjectId: number;
    teacherId: number;
    duration: number; // in slots
  },
  existingEntries: ScheduleEntry[],
  timeSlots: TimeSlot[],
  rooms: Room[]
): { timeSlotId: number; roomId: number; confidence: number }[] {
  const availableSlots: { timeSlotId: number; roomId: number; confidence: number }[] = [];
  
  const workingSlots = timeSlots.filter(ts => !ts.isBreak && ts.dayOfWeek <= 5);
  
  workingSlots.forEach(slot => {
    rooms.forEach(room => {
      // Check if slot is available
      const conflicts = existingEntries.filter(entry => 
        entry.timeSlotId === slot.id && 
        (entry.roomId === room.id || 
         entry.teacherId === requirements.teacherId || 
         entry.classId === requirements.classId)
      );

      if (conflicts.length === 0) {
        // Calculate confidence based on various factors
        let confidence = 100;
        
        // Prefer morning slots (lower confidence for late afternoon)
        const hour = parseInt(slot.startTime.split(':')[0]);
        if (hour >= 15) confidence -= 20;
        if (hour >= 17) confidence -= 30;
        
        // Prefer classroom over lab for general subjects
        if (room.roomType === 'classroom') confidence += 10;
        
        availableSlots.push({
          timeSlotId: slot.id,
          roomId: room.id,
          confidence: Math.max(0, confidence)
        });
      }
    });
  });

  return availableSlots.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Exports schedule data to CSV format
 */
export function exportScheduleToCSV(
  scheduleEntries: ScheduleEntry[],
  timeSlots: TimeSlot[],
  teachers: Teacher[],
  rooms: Room[],
  classes: Class[],
  subjects: Subject[]
): string {
  const headers = [
    'Day',
    'Time',
    'Subject',
    'Teacher',
    'Room',
    'Class',
    'Subject Code'
  ];

  const rows = scheduleEntries.map(entry => {
    const timeSlot = timeSlots.find(ts => ts.id === entry.timeSlotId);
    const teacher = teachers.find(t => t.id === entry.teacherId);
    const room = rooms.find(r => r.id === entry.roomId);
    const classData = classes.find(c => c.id === entry.classId);
    const subject = subjects.find(s => s.id === entry.subjectId);

    return [
      timeSlot ? DAYS_OF_WEEK[timeSlot.dayOfWeek] : '',
      timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : '',
      subject?.name || '',
      teacher?.employeeId || '',
      room?.name || '',
      classData?.name || '',
      subject?.code || ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Parses CSV data for schedule import
 */
export function parseScheduleCSV(csvContent: string): {
  success: boolean;
  data?: any[];
  errors?: string[];
} {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return { success: false, errors: ['CSV file must contain headers and at least one data row'] };
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const expectedHeaders = ['Day', 'Time', 'Subject', 'Teacher', 'Room', 'Class'];
    
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return { 
        success: false, 
        errors: [`Missing required headers: ${missingHeaders.join(', ')}`] 
      };
    }

    const data = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      const row: any = {};
      
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      
      row.rowNumber = index + 2; // +2 because we skipped header and arrays are 0-indexed
      return row;
    });

    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      errors: ['Failed to parse CSV file. Please check the format.'] 
    };
  }
}

/**
 * Generates time slot key for grid positioning
 */
export function generateTimeSlotKey(dayOfWeek: number, startTime: string): string {
  const dayName = DAYS_OF_WEEK[dayOfWeek].toLowerCase();
  const timeKey = startTime.replace(/[:\s]/g, '').toLowerCase();
  return `${dayName}-${timeKey}`;
}

/**
 * Converts 24-hour time to 12-hour format
 */
export function formatTime12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Gets the start of week date for a given date
 */
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}
