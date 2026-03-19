import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Plus, Upload, FileText, Users, Building, BookOpen, GraduationCap, Loader2 } from "lucide-react";
import { offlineDB } from "@/lib/offline-db";
import { useToast } from "@/hooks/use-toast";

export function BulkOperations() {
  const [subjectsText, setSubjectsText] = useState("");
  const [teachersText, setTeachersText] = useState("");
  const [roomsText, setRoomsText] = useState("");
  const [classesText, setClassesText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  // Example data for guidance
  const subjectExample = `Matematika, MATH, Algebra va geometriya, #1976D2
Fizika, PHY, Mexanika va optika, #F57C00
Kimyo, CHEM, Organik kimyo, #7B1FA2
Biologiya, BIO, Hujayra biologiyasi, #388E3C`;

  const teacherExample = `T001, Ahmadov Bobur, Matematika, Algebra mutaxassisi, +998901234567, 30
T002, Karimova Malika, Tabiiy fanlar, Fizika o'qituvchisi, +998902345678, 28
T003, Toshmatov Sardor, Kimyo, Organik kimyo, +998903456789, 25`;

  const roomExample = `Matematika sinfi, 101, Asosiy bino, 1-qavat, 35, classroom
Fizika laboratoriyasi, 201, Fan binosi, 2-qavat, 25, lab
Kimyo laboratoriyasi, 202, Fan binosi, 2-qavat, 25, lab`;

  const classExample = `9-A sinf, 9, A, 28
9-B sinf, 9, B, 30
10-A sinf, 10, A, 25
11-A sinf, 11, A, 22`;

  const parseSubjects = (text: string) => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0] || '',
        code: parts[1] || '',
        description: parts[2] || '',
        color: parts[3] || '#1976D2'
      };
    });
  };

  const parseTeachers = (text: string) => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        employeeId: parts[0] || '',
        name: parts[1] || '',
        department: parts[2] || '',
        specialization: parts[3] || '',
        phone: parts[4] || '',
        maxHoursPerWeek: parseInt(parts[5]) || 40
      };
    });
  };

  const parseRooms = (text: string) => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0] || '',
        roomNumber: parts[1] || '',
        building: parts[2] || '',
        floor: parts[3] || '',
        capacity: parseInt(parts[4]) || 30,
        roomType: parts[5] || 'classroom'
      };
    });
  };

  const parseClasses = (text: string) => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0] || '',
        grade: parts[1] || '',
        section: parts[2] || '',
        totalStudents: parseInt(parts[3]) || 30
      };
    });
  };

  const processBulkData = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      const results: any = {
        subjects: { success: 0, failed: 0, errors: [] },
        teachers: { success: 0, failed: 0, errors: [] },
        rooms: { success: 0, failed: 0, errors: [] },
        classes: { success: 0, failed: 0, errors: [] }
      };

      let totalSteps = 0;
      let completedSteps = 0;

      // Count total operations
      if (subjectsText.trim()) totalSteps += parseSubjects(subjectsText).length;
      if (teachersText.trim()) totalSteps += parseTeachers(teachersText).length;
      if (roomsText.trim()) totalSteps += parseRooms(roomsText).length;
      if (classesText.trim()) totalSteps += parseClasses(classesText).length;

      // Process subjects
      if (subjectsText.trim()) {
        const subjects = parseSubjects(subjectsText);
        for (const subject of subjects) {
          try {
            await offlineDB.createSubject(subject);
            results.subjects.success++;
          } catch (error: any) {
            results.subjects.failed++;
            results.subjects.errors.push(`${subject.name}: ${error.message}`);
          }
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
        }
      }

      // Process teachers
      if (teachersText.trim()) {
        const teachers = parseTeachers(teachersText);
        for (const teacher of teachers) {
          try {
            await offlineDB.createTeacher(teacher);
            results.teachers.success++;
          } catch (error: any) {
            results.teachers.failed++;
            results.teachers.errors.push(`${teacher.name}: ${error.message}`);
          }
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
        }
      }

      // Process rooms
      if (roomsText.trim()) {
        const rooms = parseRooms(roomsText);
        for (const room of rooms) {
          try {
            await offlineDB.createRoom(room);
            results.rooms.success++;
          } catch (error: any) {
            results.rooms.failed++;
            results.rooms.errors.push(`${room.name}: ${error.message}`);
          }
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
        }
      }

      // Process classes
      if (classesText.trim()) {
        const classes = parseClasses(classesText);
        for (const classItem of classes) {
          try {
            await offlineDB.createClass(classItem);
            results.classes.success++;
          } catch (error: any) {
            results.classes.failed++;
            results.classes.errors.push(`${classItem.name}: ${error.message}`);
          }
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
        }
      }

      setResults(results);

      const totalSuccess = results.subjects.success + results.teachers.success + 
                          results.rooms.success + results.classes.success;
      const totalFailed = results.subjects.failed + results.teachers.failed + 
                         results.rooms.failed + results.classes.failed;

      toast({
        title: "Bulk operatsiya tugallandi",
        description: `${totalSuccess} ta element qo'shildi, ${totalFailed} ta xatolik.`,
        variant: totalFailed > 0 ? "destructive" : "default"
      });

    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const clearAll = () => {
    setSubjectsText("");
    setTeachersText("");
    setRoomsText("");
    setClassesText("");
    setResults(null);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ommaviy Ma'lumot Qo'shish
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Har bir qatorga bitta element ma'lumotini kiriting. Maydonlar vergul bilan ajratilsin.
              Noto'g'ri formatdagi qatorlar o'tkazib yuboriladi.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="subjects" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="subjects" className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                Fanlar
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                O'qituvchilar
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                Xonalar
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" />
                Sinflar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subjects" className="space-y-4">
              <div>
                <Label htmlFor="subjects">Fanlar (Format: Nomi, Kodi, Tavsifi, Rangi)</Label>
                <Textarea
                  id="subjects"
                  placeholder={subjectExample}
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="teachers" className="space-y-4">
              <div>
                <Label htmlFor="teachers">O'qituvchilar (Format: ID, Ismi, Bo'lim, Mutaxassislik, Telefon, Soat/hafta)</Label>
                <Textarea
                  id="teachers"
                  placeholder={teacherExample}
                  value={teachersText}
                  onChange={(e) => setTeachersText(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="rooms" className="space-y-4">
              <div>
                <Label htmlFor="rooms">Xonalar (Format: Nomi, Raqami, Bino, Qavat, Sig'im, Turi)</Label>
                <Textarea
                  id="rooms"
                  placeholder={roomExample}
                  value={roomsText}
                  onChange={(e) => setRoomsText(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="classes" className="space-y-4">
              <div>
                <Label htmlFor="classes">Sinflar (Format: Nomi, Sinf, Bo'lim, O'quvchilar soni)</Label>
                <Textarea
                  id="classes"
                  placeholder={classExample}
                  value={classesText}
                  onChange={(e) => setClassesText(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
            </TabsContent>
          </Tabs>

          {isProcessing && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ma'lumotlar qo'shilmoqda...</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {results && (
            <div className="mt-4 space-y-4">
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(results).map(([key, data]: [string, any]) => (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium capitalize mb-2">
                        {key === 'subjects' ? 'Fanlar' : 
                         key === 'teachers' ? 'O\'qituvchilar' :
                         key === 'rooms' ? 'Xonalar' : 'Sinflar'}
                      </div>
                      <div className="space-y-1">
                        <Badge variant="default">{data.success} muvaffaqiyatli</Badge>
                        {data.failed > 0 && (
                          <Badge variant="destructive">{data.failed} xatolik</Badge>
                        )}
                      </div>
                      {data.errors.length > 0 && (
                        <div className="mt-2 text-xs text-red-600">
                          {data.errors.slice(0, 2).map((error: string, i: number) => (
                            <div key={i}>{error}</div>
                          ))}
                          {data.errors.length > 2 && (
                            <div>+{data.errors.length - 2} boshqa xatolik</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button 
              onClick={processBulkData} 
              disabled={isProcessing || (!subjectsText.trim() && !teachersText.trim() && !roomsText.trim() && !classesText.trim())}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Qo'shilmoqda...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Barchasini Qo'shish
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={clearAll}
              disabled={isProcessing}
            >
              Tozalash
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}