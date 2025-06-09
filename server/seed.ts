import { db } from "./db";
import { 
  users, schools, subjects, teachers, classes, rooms, timeSlots, 
  scheduleEntries, scheduleConflicts 
} from "@shared/schema";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data
    await db.delete(scheduleConflicts);
    await db.delete(scheduleEntries);
    await db.delete(timeSlots);
    await db.delete(rooms);
    await db.delete(classes);
    await db.delete(teachers);
    await db.delete(subjects);
    await db.delete(schools);
    await db.delete(users);

    console.log("🧹 Cleared existing data");

    // Create users
    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    const hashedTeacherPassword = await bcrypt.hash("teacher123", 10);

    const [adminUser] = await db.insert(users).values({
      username: "admin",
      email: "admin@school.edu",
      password: hashedAdminPassword,
      role: "admin",
      firstName: "Sarah",
      lastName: "Johnson",
    }).returning();

    const [teacherUser1] = await db.insert(users).values({
      username: "teacher1",
      email: "smith@school.edu", 
      password: hashedTeacherPassword,
      role: "teacher",
      firstName: "John",
      lastName: "Smith",
    }).returning();

    const [teacherUser2] = await db.insert(users).values({
      username: "teacher2",
      email: "davis@school.edu",
      password: hashedTeacherPassword,
      role: "teacher", 
      firstName: "Emily",
      lastName: "Davis",
    }).returning();

    console.log("👥 Created users");

    // Create school
    const [school] = await db.insert(schools).values({
      name: "Springfield High School",
      address: "123 Education Street, Springfield",
      phone: "555-0123",
      email: "info@springfieldhs.edu",
    }).returning();

    console.log("🏫 Created school");

    // Create subjects
    const subjectsData = [
      { name: "Mathematics", code: "MATH", description: "Algebra, Geometry, Calculus", color: "#1976D2" },
      { name: "English Literature", code: "ENG", description: "Reading, Writing, Analysis", color: "#388E3C" },
      { name: "Physics", code: "PHY", description: "Mechanics, Thermodynamics, Optics", color: "#F57C00" },
      { name: "Chemistry", code: "CHEM", description: "Organic, Inorganic, Physical Chemistry", color: "#7B1FA2" },
      { name: "Biology", code: "BIO", description: "Cell Biology, Genetics, Ecology", color: "#388E3C" },
      { name: "History", code: "HIST", description: "World History, American History", color: "#5D4037" },
      { name: "Computer Science", code: "CS", description: "Programming, Algorithms, Data Structures", color: "#1976D2" },
      { name: "Art", code: "ART", description: "Drawing, Painting, Sculpture", color: "#E91E63" },
    ];

    const createdSubjects = await db.insert(subjects).values(subjectsData).returning();
    console.log("📚 Created subjects");

    // Create teachers
    const [teacher1] = await db.insert(teachers).values({
      userId: teacherUser1.id,
      employeeId: "T001",
      department: "Mathematics",
      specialization: "Algebra and Calculus",
      phone: "555-0101",
      maxHoursPerWeek: 30,
    }).returning();

    const [teacher2] = await db.insert(teachers).values({
      userId: teacherUser2.id,
      employeeId: "T002", 
      department: "English",
      specialization: "Literature and Writing",
      phone: "555-0102",
      maxHoursPerWeek: 25,
    }).returning();

    const [teacher3] = await db.insert(teachers).values({
      employeeId: "T003",
      department: "Science",
      specialization: "Physics and Chemistry",
      phone: "555-0103",
      maxHoursPerWeek: 35,
    }).returning();

    const [teacher4] = await db.insert(teachers).values({
      employeeId: "T004",
      department: "Science", 
      specialization: "Biology",
      phone: "555-0104",
      maxHoursPerWeek: 30,
    }).returning();

    console.log("👨‍🏫 Created teachers");

    // Create classes
    const classesData = [
      { name: "Grade 9A", grade: "9", section: "A", schoolId: school.id, classTeacherId: teacher1.id, totalStudents: 28 },
      { name: "Grade 9B", grade: "9", section: "B", schoolId: school.id, classTeacherId: teacher2.id, totalStudents: 30 },
      { name: "Grade 10A", grade: "10", section: "A", schoolId: school.id, classTeacherId: teacher1.id, totalStudents: 25 },
      { name: "Grade 10B", grade: "10", section: "B", schoolId: school.id, classTeacherId: teacher3.id, totalStudents: 27 },
      { name: "Grade 11A", grade: "11", section: "A", schoolId: school.id, classTeacherId: teacher2.id, totalStudents: 22 },
      { name: "Grade 12A", grade: "12", section: "A", schoolId: school.id, classTeacherId: teacher4.id, totalStudents: 20 },
    ];

    const createdClasses = await db.insert(classes).values(classesData).returning();
    console.log("🎓 Created classes");

    // Create rooms
    const roomsData = [
      { name: "Mathematics Classroom", roomNumber: "101", building: "Main Building", floor: "1", capacity: 35, roomType: "classroom" },
      { name: "English Classroom", roomNumber: "102", building: "Main Building", floor: "1", capacity: 30, roomType: "classroom" },
      { name: "Physics Lab", roomNumber: "201", building: "Science Building", floor: "2", capacity: 25, roomType: "lab" },
      { name: "Chemistry Lab", roomNumber: "202", building: "Science Building", floor: "2", capacity: 25, roomType: "lab" },
      { name: "Biology Lab", roomNumber: "301", building: "Science Building", floor: "3", capacity: 28, roomType: "lab" },
      { name: "Computer Lab", roomNumber: "205", building: "Technology Building", floor: "2", capacity: 30, roomType: "lab" },
      { name: "Art Studio", roomNumber: "105", building: "Arts Building", floor: "1", capacity: 20, roomType: "classroom" },
      { name: "Main Auditorium", roomNumber: "AUD", building: "Main Building", floor: "1", capacity: 200, roomType: "auditorium" },
    ];

    const createdRooms = await db.insert(rooms).values(roomsData).returning();
    console.log("🚪 Created rooms");

    // Create time slots for a typical school week
    const timeSlotsData = [
      // Monday
      { name: "Period 1", startTime: "08:00", endTime: "09:00", dayOfWeek: 1, isBreak: false },
      { name: "Period 2", startTime: "09:00", endTime: "10:00", dayOfWeek: 1, isBreak: false },
      { name: "Break", startTime: "10:00", endTime: "10:15", dayOfWeek: 1, isBreak: true },
      { name: "Period 3", startTime: "10:15", endTime: "11:15", dayOfWeek: 1, isBreak: false },
      { name: "Period 4", startTime: "11:15", endTime: "12:15", dayOfWeek: 1, isBreak: false },
      { name: "Lunch", startTime: "12:15", endTime: "13:00", dayOfWeek: 1, isBreak: true },
      { name: "Period 5", startTime: "13:00", endTime: "14:00", dayOfWeek: 1, isBreak: false },
      { name: "Period 6", startTime: "14:00", endTime: "15:00", dayOfWeek: 1, isBreak: false },

      // Tuesday
      { name: "Period 1", startTime: "08:00", endTime: "09:00", dayOfWeek: 2, isBreak: false },
      { name: "Period 2", startTime: "09:00", endTime: "10:00", dayOfWeek: 2, isBreak: false },
      { name: "Break", startTime: "10:00", endTime: "10:15", dayOfWeek: 2, isBreak: true },
      { name: "Period 3", startTime: "10:15", endTime: "11:15", dayOfWeek: 2, isBreak: false },
      { name: "Period 4", startTime: "11:15", endTime: "12:15", dayOfWeek: 2, isBreak: false },
      { name: "Lunch", startTime: "12:15", endTime: "13:00", dayOfWeek: 2, isBreak: true },
      { name: "Period 5", startTime: "13:00", endTime: "14:00", dayOfWeek: 2, isBreak: false },
      { name: "Period 6", startTime: "14:00", endTime: "15:00", dayOfWeek: 2, isBreak: false },

      // Wednesday
      { name: "Period 1", startTime: "08:00", endTime: "09:00", dayOfWeek: 3, isBreak: false },
      { name: "Period 2", startTime: "09:00", endTime: "10:00", dayOfWeek: 3, isBreak: false },
      { name: "Break", startTime: "10:00", endTime: "10:15", dayOfWeek: 3, isBreak: true },
      { name: "Period 3", startTime: "10:15", endTime: "11:15", dayOfWeek: 3, isBreak: false },
      { name: "Period 4", startTime: "11:15", endTime: "12:15", dayOfWeek: 3, isBreak: false },
      { name: "Lunch", startTime: "12:15", endTime: "13:00", dayOfWeek: 3, isBreak: true },
      { name: "Period 5", startTime: "13:00", endTime: "14:00", dayOfWeek: 3, isBreak: false },
      { name: "Period 6", startTime: "14:00", endTime: "15:00", dayOfWeek: 3, isBreak: false },

      // Thursday  
      { name: "Period 1", startTime: "08:00", endTime: "09:00", dayOfWeek: 4, isBreak: false },
      { name: "Period 2", startTime: "09:00", endTime: "10:00", dayOfWeek: 4, isBreak: false },
      { name: "Break", startTime: "10:00", endTime: "10:15", dayOfWeek: 4, isBreak: true },
      { name: "Period 3", startTime: "10:15", endTime: "11:15", dayOfWeek: 4, isBreak: false },
      { name: "Period 4", startTime: "11:15", endTime: "12:15", dayOfWeek: 4, isBreak: false },
      { name: "Lunch", startTime: "12:15", endTime: "13:00", dayOfWeek: 4, isBreak: true },
      { name: "Period 5", startTime: "13:00", endTime: "14:00", dayOfWeek: 4, isBreak: false },
      { name: "Period 6", startTime: "14:00", endTime: "15:00", dayOfWeek: 4, isBreak: false },

      // Friday
      { name: "Period 1", startTime: "08:00", endTime: "09:00", dayOfWeek: 5, isBreak: false },
      { name: "Period 2", startTime: "09:00", endTime: "10:00", dayOfWeek: 5, isBreak: false },
      { name: "Break", startTime: "10:00", endTime: "10:15", dayOfWeek: 5, isBreak: true },
      { name: "Period 3", startTime: "10:15", endTime: "11:15", dayOfWeek: 5, isBreak: false },
      { name: "Period 4", startTime: "11:15", endTime: "12:15", dayOfWeek: 5, isBreak: false },
      { name: "Lunch", startTime: "12:15", endTime: "13:00", dayOfWeek: 5, isBreak: true },
      { name: "Period 5", startTime: "13:00", endTime: "14:00", dayOfWeek: 5, isBreak: false },
      { name: "Period 6", startTime: "14:00", endTime: "15:00", dayOfWeek: 5, isBreak: false },
    ];

    const createdTimeSlots = await db.insert(timeSlots).values(timeSlotsData).returning();
    console.log("⏰ Created time slots");

    // Create some sample schedule entries
    const currentWeek = new Date();
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Get Monday of current week

    const period1Monday = createdTimeSlots.find(ts => ts.dayOfWeek === 1 && ts.startTime === "08:00");
    const period2Monday = createdTimeSlots.find(ts => ts.dayOfWeek === 1 && ts.startTime === "09:00");
    const period1Tuesday = createdTimeSlots.find(ts => ts.dayOfWeek === 2 && ts.startTime === "08:00");
    const period1Wednesday = createdTimeSlots.find(ts => ts.dayOfWeek === 3 && ts.startTime === "08:00");
    const period1Thursday = createdTimeSlots.find(ts => ts.dayOfWeek === 4 && ts.startTime === "08:00");
    const period1Friday = createdTimeSlots.find(ts => ts.dayOfWeek === 5 && ts.startTime === "08:00");

    const mathSubject = createdSubjects.find(s => s.code === "MATH");
    const englishSubject = createdSubjects.find(s => s.code === "ENG");
    const physicsSubject = createdSubjects.find(s => s.code === "PHY");
    const biologySubject = createdSubjects.find(s => s.code === "BIO");

    const scheduleEntriesData = [
      {
        classId: createdClasses[0].id, // Grade 9A
        subjectId: mathSubject!.id,
        teacherId: teacher1.id,
        roomId: createdRooms[0].id, // Math classroom
        timeSlotId: period1Monday!.id,
        weekStartDate: currentWeek,
      },
      {
        classId: createdClasses[1].id, // Grade 9B  
        subjectId: englishSubject!.id,
        teacherId: teacher2.id,
        roomId: createdRooms[1].id, // English classroom
        timeSlotId: period1Tuesday!.id,
        weekStartDate: currentWeek,
      },
      {
        classId: createdClasses[2].id, // Grade 10A
        subjectId: physicsSubject!.id,
        teacherId: teacher3.id,
        roomId: createdRooms[2].id, // Physics lab
        timeSlotId: period1Wednesday!.id,
        weekStartDate: currentWeek,
      },
      {
        classId: createdClasses[3].id, // Grade 10B
        subjectId: biologySubject!.id,
        teacherId: teacher4.id,
        roomId: createdRooms[4].id, // Biology lab
        timeSlotId: period1Thursday!.id,
        weekStartDate: currentWeek,
      },
      {
        classId: createdClasses[0].id, // Grade 9A
        subjectId: englishSubject!.id,
        teacherId: teacher2.id,
        roomId: createdRooms[1].id, // English classroom
        timeSlotId: period1Friday!.id,
        weekStartDate: currentWeek,
      },
    ];

    const createdScheduleEntries = await db.insert(scheduleEntries).values(scheduleEntriesData).returning();
    console.log("📅 Created schedule entries");

    // Create a sample conflict 
    const conflictData = {
      conflictType: "room",
      description: "Room 101 has overlapping bookings for Mathematics and Physics classes",
      scheduleEntry1Id: createdScheduleEntries[0].id,
      severity: "high" as const,
      isResolved: false,
    };

    await db.insert(scheduleConflicts).values(conflictData);
    console.log("⚠️ Created sample schedule conflict");

    console.log("✅ Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- ${createdSubjects.length} subjects created`);
    console.log(`- ${3} teachers created`);
    console.log(`- ${createdClasses.length} classes created`);
    console.log(`- ${createdRooms.length} rooms created`);
    console.log(`- ${createdTimeSlots.length} time slots created`);
    console.log(`- ${createdScheduleEntries.length} schedule entries created`);
    console.log("\n🔐 Login credentials:");
    console.log("Admin: admin / admin123");
    console.log("Teacher: teacher1 / teacher123");

  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log("🌱 Seeding completed, exiting...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}

export { seed };
