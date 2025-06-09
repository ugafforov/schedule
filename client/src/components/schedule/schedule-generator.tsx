import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wand2, CheckCircle, AlertTriangle } from "lucide-react";
import { offlineDB } from "@/lib/offline-db";
import { useToast } from "@/hooks/use-toast";

export function ScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    message: string;
    entriesCount?: number;
    conflicts?: any[];
  } | null>(null);
  const { toast } = useToast();

  const generateSchedule = async () => {
    setIsGenerating(true);
    setProgress(0);
    setGenerationResult(null);

    try {
      // Step 1: Validate data
      setProgress(20);
      const classes = await offlineDB.getClasses();
      const subjects = await offlineDB.getSubjects();
      const teachers = await offlineDB.getTeachers();
      const rooms = await offlineDB.getRooms();
      const timeSlots = await offlineDB.getTimeSlots();

      if (classes.length === 0) {
        throw new Error("Sinflar qo'shilmagan. Avval sinflarni qo'shing.");
      }
      if (subjects.length === 0) {
        throw new Error("Fanlar qo'shilmagan. Avval fanlarni qo'shing.");
      }
      if (teachers.length === 0) {
        throw new Error("O'qituvchilar qo'shilmagan. Avval o'qituvchilarni qo'shing.");
      }
      if (rooms.length === 0) {
        throw new Error("Xonalar qo'shilmagan. Avval xonalarni qo'shing.");
      }

      // Step 2: Clear existing schedule
      setProgress(40);
      await offlineDB.run('UPDATE schedule_entries SET is_active = 0');

      // Step 3: Generate intelligent schedule
      setProgress(60);
      const generatedEntries = await generateIntelligentSchedule(classes, subjects, teachers, rooms, timeSlots);

      // Step 4: Detect conflicts
      setProgress(80);
      const conflicts = await detectScheduleConflicts(generatedEntries);

      setProgress(100);

      setGenerationResult({
        success: true,
        message: `Jadval muvaffaqiyatli yaratildi! ${generatedEntries.length} ta dars qo'shildi.`,
        entriesCount: generatedEntries.length,
        conflicts
      });

      toast({
        title: "Jadval yaratildi",
        description: `${generatedEntries.length} ta dars muvaffaqiyatli qo'shildi.`,
      });

    } catch (error: any) {
      setGenerationResult({
        success: false,
        message: error.message || "Jadval yaratishda xatolik yuz berdi."
      });

      toast({
        title: "Xatolik",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateIntelligentSchedule = async (classes: any[], subjects: any[], teachers: any[], rooms: any[], timeSlots: any[]) => {
    const generatedEntries = [];
    const usedSlots = new Set<string>(); // Format: "day-time-room" or "day-time-teacher"

    // Define subject requirements per class (hours per week)
    const subjectHours: { [key: string]: number } = {
      'MATH': 4,
      'UZB': 3,
      'PHY': 3,
      'CHEM': 2,
      'BIO': 2,
      'HIST': 2,
      'ENG': 3,
      'PE': 2
    };

    // Group time slots by day
    const slotsByDay = timeSlots.reduce((acc: any, slot: any) => {
      if (!acc[slot.day_of_week]) acc[slot.day_of_week] = [];
      acc[slot.day_of_week].push(slot);
      return acc;
    }, {});

    for (const classItem of classes) {
      const classSchedule = new Map<string, any>(); // Track class schedule

      for (const subject of subjects) {
        const hoursNeeded = subjectHours[subject.code] || 2;
        let hoursAssigned = 0;

        // Find best teacher for this subject
        const bestTeacher = findBestTeacher(teachers, subject);
        if (!bestTeacher) continue;

        // Find appropriate room for this subject
        const appropriateRoom = findAppropriateRoom(rooms, subject);
        if (!appropriateRoom) continue;

        // Assign hours for this subject
        for (let hour = 0; hour < hoursNeeded; hour++) {
          let assigned = false;

          // Try to assign to different days
          for (let day = 1; day <= 5 && !assigned; day++) {
            const daySlots = slotsByDay[day] || [];
            
            for (const slot of daySlots) {
              const roomKey = `${day}-${slot.id}-${appropriateRoom.id}`;
              const teacherKey = `${day}-${slot.id}-${bestTeacher.id}`;
              const classKey = `${day}-${slot.id}-${classItem.id}`;

              // Check conflicts
              if (usedSlots.has(roomKey) || usedSlots.has(teacherKey) || usedSlots.has(classKey)) {
                continue;
              }

              // Check teacher availability
              if (isTeacherUnavailable(bestTeacher, day, slot.start_time)) {
                continue;
              }

              // Create schedule entry
              try {
                const entry = await offlineDB.createScheduleEntry({
                  classId: classItem.id,
                  subjectId: subject.id,
                  teacherId: bestTeacher.id,
                  roomId: appropriateRoom.id,
                  timeSlotId: slot.id,
                  weekStartDate: new Date().toISOString().split('T')[0]
                });

                generatedEntries.push(entry);
                
                // Mark slots as used
                usedSlots.add(roomKey);
                usedSlots.add(teacherKey);
                usedSlots.add(classKey);
                
                hoursAssigned++;
                assigned = true;
                break;
              } catch (error) {
                console.warn('Failed to create schedule entry:', error);
              }
            }
          }

          if (!assigned) {
            console.warn(`Could not assign ${subject.name} for ${classItem.name}`);
          }
        }
      }
    }

    return generatedEntries;
  };

  const findBestTeacher = (teachers: any[], subject: any) => {
    // Find teacher with matching specialization
    let bestTeacher = teachers.find(t => 
      t.specialization?.toLowerCase().includes(subject.name.toLowerCase()) ||
      t.department?.toLowerCase().includes(subject.name.toLowerCase())
    );

    // If no specialized teacher found, find one with least assignments
    if (!bestTeacher) {
      bestTeacher = teachers.reduce((best, current) => {
        return (best.assignmentCount || 0) <= (current.assignmentCount || 0) ? best : current;
      });
    }

    return bestTeacher;
  };

  const findAppropriateRoom = (rooms: any[], subject: any) => {
    // Find room suitable for the subject
    const subjectRoomTypes: { [key: string]: string[] } = {
      'PHY': ['lab', 'laboratory'],
      'CHEM': ['lab', 'laboratory'],
      'BIO': ['lab', 'laboratory'],
      'PE': ['gym', 'sports'],
      'default': ['classroom', 'class']
    };

    const preferredTypes = subjectRoomTypes[subject.code] || subjectRoomTypes.default;
    
    let appropriateRoom = rooms.find((room: any) => 
      preferredTypes.some(type => room.room_type?.toLowerCase().includes(type))
    );

    // If no specific room found, use any available classroom
    if (!appropriateRoom) {
      appropriateRoom = rooms.find((room: any) => room.room_type === 'classroom');
    }

    return appropriateRoom || rooms[0];
  };

  const isTeacherUnavailable = (teacher: any, day: number, time: string) => {
    try {
      const unavailableTimes = JSON.parse(teacher.unavailable_times || '[]');
      return unavailableTimes.some((slot: any) => 
        slot.day === day && slot.time === time
      );
    } catch {
      return false;
    }
  };

  const detectScheduleConflicts = async (entries: any[]) => {
    const conflicts = [];
    
    // Group entries by time slot and day
    const entryGroups = entries.reduce((acc: any, entry: any) => {
      const key = `${entry.timeSlotId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    }, {});

    // Check for conflicts within each time slot
    Object.values(entryGroups).forEach((group: any) => {
      if (group.length > 1) {
        // Check teacher conflicts
        const teacherIds = group.map((e: any) => e.teacherId);
        const uniqueTeachers = new Set(teacherIds);
        if (uniqueTeachers.size < teacherIds.length) {
          conflicts.push({
            type: 'teacher',
            description: 'O\'qituvchi bir vaqtda ikki joyda',
            entries: group.filter((e: any, i: any, arr: any) => 
              arr.findIndex((other: any) => other.teacherId === e.teacherId) !== i
            )
          });
        }

        // Check room conflicts
        const roomIds = group.map((e: any) => e.roomId);
        const uniqueRooms = new Set(roomIds);
        if (uniqueRooms.size < roomIds.length) {
          conflicts.push({
            type: 'room',
            description: 'Xona bir vaqtda ikki sinf uchun band',
            entries: group.filter((e: any, i: any, arr: any) => 
              arr.findIndex((other: any) => other.roomId === e.roomId) !== i
            )
          });
        }
      }
    });

    return conflicts;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Avtomatik Jadval Yaratish
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Bu amal mavjud jadvalni o'chirib, yangi jadval yaratadi. Avval barcha ma'lumotlar (sinflar, fanlar, o'qituvchilar, xonalar) to'liq kiritilganligiga ishonch hosil qiling.
          </AlertDescription>
        </Alert>

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Jadval yaratilmoqda...</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {generationResult && (
          <Alert variant={generationResult.success ? "default" : "destructive"}>
            {generationResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              {generationResult.message}
              {generationResult.conflicts && generationResult.conflicts.length > 0 && (
                <div className="mt-2">
                  <Badge variant="destructive">
                    {generationResult.conflicts.length} ta konflikt aniqlandi
                  </Badge>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={generateSchedule} 
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Jadval yaratilmoqda...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Jadval Yaratish
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}